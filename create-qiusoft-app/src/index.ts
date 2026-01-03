#!/usr/bin/env node
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import AdmZip from 'adm-zip';
import fg from 'fast-glob';
import micromatch from 'micromatch';
import { fetch } from 'undici';
import { Command } from 'commander';
import { spawnSync } from 'child_process';

type SharedMapping = { from: string; to: string };
type SharedManifest = { includes: SharedMapping[]; exclude?: string[] };

const DEFAULT_REPO =
  process.env.QIUSOFT_TEMPLATE_REPO || 'github:Nokecy/qiusoft-template';
const DEFAULT_REF = 'main';
const DEFAULT_TOKEN_ENV = 'GITHUB_TOKEN';
const DEFAULT_MANIFEST = 'shared.manifest.json';

type GithubRepo = { owner: string; name: string };

function parseGithub(repo: string): GithubRepo | null {
  const m = repo.match(/^github:([^/]+)\/(.+)$/);
  if (m) return { owner: m[1], name: m[2] };
  return null;
}

function resolveLocalRepo(repo: string, baseDir: string): string | null {
  if (repo.startsWith('github:')) return null;
  let raw = repo;
  if (repo.startsWith('file:')) raw = repo.slice('file:'.length);
  if (repo.startsWith('local:')) raw = repo.slice('local:'.length);
  const full = path.isAbsolute(raw) ? raw : path.resolve(baseDir, raw);
  return fs.existsSync(full) ? full : null;
}

async function githubResolveSha(opts: { repo: GithubRepo; ref: string; token?: string }): Promise<string | null> {
  const url = `https://api.github.com/repos/${opts.repo.owner}/${opts.repo.name}/commits/${encodeURIComponent(
    opts.ref
  )}`;
  const headers: Record<string, string> = {
    'User-Agent': 'create-qiusoft-app',
    Accept: 'application/vnd.github+json',
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const json = (await res.json()) as { sha?: string };
  return typeof json?.sha === 'string' ? json.sha : null;
}

async function githubDownloadZip(opts: { repo: GithubRepo; ref: string; token?: string }): Promise<ArrayBuffer> {
  const url = `https://api.github.com/repos/${opts.repo.owner}/${opts.repo.name}/zipball/${encodeURIComponent(
    opts.ref
  )}`;
  const headers: Record<string, string> = {
    'User-Agent': 'create-qiusoft-app',
    Accept: 'application/vnd.github+json',
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const res = await fetch(url, { headers, redirect: 'follow' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub zip download failed: ${res.status} ${res.statusText} ${text}`.trim());
  }
  return await res.arrayBuffer();
}

async function fetchRepoSnapshot(opts: {
  repo: string;
  ref: string;
  token?: string;
  baseDir?: string;
}): Promise<{ dir: string; resolvedSha: string | null; tempRoot: string }> {
  const localRepo = resolveLocalRepo(opts.repo, opts.baseDir || process.cwd());
  if (localRepo) {
    return { dir: localRepo, resolvedSha: null, tempRoot: '' };
  }
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'create-qiusoft-app-'));
  const outDir = path.join(tempRoot, 'repo');
  await fs.ensureDir(outDir);

  const gh = parseGithub(opts.repo);
  if (!gh) {
    throw new Error(`仅支持 github:* 仓库格式，当前为: ${opts.repo}`);
  }

  const [zipBuf, sha] = await Promise.all([
    githubDownloadZip({ repo: gh, ref: opts.ref, token: opts.token }),
    githubResolveSha({ repo: gh, ref: opts.ref, token: opts.token }),
  ]);

  const zip = new AdmZip(Buffer.from(zipBuf));
  zip.extractAllTo(outDir, true);

  const entries = await fs.readdir(outDir);
  if (!entries.length) throw new Error('Zip 解压完成但未找到文件。');
  const root = path.join(outDir, entries[0]);

  return { dir: root, resolvedSha: sha, tempRoot };
}

function toPosix(p: string) {
  return p.replace(/\\/g, '/');
}

function shouldIgnore(relFromMapping: string, relFromRepo: string, ignore: string[]) {
  if (!ignore.length) return false;
  return (
    micromatch.isMatch(relFromMapping, ignore, { dot: true }) ||
    micromatch.isMatch(relFromRepo, ignore, { dot: true })
  );
}

async function readManifest(repoDir: string, manifestFile: string): Promise<SharedManifest> {
  const p = path.join(repoDir, manifestFile);
  if (!(await fs.pathExists(p))) {
    throw new Error(`找不到共享清单: ${manifestFile}`);
  }
  const manifest = (await fs.readJSON(p)) as SharedManifest;
  if (!Array.isArray(manifest.includes) || manifest.includes.length === 0) {
    throw new Error('共享清单 includes 不能为空。');
  }
  manifest.exclude ||= [];
  return manifest;
}

async function copyMappings(opts: {
  repoDir: string;
  targetRoot: string;
  mappings: SharedMapping[];
  exclude: string[];
}) {
  for (const m of opts.mappings) {
    const srcRoot = path.join(opts.repoDir, m.from);
    const dstRoot = path.join(opts.targetRoot, m.to);
    if (!(await fs.pathExists(srcRoot))) {
      throw new Error(`Source not found: ${m.from}`);
    }

    const srcStat = await fs.stat(srcRoot);
    const fromPosix = toPosix(m.from);
    if (srcStat.isFile()) {
      const relFromMapping = toPosix(path.basename(m.from));
      const relFromRepo = fromPosix;
      if (shouldIgnore(relFromMapping, relFromRepo, opts.exclude)) {
        continue;
      }
      await fs.ensureDir(path.dirname(dstRoot));
      await fs.copyFile(srcRoot, dstRoot);
      continue;
    }

    const allSrcFiles = await fg(['**/*'], { cwd: srcRoot, dot: true, onlyFiles: true });
    const srcFiles = allSrcFiles.filter(file => {
      const rel = toPosix(file);
      const relFromRepo = `${fromPosix}/${rel}`;
      return !shouldIgnore(rel, relFromRepo, opts.exclude);
    });

    for (const file of srcFiles) {
      const src = path.join(srcRoot, file);
      const dst = path.join(dstRoot, file);
      await fs.ensureDir(path.dirname(dst));
      await fs.copyFile(src, dst);
    }
  }
}

async function copyExtraFiles(repoDir: string, targetRoot: string) {
  const extraFiles = ['package.json', 'yarn.lock', '.gitmodules'];
  for (const file of extraFiles) {
    const src = path.join(repoDir, file);
    if (!(await fs.pathExists(src))) continue;
    const dst = path.join(targetRoot, file);
    await fs.ensureDir(path.dirname(dst));
    await fs.copyFile(src, dst);
  }
}

function ensureSubmodules(targetRoot: string) {
  const gitmodulesPath = path.join(targetRoot, '.gitmodules');
  if (!fs.existsSync(gitmodulesPath)) return;

  const hasGit = spawnSync('git', ['--version'], { stdio: 'ignore' });
  if (hasGit.status !== 0) {
    throw new Error('检测到 .gitmodules，但未找到 git，请先安装 git。');
  }

  const gitDir = path.join(targetRoot, '.git');
  if (!fs.existsSync(gitDir)) {
    const init = spawnSync('git', ['init'], { cwd: targetRoot, stdio: 'inherit' });
    if (init.status !== 0) {
      throw new Error('git init 失败，请检查 git 环境。');
    }
  }

  const update = spawnSync('git', ['submodule', 'update', '--init', '--recursive'], {
    cwd: targetRoot,
    stdio: 'inherit',
  });
  if (update.status !== 0) {
    throw new Error('子模块初始化失败，请检查网络或访问权限。');
  }
}

async function ensureProjectLocal(opts: { repoDir: string; targetRoot: string; relativePath?: string }) {
  const relativePath = opts.relativePath || path.join('config', 'project.local.ts');
  const target = path.join(opts.targetRoot, relativePath);
  if (await fs.pathExists(target)) return;

  const source = path.join(opts.repoDir, relativePath);
  if (!(await fs.pathExists(source))) return;

  await fs.ensureDir(path.dirname(target));
  await fs.copyFile(source, target);
}

async function writeSharedConfig(opts: {
  targetRoot: string;
  repo: string;
  ref: string;
  tokenEnv: string;
  manifestFile: string;
}) {
  const content = {
    repo: opts.repo,
    ref: opts.ref,
    tokenEnv: opts.tokenEnv,
    lockFile: '.shared-lock.json',
    manifestFile: opts.manifestFile,
  };
  const p = path.join(opts.targetRoot, '.shared-config.json');
  await fs.writeJSON(p, content, { spaces: 2 });
}

async function writeLock(opts: { targetRoot: string; repo: string; ref: string; resolvedSha: string | null }) {
  const p = path.join(opts.targetRoot, '.shared-lock.json');
  await fs.writeJSON(
    p,
    {
      repo: opts.repo,
      ref: opts.ref,
      resolvedSha: opts.resolvedSha,
      updatedAt: new Date().toISOString(),
    },
    { spaces: 2 }
  );
}

async function updatePackageName(targetRoot: string, name: string) {
  const pkgPath = path.join(targetRoot, 'package.json');
  if (!(await fs.pathExists(pkgPath))) return;
  const pkg = await fs.readJSON(pkgPath);
  pkg.name = name;
  await fs.writeJSON(pkgPath, pkg, { spaces: 2 });
}

async function main() {
  const program = new Command();
  program
    .name('create-qiusoft-app')
    .argument('<project-name>')
    .option('--repo <repo>', '模板仓库地址', DEFAULT_REPO)
    .option('--ref <ref>', '分支/标签/提交', DEFAULT_REF)
    .option('--token-env <name>', '访问令牌环境变量名', DEFAULT_TOKEN_ENV)
    .option('--manifest <path>', '共享清单文件名', DEFAULT_MANIFEST)
    .option('--skip-install', '跳过 yarn install')
    .parse();

  const [name] = program.args;
  const opts = program.opts();
  if (!name) {
    console.error('Usage: create-qiusoft-app <project-name>');
    process.exit(1);
  }

  const targetRoot = path.resolve(process.cwd(), name);
  if (await fs.pathExists(targetRoot)) {
    console.error(`Target exists: ${targetRoot}`);
    process.exit(1);
  }

  const token = process.env[opts.tokenEnv || DEFAULT_TOKEN_ENV];
  const baseDir = process.cwd();
  const localRepo = resolveLocalRepo(opts.repo, baseDir);
  const repoForConfig = localRepo ? `file:${localRepo}` : opts.repo;
  const snapshot = await fetchRepoSnapshot({
    repo: opts.repo,
    ref: opts.ref,
    token,
    baseDir,
  });
  const manifest = await readManifest(snapshot.dir, opts.manifest);

  await fs.ensureDir(targetRoot);
  await copyMappings({
    repoDir: snapshot.dir,
    targetRoot,
    mappings: manifest.includes,
    exclude: manifest.exclude || [],
  });
  await copyExtraFiles(snapshot.dir, targetRoot);
  await ensureProjectLocal({ repoDir: snapshot.dir, targetRoot });
  await updatePackageName(targetRoot, name);
  await writeSharedConfig({
    targetRoot,
    repo: repoForConfig,
    ref: opts.ref,
    tokenEnv: opts.tokenEnv || DEFAULT_TOKEN_ENV,
    manifestFile: opts.manifest,
  });
  await writeLock({
    targetRoot,
    repo: opts.repo,
    ref: opts.ref,
    resolvedSha: snapshot.resolvedSha,
  });

  ensureSubmodules(targetRoot);

  if (snapshot.tempRoot) {
    await fs.remove(snapshot.tempRoot).catch(() => {});
  }

  if (!opts.skipInstall) {
    const result = spawnSync('yarn', ['install'], {
      cwd: targetRoot,
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }

  console.log(`Done: ${name}`);
}

main().catch(error => {
  console.error(error?.message || error);
  process.exit(1);
});
