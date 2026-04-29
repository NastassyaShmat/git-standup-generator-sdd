# Methodology Comparison: Spec Kit vs OpenSpec vs Kiro

A single narrative: **each methodology’s idea and workflow**, then **repository-grounded verification** under `methodologies/spec-kit`, `methodologies/openspec`, and `methodologies/kiro`, and finally **evaluation of outcomes** for the same feature—a CLI producing a stand-up report from git history.

Where subjective experience or Kiro artefacts cannot be verified from markdown under `methodologies/kiro`, this document states that plainly.

**Limit:** `methodologies/kiro` does **not** contain committed markdown artefacts for Kiro (`requirements.md`, `design.md`, `steering/*.md`, `.config.kiro`). The Kiro column below relies on consolidated session notes alongside **code review** of that folder; **detailed Kiro textual specs are not reproduced there**.

---

## 1. Scope

All three implementations use **TypeScript**, Node, and `tsc` → `dist/`: **the stack is comparable**; differences are **process, tooling, and artefact models**, not the language.

### 1.1 Snapshot: artefacts, code, and packaging

|                                                      | Spec Kit                                                                                    | OpenSpec                                                                                                 | Kiro                                                                                                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Primary artefacts**                                | `spec.md`, `plan.md`, `tasks.md` (+ optionally research, data-model, checklists, contracts) | `proposal.md`, `design.md`, `specs/**/*.md`, `tasks.md` per change                                       | Steering `product.md`, `tech.md`, `structure.md` (expected); per feature `requirements.md`, `design.md`, `tasks.md` (+ `.config.kiro`). In **`kiro/`** there are no markdown specs in-repo. |
| **Core spec size (estimated)**                       | ~587 (`spec` + `plan` + `tasks`)                                                            | ~363 (`proposal` + `design` + `tasks`, single sum excluding separate delta spec files counted elsewhere) | ~665 lines (prior combined estimate for requirements + design + tasks sessions); **not** re-measured in-repo                                                                                |
| **`src/` files (`.ts`)**                             | 8 (~981 LOC)                                                                                | 7 (~600 LOC)                                                                                             | 8 (~815 LOC)                                                                                                                                                                                |
| **Tests**                                            | `node:test` + tsx, **66** tests (successful run)                                            | **51** tests                                                                                             | Jest + **fast-check**, **174** tests                                                                                                                                                        |
| **Standalone npm package inside methodology folder** | Yes, immediately                                                                            | Needed a **second change** `add-standalone-package` for local `package.json` / build                     | `package.json` + `tsconfig` in output folder; **bin** points to `dist/index.js`                                                                                                             |

---

## 2. Process philosophy: five axes of variance

Below is a compressed recap of «Difference 1–5», with practical takeaway.

### 2.1 Artefact granularity and “ownership” of files

- **Spec Kit** uses three pillar files per feature in one flat folder: what/why (`spec`), how (`plan`), work checklist (`tasks`). Easy to **read whole-feature**; isolated capability edits are harder.
- **OpenSpec** separates document roles (proposal / design / tasks) and **splits behavioural requirements per capability** (`cli`, `history`, `standup-report`). Adding a capability without rewriting a monolithic spec is easier (session example: a separate change `add-standalone-package` with `specs/package-setup/spec.md`).

**Takeaway:** Spec Kit’s feature boundary is coarser; OpenSpec buys more files but preserves **durably modular contracts**.

### 2.2 Living specifications vs static snapshot

- **Spec Kit** leaves `spec/<feature>/` **as intent snapshot**, with no built-in merge into a single evolving source of truth.
- **OpenSpec** keeps **changes** under `openspec/changes/` and, after archiving, aggregates **living** `openspec/specs/` — that tree can serve as **current system contract**, not merely history.

**Takeaway:** OpenSpec optimizes for keeping the spec useful as **ongoing interrogation language** over the codebase; Spec Kit optimizes **structuring one large delivery**.

### 2.3 Phase gates and enforcement

- **Spec Kit:** `/speckit.specify` → plan → tasks → implement with **explicit checks** (including checklists before implement)—you can enforce a firm bar before coding starts.
- **OpenSpec:** `openspec instructions apply` may report **implementation-ready** as soon as `tasks.md` exists, even while proposal/design “catch up”—flexible iteration, **not** a mechanical stopgap for unfinished design.
- **Kiro:** product checkpoints, **not** equivalent to Spec Kit’s local CLI gate.

**Takeaway:** top-down discipline versus **self-discipline** versus **IDE-hosted orchestration**.

### 2.4 Granularity of a “change” / unit of work

- **Spec Kit:** often one feature equals **one** spec bundle (single spec/plan/tasks across modules).
- **OpenSpec:** **atomic changes**; a small tweak (packaging, etc.) still pulls a **full artefact envelope** — on tiny follow-ups, process overhead can **dominate** the code diff.
- **Kiro:** no OpenSpec-style `change ID`; a **whole feature bundle** plus steering (as described in session notes for this track).

**Takeaway:** OpenSpec’s shape fits evolving products at the expense of heavyweight small tasks.

### 2.5 Requirement formatting: prose vs scenarios vs EARS

- **Spec Kit:** user stories and acceptance bullets in **free prose**—readable; “pass/fail” can drift between readers.
- **OpenSpec:** **SHALL** and **GIVEN/WHEN/THEN** per scenario—**more verbose**, but roughly one scenario ≈ one crisp test (the `filterCommits` unit tests for this track aligned closely with spec scenarios).
- **Kiro:** an **EARS-style** vein (`WHEN` / `THE … SHALL`) between those poles—more structure than prose, without mandated `#### Scenario` on every slice.

Concrete style snippets were quoted in earlier session notes; structurally the comparison is covered in §2.5 above.

---

## 3. Subjective driving experience and where process fails

Below is **not measurement** — a tightened narrative from session experience, updated with repo file checks.

### 3.1 Spec Kit — CLI-centric SDD

**Behaviour.** Slash commands with **hard prerequisites** set a slower, steadier tempo: less “ship code now, tighten spec later”. In this project’s sessions, Spec Kit showed **strong discipline among file-based workflows**; wall-clock was **faster than Kiro**; versus OpenSpec the main contrast is **phase enforcement**, not typing speed.

**Where process falters.** Gates focus on **launch** of implementation—**slow drift** where code evolves but `spec.md` stalls is not mechanically detected; still ethics of teams and reviews.

**What the repo corroborates.** `.cursor/commands/`, constitution, optionally rich artefacts (research, `contracts/cli.md`). Details in §4.

### 3.2 OpenSpec — change at the centre, living specs for the long haul

**Behaviour.** Work centres on **`openspec/changes/…`**, then post-archive on **`openspec/specs/`**; `apply` may **allow** implementation once tasks exist—handy to **code while clarifying design**, but no hard lock on proposal/design completeness.

**Where process falters.** Even a small code fix can require a **full change packet**; gaps in proposal/design are **not caught** the way Spec Kit’s implement gate catches missing plan/tasks.

**Repository.** Skills (`openspec-propose`, `openspec-apply-change`, `openspec-archive-change`, `openspec-explore`); **Purpose** in living `cli/spec.md` can remain **TBD** post-archive—documentation debt (§6.2).

### 3.3 Kiro — SDD inside the product (IDE)

**Behaviour.** Closer to **everyday spec-driven** flow: spec steps, implementation runs, checkpoints **live in the product**, not only files + CLI. Expected cost—**higher wall-clock** for the same scope versus file-only tracks (rate limits / queueing on the product side were **not verified** here).

**Where process falters.** Substantive requirement edits still mean **editing markdown** (repo or UI)—IDE magic stops there.

**Repository.** Under `methodologies/kiro`, judgement rests on **code and tests** (Jest, PBT, long integration); markdown artefacts are absent.

---

## 4. Repository inventory: commands, skills, artefacts

### 4.1 Spec Kit

**Tooling**

- Commands under `.cursor/commands/`: `speckit.specify`, `speckit.plan`, `speckit.tasks`, `speckit.implement`, `speckit.checklist`, `speckit.clarify`, `speckit.constitution`, `speckit.analyze`, `speckit.taskstoissues`.
- Templates under `.specify/templates/` (spec, plan, tasks, checklist, constitution, agent).
- Rule `.cursor/rules/specify-rules.mdc` (always-on synthesis of latest plans).

**Artefacts `spec/001-git-standup-cli/`**

| File                              | Lines (~) | Role                                          |
| --------------------------------- | --------- | --------------------------------------------- |
| `spec.md`                         | 206       | User stories, FRs, scope                      |
| `plan.md`                         | 77        | Tech context, constitution check, module tree |
| `tasks.md`                        | 304       | Phases, tasks, US alignment                   |
| `research.md`                     | 220       | Phase 0                                       |
| `data-model.md`                   | 286       | Data models                                   |
| `contracts/cli.md`                | 217       | CLI contract                                  |
| `checklists/requirements.md`      | —         | Spec quality checklist                        |
| `.specify/memory/constitution.md` | 154       | Repository constitution                       |

### 4.2 OpenSpec

**Skills**

| Skill                     | Purpose                                                              |
| ------------------------- | -------------------------------------------------------------------- |
| `openspec-propose`        | Change creation: proposal, design, tasks via `openspec instructions` |
| `openspec-apply-change`   | Implementation; `blocked` / `all_done`; `contextFiles`               |
| `openspec-archive-change` | Archive + optional sync of delta → main specs                        |
| `openspec-explore`        | Explore **without** building product code; markdown thinking allowed |

Commands: `opsx-propose`, `opsx-apply`, `opsx-archive`, `opsx-explore`.

**Sizes (measured):** proposal + design + tasks for core archived change ≈ **363** lines; all delta specs in that archive ≈ **646**; living `openspec/specs/**/*.md` ≈ **343** lines across four capabilities.

### 4.3 Kiro

Only **source and tests** live in the folder; steering and requirements/design are not present as markdown here—only **inferred** from code and from how other tracks described the feature.

---

## 5. `src/` implementation: architecture, similarity, size

Common pipeline: read git → filter → group → format → history / CLI.

| Aspect          | Spec Kit                     | OpenSpec                       | Kiro                                      |
| --------------- | ---------------------------- | ------------------------------ | ----------------------------------------- |
| Files in `src/` | 8 (~981 TS LOC)              | 7 (~600 LOC)                   | 8 (~815 LOC), camelCase                   |
| Parser          | Dedicated `commit-parser.ts` | Inside `git-reader` stream     | Inside `gitReader.ts` + exports for tests |
| Git errors      | String `Error`               | `GitReaderError` in `types.ts` | Per codebase conventions                  |
| Entry           | `cli.ts`                     | `cli.ts`                       | `index.ts` + `outputWriter.ts`            |
| Linter          | ESLint (dev)                 | Not in `package.json`          | Not in `package.json`                     |

**Similarity:** high at domain logic (conventional types, exclude patterns, three grouping modes). Differs in `git log` format, branch strategy, path-grouping details.

---

## 6. Specification ↔ code and completeness

### 6.1 Spec Kit

Default **author** (`git config user.email`) matches between `contracts/cli.md` and `cli.ts`. Tasks bind to user stories. Integration tests (environment without blocked `git init` hooks) exercise `--repo` and the pipeline.

### 6.2 OpenSpec

Formal scenarios map cleanly to tests; living `openspec/specs/cli/spec.md` may still show **Purpose = TBD**—a living-spec “shop window” debt. “No `user.email`” scenarios should be checked against real `cli.ts`.

### 6.3 Kiro

| Topic           | Observation                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Default author  | Code resolves `git config user.name`; other tracks and domain copy often assume **email**—sync risk.                                  |
| Path + `--repo` | `groupCommits` defaulting `repoPath = process.cwd()` alongside `git diff-tree` logic—edge case when repo ≠ cwd (noted in this audit). |
| Evidence        | Heavy emphasis on **tests** (incl. PBT), not adjacent markdown.                                                                       |

---

## 7. Tests and execution environment

| Path                     | Result (full environment, not sandboxed) |
| ------------------------ | ---------------------------------------- |
| `methodologies/spec-kit` | 66 tests, green                          |
| `methodologies/openspec` | 51 tests, green                          |
| `methodologies/kiro`     | 174 tests (Jest), green                  |

In a **sandbox** that blocks hook installation for `git init`, integration tests fail—a known environment constraint for these suites.

**Strategies:** Spec Kit and OpenSpec use `node:test` + tsx; Kiro uses Jest + **fast-check** on several modules.

---

## 8. Summary table

| Dimension                | Spec Kit                                      | OpenSpec                                                             | Kiro                                                                                    |
| ------------------------ | --------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Artefact layout**      | Flat: spec + plan + tasks per feature         | Layered: proposal + design + per-capability specs + tasks per change | Steering + requirements / design / tasks per feature (+ config), when those files exist |
| **Living documentation** | Static feature folder                         | Active: merge into `openspec/specs/` on archive                      | Static feature folder / outside repo; no OpenSpec-style merge                           |
| **Gates before code**    | Hard (scripts, checklists in implement)       | Softer: `apply` readiness when tasks exist                           | Product checkpoints; not Spec Kit CLI gate                                              |
| **Change granularity**   | One feature—a large chunk                     | One change—a delta perimeter; tiny edits drag full artefact bundle   | Whole feature bundle without OpenSpec-style change ID                                   |
| **Requirement shape**    | Prose, user stories, acceptance bullets       | SHALL + GIVEN/WHEN/THEN scenarios                                    | EARS + stories (expected for this track)                                                |
| **Standalone package**   | Included in methodology folder out of the box | Second packaging change in project history                           | Package in Kiro output folder                                                           |

---

## Overall Assessment

All three approaches produced a **complete, test-backed** implementation of the same feature. The main tradeoffs are **where** the methodology invests effort: local CLI enforcement, living spec evolution, or product-guided SDD flows.

- **Spec Kit** suits **greenfield** work where the scope is mostly known up front and you want implementation **blocked** until `spec` / `plan` / `tasks` (and checklists, when used) are in place—it reduces premature coding at the price of slower iteration and less parallel tinkering between spec and code. The audit bears this out: slash-command workflow plus `contracts/cli.md` tightly aligned with `cli.ts`.

- **OpenSpec** suits an **evolving** system where requirements arrive incrementally. The archive + **`openspec/specs/`** model keeps today’s behaviour **Queryable** without freezing the whole scope before coding; per-change artefacts add overhead on **small follow-ups**, but long-term contract hygiene can win for multi-capability maintenance. Repo checks show formal GWT scenarios mapping well to tests, with occasional editorial debt (for example **Purpose** still **TBD** in a merged living `cli/spec.md`).

- **Kiro** is strongest on **“SDD in the IDE”** among the three: the product aligns with guided spec steps rather than prompt-only flows, but this project observed the **longest wall-clock** end-to-end (whether due to quotas or scheduling was **not** validated). Everyday driving can feel least awkward for that style **if** latency is acceptable; substantive edits to requirements/design are still ordinary markdown edits. Steering-style context belongs with the methodology when those files exist—for **`methodologies/kiro`** in this repo they do **not**, so judgement here rests on **code + tests** (including PBT) and parity checks against gaps such as **`user.name` vs email** defaults and **`--repo`** with path grouping.

In short: choose **Spec Kit** when you want **predictable phased enforcement** locally; choose **OpenSpec** when **living, capability-sliced specs** matter more than minimal process on tiny changes; choose **Kiro** when **tight UX fit for spec-led work inside the IDE** outweighs throughput and you accept file-based artefacts for substantive edits—the same coarse rule as above, enriched with this repository’s audited facts.

---

## 9. What repository audit adds on top of narrative-only comparison

- Explicit catalogue of Spec Kit **slash commands** and OpenSpec **skills**.
- **Numbers:** artefact and `src/` line impressions, test counts, successful run facts.
- **Concrete findings:** Purpose TBD in living `cli/spec.md`; absent markdown under Kiro; **email vs `user.name`** divergence confirmed from code review.
- Tight coupling of **Difference 1–5** themes above with **measurable** observations.
