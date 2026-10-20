#!/usr/bin/env node
// Sets the app version everywhere it is declared.
// Usage: node scripts/set-version.mjs 0.2.0
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version ?? '')) {
  console.error('usage: node scripts/set-version.mjs <major.minor.patch[-prerelease]>');
  process.exit(1);
}

// package.json and package-lock.json
execFileSync('npm', ['version', version, '--no-git-tag-version', '--allow-same-version'], {
  stdio: 'inherit',
});

// src-tauri/Cargo.toml ([package] is the first `version =` line); tauri.conf.json
// has no version of its own, so the bundles follow Cargo.
const cargoToml = 'src-tauri/Cargo.toml';
const toml = readFileSync(cargoToml, 'utf8');
writeFileSync(cargoToml, toml.replace(/^version = ".*"$/m, `version = "${version}"`));
execFileSync('cargo', ['update', '--offline', '-p', 'clipvault'], {
  cwd: 'src-tauri',
  stdio: 'inherit',
});

console.log(`Version set to ${version}. Next: update CHANGELOG.md, commit, then tag v${version}.`);
