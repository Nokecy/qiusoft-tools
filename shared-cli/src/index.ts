#!/usr/bin/env node
import { Command } from 'commander';
import { cmdUpdate } from './commands/update.js';

const program = new Command();

program.name('shared-cli').description('Sync shared code into projects').version('0.1.0');

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

program.parse();
