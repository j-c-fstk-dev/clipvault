# Releasing ClipVault

Releases are built and published by
[`.github/workflows/release.yml`](.github/workflows/release.yml) when a
`v*` tag is pushed. The workflow:

1. checks that the tag matches the version in `package.json` and
   `src-tauri/Cargo.toml`,
2. runs the tests,
3. builds the `.deb` and the AppImage on Ubuntu 22.04,
4. installs and launches both as a smoke test,
5. publishes a GitHub release with the packages, `SHA256SUMS` and the
   matching `CHANGELOG.md` section as release notes.

Tags with a suffix, like `v0.2.0-beta.1`, become pre-releases.

## Steps

1. Pick the version ([semver](https://semver.org/)): bug fixes bump the
   patch, new features the minor.
2. Set it everywhere:

   ```bash
   node scripts/set-version.mjs 0.2.0
   ```

3. In `CHANGELOG.md`, rename `## [Unreleased]` to `## [0.2.0] - YYYY-MM-DD`,
   add a fresh empty `## [Unreleased]` above it and update the links at the
   bottom.
4. Commit (`Release v0.2.0`), open a pull request and merge it into `main`.
   Pull requests that touch packaging run the release build as a dry run;
   the packages are attached to the workflow run as an artifact.
5. Tag the merged commit and push the tag:

   ```bash
   git checkout main && git pull
   git tag v0.2.0
   git push origin v0.2.0
   ```

6. Follow the **Release** workflow in the Actions tab. When it finishes, the
   release is on the [Releases](https://github.com/j-c-fstk-dev/clipvault/releases)
   page.

## If the release build fails

Nothing is published unless every step passes. Fix the problem, then move
the tag to the fixed commit:

```bash
git push --delete origin v0.2.0
git tag -f v0.2.0 <fixed-commit>
git push origin v0.2.0
```

## Trying a build without releasing

Run the **Release** workflow manually from the Actions tab
(*Run workflow*). It builds and smoke-tests the packages and attaches them
to the run, but only tag pushes publish a release.
