import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

export function hasGitDir(projectRoot: string): boolean {
  return fs.existsSync(path.join(projectRoot, '.git'));
}

export function isGitDirty(projectRoot: string, paths?: string[]): boolean {
  if (!hasGitDir(projectRoot)) return false;
  const args = ['status', '--porcelain'];
  if (paths && paths.length > 0) {
    args.push('--', ...paths);
  }
  const stdout = execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8' });
  return stdout.trim().length > 0;
}
