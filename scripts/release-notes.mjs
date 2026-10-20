#!/usr/bin/env node
// Prints the CHANGELOG.md section for a version, for the GitHub release.
// Usage: node scripts/release-notes.mjs 0.2.0
import { readFileSync } from 'node:fs';

const version = (process.argv[2] ?? '').replace(/^v/, '');
const lines = readFileSync('CHANGELOG.md', 'utf8').split('\n');
const start = lines.findIndex(line => line.startsWith(`## [${version}]`));
if (!version || start === -1) {
  console.error(`CHANGELOG.md has no "## [${version}]" section`);
  process.exit(1);
}
const end = lines.findIndex((line, i) => i > start && line.startsWith('## ['));
const body = lines
  .slice(start + 1, end === -1 ? undefined : end)
  .join('\n')
  .replace(/^\[.*\]: .*$/gm, '')
  .trim();
if (!body) {
  console.error(`The CHANGELOG.md section for ${version} is empty`);
  process.exit(1);
}
console.log(body);
