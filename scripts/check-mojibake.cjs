#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const IGNORE_DIRS = new Set(['.git', '.next', 'node_modules']);
const TEXT_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.yml', '.yaml']);
const BAD_PATTERNS = ['�', 'Ã', 'Â', 'â€™', 'â€œ', 'â€'];

let hasIssue = false;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) {
        walk(path.join(dir, entry.name));
      }
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (!TEXT_EXT.has(path.extname(entry.name))) {
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    for (const pattern of BAD_PATTERNS) {
      if (content.includes(pattern)) {
        console.error(`Potential mojibake '${pattern}' in ${path.relative(ROOT, fullPath)}`);
        hasIssue = true;
        break;
      }
    }
  }
}

walk(ROOT);

if (hasIssue) {
  process.exit(1);
}

console.log('Encoding check passed.');
