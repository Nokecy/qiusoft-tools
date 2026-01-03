import fs from 'fs';
import path from 'path';

export type SharedConfig = {
  repo: string;
  ref?: string;
  tokenEnv?: string;
  lockFile?: string;
  manifestFile?: string;
  exclude?: string[];
};

export function findProjectRoot(cwd: string): string | null {
  let cur = path.resolve(cwd);
  while (true) {
    if (fs.existsSync(path.join(cur, '.shared-config.json'))) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
}

export function readSharedConfig(projectRoot: string): SharedConfig {
  const p = path.join(projectRoot, '.shared-config.json');
  const raw = fs.readFileSync(p, 'utf8');
  const cfg = JSON.parse(raw) as SharedConfig;

  cfg.ref ||= 'main';
  cfg.tokenEnv ||= 'GITHUB_TOKEN';
  cfg.lockFile ||= '.shared-lock.json';
  cfg.manifestFile ||= 'shared.manifest.json';
  cfg.exclude ||= [];

  if (!cfg.repo) {
    throw new Error('Invalid .shared-config.json: repo required.');
  }
  return cfg;
}
