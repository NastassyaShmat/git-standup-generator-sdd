---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - FEATURE_SPEC.md
  - methodologies/bmad/_bmad-output/planning-artifacts/prd.md
  - methodologies/bmad/_bmad-output/planning-artifacts/product-brief-git-standup-generator.md
  - methodologies/bmad/_bmad-output/planning-artifacts/product-brief-git-standup-generator-distillate.md
workflowType: architecture
project_name: git-standup-generator
user_name: admin
date: "2026-04-27"
lastStep: 8
status: complete
completedAt: "2026-04-27"
---

# Architecture Decision Document: git-standup-generator

This document records solution architecture for the **git-standup-generator** CLI. **Scope, behavior, and data contracts are traceable to the repository root `FEATURE_SPEC.md` (single source of truth).** The PRD and product briefs provide planning context; they do not add features beyond the spec. Any proposed change to behavior or constraints is a **spec change** first, then implementation.

### Repository root vs BMAD package (this study repo)

In **`git-standup-generator-sdd`**, the **only** items that belong at the **repository root** (besides normal dotfiles and tooling a team may add) are:

- **`README.md`**
- **`FEATURE_SPEC.md`**
- **`package.json`** — workspace / study root manifest (orchestrates dev scripts; may use npm workspaces to include the BMAD package)
- **`tsconfig.json`** — **workspace** TypeScript configuration for the monorepo-style layout (e.g. `include` / project references)

**All BMAD-scoped product implementation** — **source, tests, build output, and the shippable CLI’s own** `package.json` and `tsconfig.json` — lives under **`methodologies/bmad/`**. That directory therefore contains a **second**, **package-local** `package.json` and `tsconfig.json` dedicated to **git-standup-generator** (NFR2: no **runtime** `dependencies` in that package). Planning and BMAD config remain under `methodologies/bmad/_bmad-output/`, `methodologies/bmad/_bmad/`, and skills under `methodologies/bmad/.agents/`, as in this repository.

This matches the project rule: *everything except the root README and feature spec* (plus the two root JS/TS project files above) is **under `methodologies/bmad`**.

---

## Roles and agents in the process

Delivery is not only code structure: **multiple roles** (human or **BMAD skills / agents**) participate. At least the following are part of the **architecture and implementation process** for this product:

1. **Requirements steward (PRD / product context)** — Uses workflows such as **`bmad-product-brief`** and **`bmad-create-prd`**. **Role:** keep planning artifacts (PRD, briefs) aligned with **`FEATURE_SPEC.md`**, call out scope drift, and record functional/non-functional requirements for downstream work. **Output consumers:** architecture and implementation.
2. **Solution architect (this document)** — Uses **`bmad-create-architecture`**. **Role:** turn PRD + **`FEATURE_SPEC.md`** into module boundaries, NFR-satisfying technology choices, repository layout, and consistency rules so implementations do not diverge. **Output:** `architecture.md` and traceability to the spec.
3. **Implementing developer (agent or human)** — Uses **`bmad-agent-dev`** (or equivalent) and the repo’s dev workflow. **Role:** implement the pipeline (`git-reader` → … → `cli`) and tests under **`methodologies/bmad/`** per the spec and this architecture, without adding out-of-spec features.
4. **Spec / quality reviewer (optional but recommended)** — Uses **`bmad-validate-prd`**, **`bmad-check-implementation-readiness`**, or **review** skills. **Role:** verify stories and code trace to **`FEATURE_SPEC.md`** and that NFR2 (no runtime npm deps) holds before merge.

Together, these roles preserve **SoT in `FEATURE_SPEC.md`**, **planning in BMAD outputs**, and **code colocated with `methodologies/bmad`**.

---

## Traceability to FEATURE_SPEC

| Spec area | Architecture handling |
| --- | --- |
| Pipeline: git-reader → commit-filter → commit-grouper → report-formatter; optional history-store | Module boundaries and source layout in [Project Structure & Boundaries](#project-structure--boundaries) — under **`methodologies/bmad/src/`** in this repo. |
| CLI flags and defaults | [Core Architectural Decisions](#core-architectural-decisions) — parsing, validation, `git` invocation. |
| Grouping (type / branch / path) and `other` bucket | [Core Architectural Decisions](#core-architectural-decisions) — groper invariants. |
| Output formats: text, markdown, JSON (including field names in examples) | [Implementation Patterns](#implementation-patterns--consistency-rules) and formatters. |
| NFR: &lt; 2s for up to ~10k commits, no runtime npm deps, cross-platform | [Core Architectural Decisions](#core-architectural-decisions) and [Architecture Validation](#architecture-validation-results). |
| Out of scope: multi-repo, chat, AI, web UI | Not addressed in structure (no components for these). |

---

## Project Context Analysis

### Requirements Overview

**Functional requirements (from PRD, grounded in `FEATURE_SPEC.md`):**

- **Report generation (FR1–FR4, FR14):** Single CLI entry orchestrates: resolve repo path → read commits via **git** → filter → group → format → write stdout or file; optional **configurable output template** at formatter layer.
- **Git scope (FR5–FR7):** `--repo`, `--since`, `--until`, `--author` with spec defaults; all time strings must be passed to **git** in a form `git` accepts.
- **Filtering (FR8–FR9):** Merge commits excluded; exclusion patterns (default and user) applied to commit **message** (and merge flag), consistent with the spec.
- **Grouping (FR10–FR11):** `type` uses conventional-commit regex and known prefixes; else **`other`**, full message preserved on entries. `branch` / `path` do not use `other` fallback; path uses first path segment of changed files.
- **Local history (FR12–FR13):** When `--save`, persist report; support **retrieval** of stored reports later (same tool / documented commands—implementation detail, but must satisfy “retrieved later”).

**Non-functional requirements:**

- **NFR1:** Design pipeline to stream or batch `git log` output efficiently; avoid unnecessary passes over full history beyond what `git` returns for the given range.
- **NFR2:** **No runtime `dependencies`** in the shipped artifact—only **Node.js built-in modules** (`node:*`) and the **git** binary on `PATH`. (Dev-time tools such as TypeScript are dev-only; see [Starter Template Evaluation](#starter-template-evaluation).)
- **NFR3:** **macOS, Linux, Windows (including WSL):** use `path` from `node:path`, avoid shell string composition for `git` arguments, spawn with argument arrays; normalize line endings in parsers if needed.
- **NFR4:** No network I/O for core behavior.

**Scale and complexity**

- **Domain:** Developer productivity CLI; **low** domain complexity.
- **Technical shape:** One process, no server, no DB; **local file(s)** for history only.
- **Primary components (from spec):** `git-reader`, `commit-filter`, `commit-grouper`, `report-formatter`, `history-store`, `cli`.

### Technical Constraints and Dependencies

- **External:** `git` executable on `PATH` (version assumed compatible with `git log` options used; document minimum expectations in implementation README if needed—without expanding product scope).
- **Runtime:** Node.js **Active or Maintenance LTS** even versions only for production use (e.g. **22.x** or **24.x** as of 2026—verify on `https://nodejs.org/en/about/releases/` at release time). **Minimum engine** (e.g. `>=20` or `>=22`) should match APIs used (`util.parseArgs` requires Node 18+).
- **Types:** The spec’s **TypeScript interfaces** are the **logical** contract; serialized **JSON** must match **`FEATURE_SPEC.md` example keys** (e.g. `total_commits` in JSON).

### Cross-Cutting Concerns

- **Error handling:** User-facing errors for bad repo, git failure, invalid args; non-zero exit codes (convention fixed in implementation patterns).
- **Testing:** Unit tests per stage; integration tests with fixture repos or `git` commands in temp dirs.
- **Observability:** Optional stderr diagnostics; no requirement for external telemetry (out of spec).

---

## Starter Template Evaluation

### Primary technology domain

**CLI tool (Node.js)** with **zero runtime npm dependencies** per `FEATURE_SPEC.md`. This **excludes** popular CLI frameworks that add runtime `dependencies` (e.g. **oclif**, **commander**, **yargs** as **runtime** deps).

### Options considered

| Option | Verdict |
| --- | --- |
| **oclif / Caporal / similar** | Rejected for **default** architecture: would violate NFR2 unless build strips deps to zero (non-standard). |
| **TypeScript + tsc + `node:`-only runtime** | **Selected:** spec already uses TypeScript types; compile to JS; **runtime** uses only `node:*`. |
| **Plain JavaScript** | Valid; team may prefer TS for maintainability; same runtime rules. |

### Selected approach: minimal npm package + TypeScript (dev) + built-ins at runtime

**Rationale:** Satisfies NFR2 while keeping type alignment with the spec. **No third-party code** in the **running** binary/package—only `node:*` and spawning `git`.

**Initialization (first implementation story):**

- In **`methodologies/bmad/`**, add **`package.json`** and **`tsconfig.json`** for the **CLI package** (separate from the **repository root** `package.json` / `tsconfig.json`, which remain workspace-level for this study repo).
- Package with `"type": "module"` (or CommonJS—pick one in [Implementation Patterns](#implementation-patterns--consistency-rules) and keep it consistent).
- **`dependencies`:** empty (or omitted).
- **`devDependencies`:** `typescript`, `@types/node` (and test runner as needed—e.g. `node:test` built-in for tests).
- **Bin:** `methodologies/bmad/package.json` `bin` mapping to compiled CLI entry (e.g. `dist/cli.js` relative to that package).
- **Root** `package.json` may use **`workspaces`** (e.g. `"workspaces": ["methodologies/bmad"]`) or npm scripts that `cd` into `methodologies/bmad` to build—choose one and document in root README.

**Example (illustrative):**

```bash
cd methodologies/bmad
npm init -y
# Add devDependencies: typescript, @types/node; configure tsconfig.json; no runtime deps in this package's dependencies
```

**Architectural decisions “from starter”:**

- **Language:** TypeScript source, JavaScript output.
- **CLI parsing:** `util.parseArgs` from `node:util` (Node 18+) or equivalent minimal argv parsing with **built-ins only**.
- **Git:** `child_process.spawn` / `execFile` with **argument array** (no shell).

**Note:** First implementation task should be “scaffold package + tsc + single `git log` smoke run,” then slice modules per spec.

---

## Core Architectural Decisions

### Decision priority

**Critical (block implementation if vague)**

1. **Runtime dependency rule:** Shipped code must not `import` / `require` any npm package at runtime; only `node:*` and dynamic checks for `git`.
2. **JSON wire format:** Public JSON output matches **field names and nesting** in `FEATURE_SPEC.md` (e.g. `total_commits`, `period.since` as strings where shown)—not only the TypeScript interface names.
3. **Group keys:** `type` mode: recognized conventional prefixes + `other`; `branch` and `path` modes: no `other` label; path uses **first segment** of changed file paths.
4. **Git integration:** All log data comes from `git` subprocess; parser consumes stable, documented `git log` format (e.g. `--format` with delimiters) to build `GitCommit` fields.

**Important**

- **Template:** “Configurable output template” implemented inside **report-formatter** (e.g. string template or small substitution DSL); template location/format is implementation detail as long as behavior remains spec-bound.
- **History storage:** **Append-only or indexed local store** under a documented base path (e.g. user config / repo-local store); format JSON or JSONL; must support **list + read** for “retrieve later” without new product features.
- **Performance:** Single pass over **parsed** commits in memory for filter/group/format; rely on `git` to limit by `--since`/`--until`/`--author` so the tool does not scan 10k commits if `git` can narrow—still meet **&lt; 2s** for spec’d scenario on representative hardware.

**Deferred / N/A (not in spec)**

- Authentication, multi-tenancy, REST/GraphQL, web frontend, cloud deployment—**not applicable** to this CLI’s scope.

### Data and processing

- **No database.** In-memory `GitCommit[]` / grouped structures between stages.
- **History persistence:** File-based only; no network sync.

### Security

- **No auth.** Trust model: same user as local git; no secrets in reports beyond what git already exposes in log.
- **Path handling:** Resolve `--repo` to absolute path; reject path traversal in template paths if templates load from files.

### CLI and I/O

- **Input:** process argv + environment (`cwd`, optional `git` config for default author when implementing default author behavior).
- **Output:** stdout or `--output` file; **stderr** for errors and optional warnings.

### Version policy

- **Node:** Document **engines** in `package.json` aligned with LTS; CI matrix on **Linux + Windows** at minimum.
- **Git:** Document that **git** is required; if specific `git log` features are used, state minimum **git** version in README (implementation detail).

### Decision impact and order

1. Define **serialized JSON shape** and **internal** types mapping.
2. Implement **git-reader** (format + parser).
3. **commit-filter** → **commit-grouper** (needs file list for path grouping—**git-reader** must supply changed paths per commit).
4. **report-formatter** (text / markdown / JSON + template).
5. **history-store** + CLI wiring for `--save` and list/read.
6. **cli** integration and E2E tests.

**Cross-dependencies:** `commit-grouper` in `path` mode requires **file path lists** from git (`git show` / `name-status` in log or separate command)—architecture requires **one coherent strategy** in git-reader to obtain paths **without** unbounded performance regressions (e.g. batch or reuse log metadata).

---

## Implementation Patterns & Consistency Rules

### Critical conflict points (AI/agent alignment)

- **Module vs spec names:** Under **`methodologies/bmad/src/`**, folders align with **git-reader, commit-filter, commit-grouper, report-formatter, history-store, cli** (kebab-case `src/<name>/`—pick one style and keep).
- **JSON vs TS types:** Internal code may use camelCase; **JSON formatter** must emit **exactly** the spec’s example field names for machine output.
- **Date strings:** Use **ISO 8601** strings where the spec shows them (`timestamp`, `period` fields) when emitting JSON; text/markdown date lines follow spec examples (`Standup Report — YYYY-MM-DD`).

### Naming patterns

- **Code:** `camelCase` for variables/functions in TypeScript; `PascalCase` for types; **file names** `kebab-case.ts` *or* `camelCase.ts`—choose one project-wide (recommended: `kebab-case` for files under `src/`).
- **CLI flags:** As in `FEATURE_SPEC.md` (e.g. `--group-by`, `--save`); long options only unless spec is extended.
- **Groups:** String keys for type groups: conventional types or **`other`**.

### Structure patterns

- **Tests:** Co-locate `*.test.ts` next to source **or** `methodologies/bmad/test/` mirroring `src/`—one convention only.
- **Config:** **`methodologies/bmad/tsconfig.json`** defines compilation for the CLI package; **repository root** `tsconfig.json` may only orchestrate workspace/project references. No runtime `.env` required for core behavior.

### Format patterns

- **Text/Markdown:** Headings and bullets as in spec examples; configurable template must not break required sections unless spec is updated.
- **JSON:** `snake_case` keys in output objects where the spec’s JSON example uses them (`total_commits`, etc.).

### Error handling

- **Non-zero exit** on failure (e.g. `1`); subcodes optional.
- **Messages** clear and single-line when possible; no stack traces to stdout in normal use.

### Enforcement (agents)

- **MUST** enforce zero runtime `dependencies` in **`methodologies/bmad/package.json`** before merge (lint script or CI check).
- **MUST** not add npm packages to that package’s `dependencies` without updating `FEATURE_SPEC.md` (which currently forbids it).
- **MUST** map PRD/FR to modules and tests under **`methodologies/bmad/`**; **MUST NOT** add Slack, multi-repo, AI, or web UI without spec change.
- **MUST** place new implementation files under **`methodologies/bmad/`** (not the repo root), except **`README.md`**, **`FEATURE_SPEC.md`**, and the **root** `package.json` / `tsconfig.json` as agreed.

### Examples

- **Good:** `import { parseArgs } from 'node:util'`; `import { spawn } from 'node:child_process'`.
- **Anti-pattern:** `import minimist from 'minimist'` in runtime path.
- **Anti-pattern:** JSON `summary.totalCommits` in public output (spec example uses `total_commits`).

---

## Project Structure & Boundaries

### Complete project directory structure (this repository)

**Repository root** — minimal surface; spec and workspace glue only:

```text
{project-root}/
├── README.md
├── FEATURE_SPEC.md                    # SoT; stays at repo root
├── package.json                      # study workspace (optional workspaces → methodologies/bmad)
├── tsconfig.json                     # workspace TS: may reference methodologies/bmad
└── methodologies/
    └── bmad/
        ├── package.json              # git-standup-generator CLI: dependencies {} at runtime
        ├── tsconfig.json             # outDir, include: src/** — package-local build
        ├── src/
        │   ├── cli/
        │   │   └── index.ts         # argv, orchestration, exit codes
        │   ├── git-reader/
        │   │   └── ...              # git subprocess, parse → GitCommit[]
        │   ├── commit-filter/
        │   │   └── ...
        │   ├── commit-grouper/
        │   │   └── ...
        │   ├── report-formatter/
        │   │   ├── text.ts
        │   │   ├── markdown.ts
        │   │   ├── json.ts
        │   │   └── template.ts
        │   ├── history-store/
        │   │   └── ...
        │   └── types.ts
        ├── dist/                    # build output (gitignored); relative to bmad package
        ├── test/
        │   ├── fixtures/
        │   └── ...
        ├── .agents/                 # BMAD skills (existing)
        ├── _bmad/                   # BMAD config, scripts
        └── _bmad-output/
            └── planning-artifacts/
                ├── architecture.md  # this file
                ├── prd.md
                └── ...
```

**Rules:**

- **Do not** place `src/`, `dist/`, or CLI `test/` at `{project-root}` for the BMAD delivery line; they belong under **`methodologies/bmad/`**.
- **Root** `package.json` / `tsconfig.json` exist **only** as the study/workspace entry; the **shippable** package metadata for the spec’d CLI is **`methodologies/bmad/package.json`**.

### Architectural boundaries

| Boundary | Rule |
| --- | --- |
| **git-reader** | Only module that invokes **git**; exposes structured commits + metadata needed for grouping (branch, file paths, merge flag). |
| **commit-filter** | Pure over `GitCommit[]`; no I/O. |
| **commit-grouper** | Pure; no I/O; input includes commits + `groupBy` mode. |
| **report-formatter** | Maps grouped data + `StandupReport` to strings / JSON; **template** only here. |
| **history-store** | Only module that reads/writes **history** files (besides optional `--output`). |
| **cli** | Wires order: reader → filter → grouper → formatter → stdout/file → optional store. |

### FR → location mapping

| FR range | Where (under `methodologies/bmad/src/`) |
| --- | --- |
| FR1–FR4, FR14 | `cli/`, `report-formatter/` |
| FR5–FR7 | `cli/`, `git-reader/` |
| FR8–FR9 | `commit-filter/`, `git-reader/` (merge detection) |
| FR10–FR11 | `commit-grouper/` |
| FR12–FR13 | `history-store/`, `cli/` |

### Data flow (implementation view)

```text
argv → cli → git-reader → commit-filter → commit-grouper → report-formatter → stdout | file
                                                        ↘ history-store (if --save)
```

**External integration:** **git** CLI only. No other external services.

---

## Architecture Validation Results

### Coherence

- **Decisions** align: **no** runtime deps + **TypeScript** build + **git** subprocess is consistent.
- **Patterns** (JSON field names, module boundaries) support the NFRs and the spec’s examples.
- **Structure** gives each spec module a home under **`methodologies/bmad/src/`** and a single **git** gateway, consistent with the **root vs BMAD** layout rule.

### Requirements coverage

| Area | Supported? |
| --- | --- |
| FR1–FR14 (PRD) | Yes, via pipeline and stores above; template and history explicitly assigned. |
| NFR1–NFR4 | Yes: performance strategy, empty `dependencies`, cross-platform process spawn, no network. |
| `FEATURE_SPEC.md` success criteria 1–5 | Yes, with tests anchored to spec examples. |

### Implementation readiness

- **Decisions** are specific enough for agents to implement without inventing product scope.
- **Gaps** acceptable: exact **template** syntax and **history** file path are **implementation** choices if they satisfy FR4 and FR12–FR13; prefer documenting them in the implementation README in the same PR as code.

### Gap analysis

- **None critical** for starting implementation.
- **Minor:** Minimum **git** version and exact **template** file format can be specified during implementation (not expanding features).

### Architecture readiness

**Status:** **READY FOR IMPLEMENTATION**  
**Confidence:** **High** for implementation under **`methodologies/bmad/`** following `FEATURE_SPEC.md`.  
**Strengths:** Clear pipeline, strict NFR2 interpretation, JSON/example alignment, **roles/agents** and **path conventions** defined.  
**Future (spec change only):** integrations, web UI, AI—explicitly out of scope in architecture.

### Handoff to implementation

- Follow this document and **`FEATURE_SPEC.md`** for all behavior; implement in **`methodologies/bmad/src/`** using **`methodologies/bmad/package.json`** (runtime `dependencies: {}`).
- **First priority:** add **`methodologies/bmad/package.json`** + **`tsconfig.json`**, wire root workspace if needed, then **no-runtime-deps** build + one successful `git log` read into parsed commits, then fill modules.

---

# Workflow status

- **Completed:** `bmad-create-architecture` steps 1–8 (end-to-end with user-directed **Continue** on all interactive gates).
- **Output:** This file at `methodologies/bmad/_bmad-output/planning-artifacts/architecture.md`.
- **Next:** Implementation work and user stories should trace to **`FEATURE_SPEC.md`**; optional `bmad-help` for methodology navigation if used in this repo.
