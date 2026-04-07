<!--
  SYNC IMPACT REPORT
  ==================
  Version change: 1.0.2 → 2.0.0
  Rationale: MAJOR — multiple principles materially relaxed to match solo-developed CLI
  project scale; implementation prescriptions moved to tooling config, not constitution.

  Modified principles:
    - II  TypeScript Strict Mode — ES2022 — Node16
          → TypeScript Strict Mode
          Removed: compiler target, module resolution, .js extension rule, specific tsconfig
          flags. Kept: TypeScript MUST, strict mode MUST, `any` forbidden.
    - IV  Cross-Platform — macOS, Linux, Windows (WSL)
          Removed: path.join rule, shell:false rule, path.posix rule, LF line ending rule,
          CI runner prescription. Kept: platform scope declaration.
    - V   Single Responsibility — Pure Functions Where Possible
          Removed: constitutional lock on module list ("no additional modules without
          amendment"), no-restricted-imports linting rule. Kept: single-responsibility
          principle, pure-function requirement, I/O boundary rule.
    - VI  Test Coverage — Unit + Integration
          Relaxed: hard 90% coverage gate replaced with "meaningful coverage enforced via
          CI configuration". Kept: unit + integration test requirement.
  Modified sections:
    - Governance: removed formal PR-review-approval amendment procedure; replaced with
      lightweight solo-dev process (edit file, bump version, document rationale).
  Added sections: none
  Removed sections: none
  Templates requiring updates:
    - .specify/templates/plan-template.md  ✅ No changes needed
    - .specify/templates/spec-template.md  ✅ No changes needed
    - .specify/templates/tasks-template.md ✅ No changes needed
  Follow-up TODOs: none
-->

# git-standup-generator Constitution

## Core Principles

### I. Zero External Dependencies

The tool MUST ship with zero npm runtime dependencies. All functionality is implemented using
Node.js built-in modules and the git CLI available in PATH.

**Rationale.** A standup generator is a productivity tool installed on developer machines.
Every external dependency is a supply-chain risk, an additional install step, and a source of
version drift. Shipping with only built-ins guarantees the tool runs on any supported Node.js
environment without additional setup.

**Rule.** `package.json` MUST declare zero `dependencies`. `devDependencies` (TypeScript,
test runner, linter) are permitted.

### II. TypeScript Strict Mode

All source files MUST be TypeScript with strict mode enabled. The use of `any` is forbidden.

**Rationale.** Strict TypeScript catches the most common JavaScript bugs at compile time and
makes the codebase self-documenting through its type system. Banning `any` ensures type
coverage is genuine, not decorative.

### III. Performance Envelope — < 2 s / 10 000 Commits

End-to-end execution MUST complete in under 2 seconds for a repository containing up to
10 000 commits, measured on a mid-range developer laptop.

**Rationale.** The tool is run interactively each morning. Latency above 2 seconds degrades
the developer experience and discourages use.

**Rules.**
- `git log` MUST be invoked exactly once per execution with all required filters applied as
  git-native flags. A second `git log` invocation for the same range is forbidden.
- Grouping and formatting MUST operate on the in-memory commit array; no additional subprocess
  calls are permitted during those phases.

### IV. Cross-Platform — macOS, Linux, Windows (WSL)

The tool MUST behave correctly on macOS, Linux, and Windows Subsystem for Linux (WSL2).
Native Windows (PowerShell / cmd.exe) is explicitly out of scope.

**Rationale.** Developer teams use heterogeneous environments. A tool that fails silently on
one platform erodes trust and creates maintenance burden.

### V. Single Responsibility — Pure Functions Where Possible

Each source module MUST have exactly one clearly named responsibility. Modules MUST NOT reach
across I/O boundaries: data-transformation modules do not call `git` or touch the filesystem.

Functions that transform data (filter, group, format) MUST be implemented as pure functions:
same input → same output, no side effects, no shared state. Only modules explicitly responsible
for I/O (`git-reader`, `history-store`, `cli`) are permitted to perform I/O.

**Rationale.** Single responsibility makes each module independently testable and replaceable.
Pure functions are trivially unit-testable without mocks or stubs. The module map in
`FEATURE_SPEC.md § Core Modules` is the authoritative starting point and may evolve as the
project grows.

### VI. Test Coverage — Unit + Integration

Business-logic modules MUST have meaningful unit tests. The full pipeline MUST have at least
one integration test that runs against a real (fixture) git repository.

**Rationale.** The business-logic modules contain the core value of the tool. Regressions in
filtering, grouping, or formatting are invisible without automated coverage. Integration tests
catch wiring bugs that unit tests cannot.

**Rules.**
- Unit tests cover all business-logic modules (`commit-filter`, `commit-grouper`,
  `report-formatter`).
- At least one integration test creates a temporary git repository with a known commit
  fixture set, invokes the pipeline, and asserts the output.
- Coverage percentage is enforced via CI configuration, not this document.
- Tests MUST NOT require network access or any environment variable beyond `PATH`.

## Technology Stack

| Concern | Decision |
|---------|----------|
| **Language** | TypeScript (strict mode) |
| **Runtime** | Node.js ≥ 18 (LTS) |
| **Runtime dependencies** | None — Node.js built-ins + git CLI only |
| **Dev dependencies** | TypeScript compiler, test runner, ESLint |
| **git interface** | `child_process.spawn` with `git log --format=<format>` |
| **Output targets** | `stdout` (default), file path via `--output` |
| **Persistence** | Single JSON file in `~/.git-standup/history.json` |
| **Platforms** | macOS 12+, Ubuntu 20.04+, WSL2 (Windows 10/11) |

## Development Workflow

- **Branches**: feature branches off `main`; one branch per spec feature.
- **Commits**: free-form commit messages. No conventional commit format is required.
- **CI gates**: type-check, lint, tests, build. All gates MUST pass before merge.
- **Spec-first**: No implementation work begins without a corresponding `spec.md` and
  `plan.md` committed.
- **Constitution compliance**: The `## Constitution Check` section in every `plan.md` MUST
  verify all six principles explicitly before the plan is approved.

## Governance

This constitution supersedes all other project-level guidelines. In the event of conflict
between this document and any README, inline comment, or ad-hoc convention, the constitution
takes precedence.

**Amendment procedure.** Edit this file directly, bump the version per the versioning policy,
and document the rationale in the Sync Impact Report at the top of the file.

**Versioning policy.**
- MAJOR: A principle is removed or its non-negotiable rule is materially relaxed.
- MINOR: A new principle or mandatory section is added.
- PATCH: Clarifications, examples, wording fixes with no semantic change.

**Compliance review.** The `## Constitution Check` section of every `plan.md` MUST reference
each of the six principles and confirm compliance or document a justified deviation before
implementation tasks are generated.

**Version**: 2.0.0 | **Ratified**: 2026-04-07 | **Last Amended**: 2026-04-07
