import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import AdmZip from 'adm-zip';
import { githubDownloadZip, githubResolveSha, parseGithub } from './github.js';

function resolveLocalRepo(repo: string, baseDir?: string): string | null {
  if (repo.startsWith('github:')) return null;
  let raw = repo;
  if (repo.startsWith('file:')) raw = repo.slice('file:'.length);
  if (repo.startsWith('local:')) raw = repo.slice('local:'.length);
  const full = path.isAbsolute(raw) ? raw : path.resolve(baseDir || process.cwd(), raw);
  return fs.existsSync(full) ? full : null;
}

export async function fetchRepoSnapshot(opts: {
  repo: string;
  ref: string;
  token?: string;
  baseDir?: string;
}): Promise<{ dir: string; resolvedSha: string | null; tempRoot: string }> {
  const localRepo = resolveLocalRepo(opts.repo, opts.baseDir);
  if (localRepo) {
    return { dir: localRepo, resolvedSha: null, tempRoot: '' };
  }
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'shared-cli-'));
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
