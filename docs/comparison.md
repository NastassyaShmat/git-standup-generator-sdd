# Workflow Comparison: Spec Kit vs OpenSpec vs Kiro

Practical observations from implementing the same feature — `git-standup-generator` —
using all three approaches. Differences that compare Spec Kit and OpenSpec are
grounded in concrete steps from those sessions, not in documentation claims alone.
The three subsections that follow—**Spec Kit**, **OpenSpec**, and **Kiro**—each
cover how that track felt to drive, what spec artifacts look like, and a short
**implementation review** of the code under `methodologies/spec-kit/`,
`methodologies/openspec/`, and `methodologies/kiro/`. All three implementations
are **TypeScript** on Node with `tsc` → `dist/`, so the **stack is comparable**;
the differentiators are process and tooling, not the language.

---

## Setup

| | Spec Kit | OpenSpec | Kiro |
|---|---|---|---|
| **Artifacts produced** | `spec.md`, `plan.md`, `tasks.md` (+ optional `research.md`, `data-model.md`, `checklists/`) | `proposal.md`, `design.md`, `specs/**/*.md`, `tasks.md` | Steering: `product.md`, `tech.md`, `structure.md`; per-feature: `requirements.md`, `design.md`, `tasks.md` (+ `.config.kiro`) |
| **Total spec lines (core)** | 587 (spec + plan + tasks) | 363 (proposal + design + tasks) + 3 separate spec files | ~665 (requirements + design + tasks); + ~121 across steering |
| **Source files** | 8 `.ts` files | 7 `.ts` files | 8 `.ts` files |
| **Test files** | 9 `.ts` files | 7 `.ts` files | 9 `test/*.ts` (including `setup.test.ts`, broad integration suite) |
| **Standalone package** | Ready out of the box (own `package.json` + `dist/`) | Required a second change (`add-standalone-package`) to add `package.json` and `tsconfig.json` | `package.json` + `tsconfig.json` + `bin` → `dist/index.js` after `tsc` (no runtime `dependencies`, same idea as a lean CLI) |

---

## Difference 1: Artifact Granularity and Ownership

**Spec Kit** produces 3 core artifacts for the entire feature, each covering a
different concern but living in the same flat folder:

```
spec/001-git-standup-cli/
├── spec.md        # what + why (user stories, acceptance criteria)
├── plan.md        # how (tech stack, architecture, module breakdown)
└── tasks.md       # ordered task list with file paths
```

**OpenSpec** separates concerns across 4 artifact types AND splits behavioral
requirements into per-capability spec files:

```
changes/add-git-standup-generator/
├── proposal.md         # why (problem + scope)
├── design.md           # how (architecture decisions with alternatives)
├── specs/
│   ├── cli/spec.md         # what — CLI behavior only
│   ├── history/spec.md     # what — persistence only
│   └── standup-report/spec.md  # what — report pipeline only
└── tasks.md            # implementation checklist
```

**Practical impact:** In Spec Kit, the `spec.md` described all features in one
document — easier to read end-to-end but harder to update a single capability
independently. In OpenSpec, adding the standalone package setup was a clean
separate change (`add-standalone-package`) with its own `specs/package-setup/spec.md`,
without touching the original feature specs at all.

---

## Difference 2: Living Specification vs Static Archive

**Spec Kit** stores artifacts in `spec/<feature>/` permanently. There is no
built-in mechanism to merge, update, or retire spec files as the system evolves.
After a feature is done, the spec folder sits unchanged — it reflects the original
intent, not the current system state.

**OpenSpec** has a two-layer model:

1. **Changes** (`openspec/changes/`) — active work in progress
2. **Living specs** (`openspec/specs/`) — cumulative, merged source of truth

When a change is archived (`openspec archive`), its delta specs are merged into
`openspec/specs/`. After implementing two changes, the living spec directory
reflected both:

```
openspec/specs/
├── cli/spec.md          # merged from add-git-standup-generator
├── history/spec.md      # merged from add-git-standup-generator
├── standup-report/spec.md
└── package-setup/spec.md  # added by add-standalone-package
```

**Practical impact:** `openspec/specs/` at any moment describes the current
system behavior in full — it's a queryable contract, not just a historical
record. In Spec Kit, checking "what does the current system require?" means
reading all feature folders, which accumulate without consolidation.

---

## Difference 3: Phase Gates and Enforcement

**Spec Kit** enforces a strict sequential workflow via CLI commands:
`/speckit.specify` → `/speckit.plan` → `/speckit.tasks` → `/speckit.implement`.
Each command validates prerequisites: you cannot run `/speckit.implement` without
a completed spec, plan, and task list. The gate is a hard block, not a
suggestion.

**OpenSpec** has no execution gate. The `openspec instructions apply` command
returns `state: ready` as soon as `tasks.md` exists — even if `proposal.md` or
`design.md` are incomplete. The workflow is:

```bash
openspec new change "name"
# write artifacts in any order
openspec instructions apply --change "name"   # runs immediately if tasks exist
```

**Practical impact:** OpenSpec's flexibility allowed implementing tasks while
simultaneously refining the design (fluid workflow). But it also meant there was
no system-enforced checkpoint to catch gaps in specs before coding began — that
validation was entirely manual. In Spec Kit, the CLI would have prevented
implementation if any prerequisite artifact was missing or empty.

---

## Difference 4: Scope of a Single Change

**Spec Kit** treats an entire feature as one unit. The `001-git-standup-cli`
spec covered all modules (git-reader, filter, grouper, formatter, history, CLI)
in a single spec + plan + tasks. The feature boundary is coarse-grained.

**OpenSpec** treats each change as atomic and additive. The core feature
(`add-git-standup-generator`) and the packaging improvement
(`add-standalone-package`) were separate changes with separate proposals, specs,
and task lists — even though from a code perspective they touched some of the
same files. This required creating a second full set of artifacts (proposal →
design → spec → tasks) for what was effectively a 4-file addition.

**Practical impact:** For small follow-up changes, OpenSpec's overhead
(4 artifacts per change) felt disproportionate — writing a proposal and design
doc for adding a `package.json` was more process than the change warranted. Spec
Kit would have just added tasks to the existing feature. OpenSpec's model makes
more sense when changes truly modify distinct capabilities of an already-shipped
system.

---

## Difference 5: Spec Format — Scenarios vs Prose

**Spec Kit** writes requirements as user stories with acceptance criteria in
free-form prose or bullet lists. There is no enforced scenario syntax:

```markdown
## User Story 3: Filter commits by author
As a developer, I want to filter commits by my email address
so that the report only shows my work.

**Acceptance Criteria:**
- Default: uses git config user.email
- When --author is provided: uses that value
```

**OpenSpec** enforces a SHALL/MUST + GIVEN/WHEN/THEN scenario format for every
requirement, with `####` headings required for each scenario:

```markdown
### Requirement: Author Filter
The system SHALL filter commits by the caller-specified author email.

#### Scenario: Author filter
- GIVEN a repository with commits from multiple authors
- WHEN the caller specifies an author
- THEN only commits whose author email matches that value are considered
```

**Practical impact:** OpenSpec's format is more verbose but directly testable —
each scenario maps to a concrete test case. During implementation, the
`filterCommits` unit tests were written almost verbatim from the spec scenarios.
Spec Kit's acceptance criteria are easier to read but leave more interpretation
to the implementer about what exactly constitutes "passing."

---

## Spec Kit: CLI-gated SDD, artifacts, and outcome

**How it felt to drive.** Spec Kit is **CLI-first**: the workflow is a chain of
slash-commands (`/speckit.specify` → `plan` → `tasks` → `implement`) with **hard
prerequisites** — a deliberate pace, with less room to “start coding and fix the
spec later.” In sessions for this project that felt like the **highest
discipline and predictability** among the file-based tools: you pay friction up
front for fewer surprise gaps. Wall-clock was **faster than Kiro** here; relative
to OpenSpec, the main difference is **enforcement**, not raw typing speed.

**Artifacts (`methodologies/spec-kit/spec/001-git-standup-cli/` and templates).**
Besides `spec.md`, `plan.md`, and `tasks.md`, the tree can grow **optionally rich**:
`research.md`, `data-model.md`, `checklists/`, and `contracts/` (e.g. CLI contract
notes). The **constitution** lives under `.specify/memory/constitution.md` and
reinforces repo-wide rules — more scaffolding than a minimal three-file spec,
closer to “full SDD pack” in one feature folder.

**Where the process does not help.** The guardrails are only as good as the last
edits to the markdown: **large spec edits** are still hand-authored files. The
CLI blocks *start* of implementation, not *ongoing* drift between code and an
unmaintained `spec.md`.

**Implementation review (`methodologies/spec-kit/`).** A coherent **read →
parse → filter → group → format → write** pipeline: a dedicated
`commit-parser.ts` on top of `git-reader.ts` (stream-oriented log format with
`COMMIT` sentinels), `commit-filter`, `commit-grouper`, `report-formatter`,
`history-store`, and `cli.ts`. **ESM** (`"type": "module"`), **zero production
dependencies**, **Node’s built-in test runner** with `tsx` for TypeScript, plus
`eslint` in dev. Tests span **unit and integration** (`tests/unit/`,
`tests/integration/`). Entry is `dist/cli.js` from `tsc` — the same “lean CLI
package” idea as the other tracks, with a slightly **larger** module count (8
`src` files including the parser).

**Summary vs the other two:** Spec Kit optimizes for **enforced order and
local CLI gating**; the repo reflects that in **more auxiliary spec files** and a
**parser** split. OpenSpec below trades gates for **living specs**; Kiro (later)
trades file-only workflows for **IDE-orchestrated** SDD.

---

## OpenSpec: change proposals, living specs, and outcome

**How it felt to drive.** OpenSpec is **change-centric**: you work inside
`openspec/changes/…` and (after archive) the cumulative **`openspec/specs/`** tree.
`openspec instructions apply` is **permissive** — `state: ready` as soon as
`tasks.md` exists — so the session is **flexible and fast to start implementing**,
at the cost of **no mechanical lock** that proposal/design are complete. For
this feature, that matched **iterating on tests and code while the spec
settled**; compared to Spec Kit, **self-discipline** replaced CLI blocking.
Wall-clock was **faster than Kiro**; vs Spec Kit, the main contrast is
**opt-in rigor** instead of **mandatory phases**.

**Artifacts.** Per change: `proposal.md`, `design.md`, per-capability
`specs/**/spec.md`, `tasks.md`. After `openspec archive`, **living specs** hold the
**current** behavior (`openspec/specs/cli`, `history`, `standup-report`,
`package-setup`, …) — the methodology’s main long-term payoff is **a queryable
system contract**, not a single static folder.

**Where the process does not help.** **Small follow-up work** (e.g. adding
`package.json` as a second change) still incurs a **full second blob** of
proposal/design/spec/tasks — process weight can exceed code weight. Gaps in
`proposal.md` or `design.md` are **not** caught by `apply` the way Spec Kit’s
implement gate catches missing `plan`/`tasks`.

**Implementation review (`methodologies/openspec/`).** Same overall pipeline as
the feature needs (git read, filter, group, report, history, CLI) with **7 `src/`
files** — no separate parser module; **typed errors** (e.g. `GitReaderError` in
`types.ts`) and a compact `readCommits` path. **ESM**, **no runtime
dependencies**, **Node test runner** + `tsx`. A **`bin/git-standup` wrapper** next
to `dist/`. The **`*-openspec*`** package in this folder was the **add-on change**
for standalone packaging, mirroring the second OpenSpec change in the main repo’s
story. **No property-based tests** in this track (unlike Kiro’s `fast-check`);
coverage is **example- and integration-driven**.

**Summary vs the other two:** OpenSpec optimizes for **proposals, per-surface
specs, and a merged living spec** after archive. The **Spec Kit** section above
is stricter **locally**; **Kiro** below is **strongest on in-IDE process**, not on
this archive model.

---

## Kiro: product-native SDD, artifacts, and outcome

Kiro (Cursor) is a **separate product workflow** from file-based CLIs. Among the
three, it is **the most convenient for SDD-shaped work in daily use**: the IDE is
**built around** spec-driven steps (start spec, implementation runs, checkpoints)
rather than ad hoc prompt chains, so the **mental model and the UI line up** more
tightly than with file-and-CLI–only flows. The tradeoff is **throughput**:
end-to-end runs for this same feature felt **markedly slower** than Spec Kit and
OpenSpec, even on comparable models. **Whether that is tied to a free plan,
rate limits, or product-side scheduling was not verified here** — it is still the
practical experience to plan for in time-boxed sessions.

**Artifacts.** Besides a per-feature set (`specs/<feature>/requirements.md`,
`design.md`, `tasks.md`, and `.config.kiro`), Kiro adds **steering** files at the
repo level (`steering/product.md`, `tech.md`, `structure.md`) so product context,
stack, and layout travel with the work — closer to a lightweight “constitution”
plus feature bundle than to OpenSpec’s per-change + archive split.

**Requirement style** sits between Spec Kit and OpenSpec: numbered requirements
with user stories, then **EARS-style** acceptance lines (`WHEN` / `THE … SHALL`)
— strict enough to map to tests without OpenSpec’s `#### Scenario` boilerplate
everywhere.

**Where the UI does not help.** Once requirements or design need substantive
edits, the experience converges on **editing markdown in the repo or in the
hosting UI** — the same “open the file and fix it” step as in Spec Kit and
OpenSpec, without a first-class advantage for that particular edit pass.

**Latency (unchanged from above).** Treat wall-clock time as a first-class
constraint when choosing Kiro vs the others, unless the SDD-in-the-IDE gains are
worth the wait.

**Implementation review (`methodologies/kiro/`).** The delivered tree is coherent:
a **read → filter → group → format → write** pipeline in **TypeScript** on Node,
**zero runtime dependencies** (only `devDependencies` for build and test), **Jest**
with `ts-jest` plus **fast-check** property tests on the pure modules, and a
**long integration suite** against real temp git repos. Where a `design.md` exists
in the Kiro spec folder, it tends to be unusually complete (data shapes, error
table, PBT “correctness properties,” CI expectations). A few **spec ↔ code** nits
are worth tracking if the requirement docs are still the original prose: e.g. if
`requirements.md` describes the default author filter in terms of **email** while
`gitReader.ts` resolves `git config user.name` when `--author` is omitted; and if
the **path** grouping strategy still runs `git diff-tree` with `process.cwd()`
rather than the selected `--repo`, non-cwd repositories can misbehave for that
mode. In a normal environment, `npm test` passes (Jest compiles from `src/` via
`ts-jest`; `npm run build` is for the shippable CLI in `dist/`). Integration tests
that run `git init` may fail in restricted sandboxes that block hook installation.

**Summary vs the other two:** Kiro is the **in-product, orchestration-first** path
(steering + feature bundle + guided steps), as opposed to **Spec Kit’s** CLI
gates and **OpenSpec’s** change + living-spec lifecycle — see the **Spec Kit** and
**OpenSpec** subsections above. The differentiator is **where you work** and
**session duration**: **process UX vs wall-clock time**, and whether **IDE-native**
flow matters more than **local CLI** or **archiveable specs**.

---

## Summary Table

| Difference | Spec Kit | OpenSpec | Kiro |
|---|---|---|---|
| **Artifact structure** | Flat: spec + plan + tasks per feature | Layered: proposal + design + per-capability specs + tasks per change | Steering + per-feature `requirements` / `design` / `tasks` (+ config) |
| **Living documentation** | Static — specs accumulate, nothing merges | Active — delta specs merge into `openspec/specs/` on archive | Static feature folder; no in-repo merge/archive workflow like OpenSpec |
| **Phase gates** | Hard: CLI blocks implementation without prerequisites | None: `apply` runs whenever `tasks.md` exists | Product workflows / checkpoints; not the same as Spec Kit’s local CLI block |
| **Change granularity** | One change = entire feature | One change = one capability delta; small changes still require full artifact set | One feature = full artifact + steering context; no separate “change ID” layer |
| **Requirement format** | Free-form prose / acceptance criteria | SHALL + GIVEN/WHEN/THEN scenarios (enforced structure) | EARS-style (WHEN / THE … SHALL) + user stories; strict but less uniform than OpenSpec |
| **Standalone setup** | Included by default | Required explicit second change | Included in the Kiro output folder (`package.json`, `tsconfig`, `bin` → `dist/`) |
| **Stack in this project** | TypeScript | TypeScript | TypeScript (Node, `tsc` → `dist/`), same logical feature set |

---

## Overall Assessment

All three approaches produced a **complete, test-backed** implementation of the
same feature. The main tradeoffs are **where** the methodology invests effort:
local CLI enforcement, living spec evolution, or product-guided SDD flows.

- **Spec Kit** is better suited to greenfield features where the entire scope is
  known upfront and you want the AI blocked from guessing. The enforcement model
  reduces the chance of premature implementation but slows iteration.

- **OpenSpec** is better suited to an evolving system where requirements emerge
  incrementally. Its archive + living spec model keeps the current system state
  queryable without requiring all scope to be finalized upfront. The overhead per
  change is higher, but the long-term spec hygiene is stronger.

- **Kiro** is the strongest on **“SDD in the IDE”**: the product is **most aligned
  with** spec-driven work among the three, and day-to-day driving is the **least
  awkward** for that style — at the cost of the **longest** wall-clock runs here,
  **possibly** amplified on a free or limited plan (not proven). Hand-editing
  requirement or design markdown for non-trivial changes is still the same
  file-based step as in the other two. Choose Kiro when **tightest fit between
  workflow and UI** and **steering-style repo context** outweigh raw speed and the
  OpenSpec-style living spec database.
