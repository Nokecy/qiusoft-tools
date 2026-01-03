import path from 'path';
import fs from 'fs-extra';
import { spawnSync } from 'child_process';
import { findProjectRoot } from '../lib/config.js';
import { listSubmodules, resolveSubmodules } from '../lib/submodules.js';

export async function cmdSubmoduleList() {
  const items = listSubmodules();
  if (items.length === 0) {
    console.log('暂无可用子库。');
    return;
  }
  console.log('可用子库：');
  for (const item of items) {
    console.log(`- ${item.name} => ${item.url} (${item.path})`);
  }
}

export async function cmdSubmoduleAdd(options: {
  cwd: string;
  names: string[];
  all?: boolean;
  dryRun?: boolean;
}) {
  const projectRoot = findProjectRoot(options.cwd);
  if (!projectRoot) throw new Error('找不到 .shared-config.json（请在项目内执行）。');

  const names = options.all ? listSubmodules().map(item => item.name) : options.names;
  if (!names || names.length === 0) {
    throw new Error('请指定子库名称，或使用 --all。');
  }
  const modules = resolveSubmodules(names);

  if (options.dryRun) {
    console.log('[dry-run] 将添加以下子库：');
    for (const item of modules) {
      console.log(`- ${item.name} => ${item.url} (${item.path})`);
    }
    return;
  }

  ensureGitAvailable();
  ensureGitRepo(projectRoot);

  let added = 0;
  for (const item of modules) {
    const submodulePath = path.join(projectRoot, item.path);
    if (await fs.pathExists(submodulePath)) {
      console.log(`已存在，跳过: ${item.name} (${item.path})`);
      continue;
    }
    const add = spawnSync('git', ['submodule', 'add', '-f', item.url, item.path], {
      cwd: projectRoot,
      stdio: 'inherit',
    });
    if (add.status !== 0) {
      throw new Error(`子模块添加失败: ${item.name}`);
    }
    added += 1;
  }

  if (added > 0) {
    const update = spawnSync('git', ['submodule', 'update', '--init', '--recursive'], {
      cwd: projectRoot,
      stdio: 'inherit',
    });
    if (update.status !== 0) {
      throw new Error('子模块初始化失败，请检查网络或访问权限。');
    }
  }
}

function ensureGitAvailable() {
  const hasGit = spawnSync('git', ['--version'], { stdio: 'ignore' });
  if (hasGit.status !== 0) {
    throw new Error('未检测到 git，请先安装 git。');
  }
}

function ensureGitRepo(projectRoot: string) {
  const gitDir = path.join(projectRoot, '.git');
  if (fs.existsSync(gitDir)) return;
  const init = spawnSync('git', ['init'], { cwd: projectRoot, stdio: 'inherit' });
  if (init.status !== 0) {
    throw new Error('git init 失败，请检查 git 环境。');
  }
}
