## Why

The `git-standup` CLI currently lives inside a mono-repo that uses a shared root
`tsconfig.json` and has no local `package.json`. This forces users to invoke the
tool through `node --import tsx src/cli.ts` rather than a clean compiled binary,
making the tool hard to discover, run, and distribute. The `spec-kit` methodology
in the same repo already ships as a proper standalone Node package — `openspec`
should follow the same pattern for consistency and usability.

## What Changes

- Add `methodologies/openspec/package.json` with its own `name`, `bin`,
  `scripts` (`build`, `test`, `lint`), and `devDependencies` (`tsx`, `typescript`,
  `@types/node`).
- Add `methodologies/openspec/tsconfig.json` that compiles `src/` → `dist/`
  locally (independent of the root tsconfig).
- Update `bin/git-standup` shim to reference the local `dist/cli.js` path
  correctly after the local build.
- Remove the `"bin"` and `"test"` entries that were added to the root
  `package.json` as part of the previous change (they now live in the local
  package). **BREAKING** for anyone who relied on the root-level bin.

## Capabilities

### New Capabilities

- `package-setup`: Standalone Node.js package configuration for the openspec
  implementation — local `package.json`, `tsconfig.json`, build and test scripts,
  so the CLI can be built and run with `npm run build && node dist/cli.js` from
  `methodologies/openspec/`.

### Modified Capabilities

*(none — no existing spec-level behavior changes)*

## Impact

- `methodologies/openspec/package.json` — new file
- `methodologies/openspec/tsconfig.json` — new file
- `methodologies/openspec/bin/git-standup` — updated shim path
- Root `package.json` — `"bin"` and `"test"` entries removed
- Developers must run `npm install` inside `methodologies/openspec/` before
  building or testing
