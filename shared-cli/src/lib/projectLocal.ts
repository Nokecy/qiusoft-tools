import path from 'path';
import fs from 'fs-extra';

export async function ensureProjectLocal(opts: {
  repoDir: string;
  projectRoot: string;
  relativePath?: string;
}) {
  const relativePath = opts.relativePath || path.join('config', 'project.local.ts');
  const target = path.join(opts.projectRoot, relativePath);
  if (await fs.pathExists(target)) return;

  const source = path.join(opts.repoDir, relativePath);
  if (!(await fs.pathExists(source))) return;

  await fs.ensureDir(path.dirname(target));
  await fs.copyFile(source, target);
}
