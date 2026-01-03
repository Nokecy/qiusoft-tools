import path from 'path';
import fs from 'fs-extra';
import { findProjectRoot, readSharedConfig } from '../lib/config.js';
import { syncMappings } from '../lib/copier.js';
import { fetchRepoSnapshot } from '../lib/fetcher.js';
import { isGitDirty } from '../lib/git.js';
import { readLock, writeLock } from '../lib/lock.js';
import { readManifest } from '../lib/manifest.js';
import { ensureProjectLocal } from '../lib/projectLocal.js';

export async function cmdUpdate(options: {
  cwd: string;
  force?: boolean;
  dryRun?: boolean;
  ref?: string;
  check?: boolean;
  allowDirty?: boolean;
}) {
  const projectRoot = findProjectRoot(options.cwd);
  if (!projectRoot) throw new Error('找不到 .shared-config.json（请在项目内执行）。');

  const cfg = readSharedConfig(projectRoot);
  const ref = options.ref || cfg.ref || 'main';
  const token = process.env[cfg.tokenEnv || 'GITHUB_TOKEN'];

  const lock = await readLock(projectRoot, cfg.lockFile!);
  const snapshot = await fetchRepoSnapshot({
    repo: cfg.repo,
    ref,
    token,
    baseDir: projectRoot,
  });
  const manifest = await readManifest(snapshot.dir, cfg.manifestFile);

  if (options.check) {
    const localSha = lock?.resolvedSha ?? null;
    const remoteSha = snapshot.resolvedSha ?? null;
    const same = localSha && remoteSha ? localSha === remoteSha : false;

    console.log(`Project: ${projectRoot}`);
    console.log(`Local : ${localSha ?? '(none)'}`);
    console.log(`Remote: ${remoteSha ?? '(unknown)'}`);
    console.log(same ? 'Up to date.' : 'Update available.');
    if (snapshot.tempRoot) {
      await fs.remove(snapshot.tempRoot).catch(() => {});
    }
    return;
  }

  const destPaths = manifest.includes.map(m => m.to);
  if (!options.allowDirty) {
    const dirty = isGitDirty(projectRoot, destPaths);
    if (dirty) throw new Error('共享目录存在未提交改动，请先提交/暂存或使用 --allow-dirty。');
  }

  const backupDir = options.force
    ? undefined
    : path.join(projectRoot, '.shared-backup', new Date().toISOString().replace(/[:.]/g, '-'));
  if (backupDir && !options.dryRun) await fs.ensureDir(backupDir);

  await ensureProjectLocal({
    repoDir: snapshot.dir,
    projectRoot,
  });

  await syncMappings({
    repoDir: snapshot.dir,
    projectRoot,
    mappings: manifest.includes,
    exclude: [...(manifest.exclude || []), ...(cfg.exclude || [])],
    backupDir,
    dryRun: options.dryRun,
  });

  if (!options.dryRun) {
    await writeLock(projectRoot, cfg.lockFile!, {
      repo: cfg.repo,
      ref,
      resolvedSha: snapshot.resolvedSha,
      updatedAt: new Date().toISOString(),
    });
  }

  if (snapshot.tempRoot) {
    await fs.remove(snapshot.tempRoot).catch(() => {});
  }
  console.log('Done.');
}
