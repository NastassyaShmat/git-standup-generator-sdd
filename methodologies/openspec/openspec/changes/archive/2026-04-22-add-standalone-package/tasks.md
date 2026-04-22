# Tasks

All changes are relative to `methodologies/openspec/` unless noted otherwise.

## 1. Local `tsconfig.json`

- [x] 1.1 Create `tsconfig.json` at `methodologies/openspec/` with
      `rootDir: "src"`, `outDir: "dist"`, `module: "Node16"`,
      `moduleResolution: "Node16"`, `target: "ES2022"`, `strict: true`,
      `include: ["src/**/*.ts"]` — mirroring `spec-kit/tsconfig.json`.

## 2. Local `package.json`

- [x] 2.1 Create `package.json` at `methodologies/openspec/` with:
      - `"name": "git-standup-openspec"`, `"version": "0.1.0"`,
        `"type": "module"`, `"private": true`
      - `"bin": { "git-standup": "bin/git-standup" }`
      - `"scripts": { "build": "tsc", "test": "node --import tsx --test 'tests/**/*.test.ts'", "typecheck": "tsc --noEmit" }`
      - `"devDependencies"` with `typescript`, `@types/node`, `tsx`
        (use same version ranges as `spec-kit/package.json`)

## 3. Update `bin/git-standup` shim

- [x] 3.1 Update `bin/git-standup` to import from `../dist/cli.js`
      (relative to the shim file inside `methodologies/openspec/bin/`),
      replacing the current path that pointed at the root-level dist output.
- [x] 3.2 Verify the shim file has `#!/usr/bin/env node` on line 1
      and is executable (`chmod +x`).

## 4. Root `package.json` cleanup

- [x] 4.1 Remove the `"bin"` entry (`"git-standup": "methodologies/openspec/bin/git-standup"`)
      from the root `package.json`.
- [x] 4.2 Remove the `"test"` script from the root `package.json`
      (it referenced `methodologies/openspec/tests`).

## 5. Install and verify

- [x] 5.1 Run `npm install` inside `methodologies/openspec/` to install
      local `devDependencies`.
- [x] 5.2 Run `npm run build` inside `methodologies/openspec/` and confirm
      `dist/cli.js` is produced.
- [x] 5.3 Run `node dist/cli.js --since "1 year ago"` inside
      `methodologies/openspec/` and confirm a standup report is printed.
- [x] 5.4 Run `npm test` inside `methodologies/openspec/` and confirm all
      tests pass.
