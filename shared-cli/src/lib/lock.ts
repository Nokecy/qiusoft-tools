import path from 'path';
import fs from 'fs-extra';

export type SharedLock = {
  repo: string;
  ref: string;
  resolvedSha: string | null;
  updatedAt: string;
};

export async function readLock(projectRoot: string, lockFile: string): Promise<SharedLock | null> {
  const p = path.join(projectRoot, lockFile);
  if (!(await fs.pathExists(p))) return null;
  return await fs.readJSON(p);
}

export async function writeLock(projectRoot: string, lockFile: string, lock: SharedLock) {
  const p = path.join(projectRoot, lockFile);
  await fs.writeJSON(p, lock, { spaces: 2 });
}
