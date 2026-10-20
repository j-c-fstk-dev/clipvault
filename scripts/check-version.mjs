#!/usr/bin/env node
// Fails unless package.json and src-tauri/Cargo.toml both declare the
// version in the given tag. Usage: node scripts/check-version.mjs v0.2.0
import { readFileSync } from 'node:fs';

const tag = process.argv[2] ?? '';
const expected = tag.replace(/^v/, '');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')).version;
const cargo = readFileSync('src-tauri/Cargo.toml', 'utf8').match(/^version = "(.*)"$/m)?.[1];

const mismatches = [
  ['package.json', pkg],
  ['src-tauri/Cargo.toml', cargo],
].filter(([, version]) => version !== expected);

if (!expected || mismatches.length) {
  for (const [file, version] of mismatches) {
    console.error(`${file} has version ${version}, but the tag is ${tag || '(missing)'}`);
  }
  console.error(`Run: node scripts/set-version.mjs ${expected || '<version>'}`);
  process.exit(1);
}
console.log(`Version ${expected} matches the tag.`);
