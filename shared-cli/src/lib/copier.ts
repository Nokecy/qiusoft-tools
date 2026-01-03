import path from 'path';
import fs from 'fs-extra';
import fg from 'fast-glob';
import micromatch from 'micromatch';

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

export async function syncOneMapping(opts: {
  repoDir: string;
  projectRoot: string;
  from: string;
  to: string;
  exclude: string[];
  backupDir?: string;
  dryRun?: boolean;
  skipIfExists?: boolean;
}) {
  const srcRoot = path.join(opts.repoDir, opts.from);
  const dstRoot = path.join(opts.projectRoot, opts.to);

  if (!(await fs.pathExists(srcRoot))) {
    throw new Error(`Source not found: ${opts.from}`);
  }

  const srcStat = await fs.stat(srcRoot);
  if (opts.skipIfExists && (await fs.pathExists(dstRoot))) {
    if (opts.dryRun) {
      console.log(`[skip] ${opts.from} -> ${opts.to} (target exists)`);
    }
    return;
  }
  const fromPosix = toPosix(opts.from);

  if (srcStat.isFile()) {
    const relFromMapping = toPosix(path.basename(opts.from));
    const relFromRepo = fromPosix;
    if (shouldIgnore(relFromMapping, relFromRepo, opts.exclude)) {
      return;
    }

    if (opts.dryRun) {
      console.log(`[dry-run] ${opts.from} -> ${opts.to} (1 file)`);
      return;
    }

    if (opts.backupDir && (await fs.pathExists(dstRoot))) {
      const backupTarget = path.join(opts.backupDir, opts.to);
      await fs.ensureDir(path.dirname(backupTarget));
      await fs.copy(dstRoot, backupTarget, { overwrite: true });
    }

    await fs.ensureDir(path.dirname(dstRoot));
    await fs.copyFile(srcRoot, dstRoot);
    console.log(`Synced: ${opts.from} -> ${opts.to} (1 file)`);
    return;
  }

  const allSrcFiles = await fg(['**/*'], { cwd: srcRoot, dot: true, onlyFiles: true });
  const srcFiles = allSrcFiles.filter(file => {
    const rel = toPosix(file);
    const relFromRepo = `${fromPosix}/${rel}`;
    return !shouldIgnore(rel, relFromRepo, opts.exclude);
  });

  if (opts.dryRun) {
    console.log(`[dry-run] ${opts.from} -> ${opts.to} (${srcFiles.length} files)`);
    return;
  }

  if (opts.backupDir && (await fs.pathExists(dstRoot))) {
    const backupTarget = path.join(opts.backupDir, opts.to);
    await fs.ensureDir(path.dirname(backupTarget));
    await fs.copy(dstRoot, backupTarget, { overwrite: true });
  }

  const dstFiles = (await fs.pathExists(dstRoot))
    ? await fg(['**/*'], { cwd: dstRoot, dot: true, onlyFiles: true })
    : [];
  const dstFiltered = dstFiles.filter(file => {
    const rel = toPosix(file);
    const relFromRepo = `${fromPosix}/${rel}`;
    return !shouldIgnore(rel, relFromRepo, opts.exclude);
  });

  const srcSet = new Set(srcFiles.map(toPosix));
  for (const file of dstFiltered) {
    if (!srcSet.has(toPosix(file))) {
      await fs.remove(path.join(dstRoot, file));
    }
  }

  for (const file of srcFiles) {
    const src = path.join(srcRoot, file);
    const dst = path.join(dstRoot, file);
    await fs.ensureDir(path.dirname(dst));
    await fs.copyFile(src, dst);
  }

  console.log(`Synced: ${opts.from} -> ${opts.to} (${srcFiles.length} files)`);
}

export async function syncMappings(opts: {
  repoDir: string;
  projectRoot: string;
  mappings: { from: string; to: string; skipIfExists?: boolean }[];
  exclude: string[];
  backupDir?: string;
  dryRun?: boolean;
}) {
  for (const m of opts.mappings) {
    await syncOneMapping({
      repoDir: opts.repoDir,
      projectRoot: opts.projectRoot,
      from: m.from,
      to: m.to,
      exclude: opts.exclude,
      backupDir: opts.backupDir,
      dryRun: opts.dryRun,
      skipIfExists: m.skipIfExists,
    });
  }
}
