## Context

The openspec implementation of `git-standup` currently relies on the root-level
`tsconfig.json` (which includes `methodologies/*/src/**/*.ts`) and has no local
`package.json`. As a result, the only way to invoke the CLI is through
`node --import tsx src/cli.ts`, which requires knowing the internal project
structure. The `spec-kit` methodology — a sibling directory — already ships with
its own `package.json`, `tsconfig.json`, and a pre-built `dist/`, serving as a
reference implementation.

## Goals / Non-Goals

**Goals:**
- Add `methodologies/openspec/package.json` so the package is self-contained.
- Add `methodologies/openspec/tsconfig.json` that compiles `src/` → `dist/`
  locally, independent of the root config.
- Ensure `npm run build` inside `methodologies/openspec/` produces a working
  `dist/cli.js`.
- Ensure `npm test` inside `methodologies/openspec/` runs all unit and integration
  tests (same test command as today, but local).
- Update `bin/git-standup` shim to point at the local compiled `dist/cli.js`.
- Clean up root `package.json` by removing the `"bin"` and `"test"` entries
  that were added as a stopgap.

**Non-Goals:**
- Publishing to npm.
- Changing any runtime source code (`src/`).
- Changing any test logic or adding new tests.

## Decisions

### 1. Local `package.json` mirrors `spec-kit`

`spec-kit` is the reference implementation in this mono-repo. Its `package.json`
uses `"bin": { "git-standup": "dist/cli.js" }` and local `devDependencies`.
`openspec` will follow the same shape.

*Alternative considered*: Keep a single root-level package that manages all
methodologies. Rejected because it couples unrelated methodology packages and
makes per-methodology `npm install` / `npm run build` impossible.

### 2. Local `tsconfig.json` with `outDir: "dist"` and `rootDir: "src"`

The root tsconfig uses `rootDir: "."` and `outDir: "dist"` at the repo level,
which puts compiled output at `dist/methodologies/openspec/src/cli.js` — a deep
path unsuitable for a `bin` entry. A local tsconfig with `rootDir: "src"` and
`outDir: "dist"` produces `dist/cli.js`, matching the `bin` entry.

*Alternative considered*: Patch the root tsconfig with per-package output paths.
Rejected because `tsc` does not support multiple `outDir` values; it would require
project references, adding complexity.

### 3. `bin/git-standup` shim points to `./dist/cli.js`

After the local build, `dist/cli.js` is adjacent to `bin/`. The shim imports
`../dist/cli.js` (relative to the shim file). This matches the `spec-kit` pattern
exactly.

### 4. Root `package.json` cleanup

The root `package.json` received a `"bin"` and `"test"` entry as a temporary
measure during the first change. These are removed now that the local package
owns them. The root `tsconfig.json` can stay as-is (it still compiles
`methodologies/*/src/**/*.ts` for IDE support and typecheck).

## Risks / Trade-offs

- **Developers must `npm install` in two places** (root + `methodologies/openspec/`)
  → Mitigated by documenting this in the package's `README` (out of scope here)
  and matching the existing `spec-kit` pattern developers are already familiar with.

- **`tsx` is now a devDependency in two packages** (root and local) → Acceptable
  duplication; `tsx` is a small dev tool and both packages need it independently.

- **Root tsconfig still compiles openspec `src/`** → This is intentional; it
  provides IDE / typecheck support at the repo level. It does not conflict with the
  local build because `outDir` paths differ.
