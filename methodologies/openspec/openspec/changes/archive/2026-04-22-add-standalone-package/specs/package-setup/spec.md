# Delta for package-setup

## ADDED Requirements

### Requirement: Standalone Package Configuration
The openspec implementation SHALL be configured as a self-contained Node.js
package with its own `package.json` and `tsconfig.json` inside
`methodologies/openspec/`, enabling independent install, build, and run without
knowledge of the root mono-repo structure.

#### Scenario: Build the CLI locally
- **WHEN** a developer runs `npm run build` inside `methodologies/openspec/`
- **THEN** TypeScript source files in `src/` are compiled to `dist/`
- **AND** `dist/cli.js` is produced at the root of the `dist/` directory

#### Scenario: Run the CLI after build
- **WHEN** `dist/cli.js` exists
- **THEN** the CLI can be invoked with `node dist/cli.js [flags]`
- **AND** the tool produces the same output as when invoked via `tsx`

#### Scenario: Run tests locally
- **WHEN** a developer runs `npm test` inside `methodologies/openspec/`
- **THEN** all unit and integration tests execute
- **AND** the test command does not require the root `node_modules`

### Requirement: Binary Shim Correctness
The `bin/git-standup` shim SHALL reference the locally compiled `dist/cli.js`
so that `npm link` or `npx` resolves to the built binary.

#### Scenario: Shim resolves after build
- **WHEN** the package is built (`npm run build`) and linked (`npm link`)
- **THEN** executing `git-standup` from any directory invokes `dist/cli.js`
- **AND** the process exits 0 with a valid standup report when run in a git repo

#### Scenario: Shim is executable
- **WHEN** `bin/git-standup` is installed as a binary entry point
- **THEN** the file has a `#!/usr/bin/env node` shebang on line 1
- **AND** the file is executable (`chmod +x`)

### Requirement: Root Package Cleanup
The root `package.json` SHALL NOT contain a `"bin"` entry or a `"test"` script
that references the openspec methodology, as those responsibilities now belong
to the local package.

#### Scenario: Root package has no openspec bin entry
- **WHEN** the root `package.json` is inspected
- **THEN** there is no `"git-standup"` key under `"bin"`

#### Scenario: Root test script does not run openspec tests
- **WHEN** the root `package.json` is inspected
- **THEN** the `"test"` script (if present) does not reference
  `methodologies/openspec/tests`
