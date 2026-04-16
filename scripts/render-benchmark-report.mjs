#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);
const { writeBenchmarkReport } = require('../src/format/benchmark-report');

const args = process.argv.slice(2);
const jsonOut = args.includes('--json');
const cwdIndex = args.indexOf('--cwd');
const targetCwd = cwdIndex >= 0 && args[cwdIndex + 1]
  ? path.resolve(args[cwdIndex + 1])
  : ROOT;

const result = writeBenchmarkReport(targetCwd);

if (jsonOut) {
  process.stdout.write(JSON.stringify({
    ok: true,
    file: result.file,
    summary: result.summary,
  }, null, 2) + '\n');
} else {
  process.stdout.write(`Benchmark HTML report written to ${result.file}\n`);
}
