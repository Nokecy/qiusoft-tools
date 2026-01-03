import path from 'path';
import fs from 'fs-extra';

export type SharedMapping = { from: string; to: string };

export type SharedManifest = {
  includes: SharedMapping[];
  exclude?: string[];
};

export async function readManifest(repoDir: string, manifestFile = 'shared.manifest.json'): Promise<SharedManifest> {
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
