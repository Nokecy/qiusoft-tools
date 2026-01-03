#!/usr/bin/env node
import { Command } from 'commander';
import { cmdUpdate } from './commands/update.js';
import { cmdSubmoduleAdd, cmdSubmoduleList } from './commands/submodule.js';

const program = new Command();

program.name('shared-cli').description('Sync shared code into projects').version('0.1.2');

program
  .command('update')
  .option('--ref <ref>', 'branch/tag/commit')
  .option('--check', 'only check if update is available')
  .option('--dry-run', 'show what would change')
  .option('--force', 'overwrite without backup')
  .option('--allow-dirty', 'allow git working tree dirty')
  .action(async opts => {
    await cmdUpdate({
      cwd: process.cwd(),
      ref: opts.ref,
      check: !!opts.check,
      dryRun: !!opts.dryRun,
      force: !!opts.force,
      allowDirty: !!opts.allowDirty,
    });
  });

const submodule = program.command('submodule').description('管理项目子库');

submodule
  .command('list')
  .description('列出可用子库')
  .action(async () => {
    await cmdSubmoduleList();
  });

submodule
  .command('add')
  .description('添加子库')
  .argument('[names...]', '子库名称')
  .option('--all', '添加全部子库')
  .option('--dry-run', '仅预览，不执行')
  .action(async (names: string[], opts: { all?: boolean; dryRun?: boolean }) => {
    await cmdSubmoduleAdd({
      cwd: process.cwd(),
      names,
      all: !!opts.all,
      dryRun: !!opts.dryRun,
    });
  });

program.parse();
