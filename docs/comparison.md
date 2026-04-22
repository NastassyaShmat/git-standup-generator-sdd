# Workflow Comparison: Spec Kit vs OpenSpec

Practical observations from implementing the same feature — `git-standup-generator` —
using both methodologies. Each difference is grounded in concrete steps taken during
the session, not in documentation claims.

---

## Setup

| | Spec Kit | OpenSpec |
|---|---|---|
| **Artifacts produced** | `spec.md`, `plan.md`, `tasks.md` (+ optional `research.md`, `data-model.md`, `checklists/`) | `proposal.md`, `design.md`, `specs/**/*.md`, `tasks.md` |
| **Total spec lines** | 587 (spec + plan + tasks) | 363 (proposal + design + tasks) + 3 separate spec files |
| **Source files** | 8 `.ts` files | 7 `.ts` files |
| **Test files** | 9 `.ts` files | 7 `.ts` files |
| **Standalone package** | Ready out of the box (own `package.json` + `dist/`) | Required a second change (`add-standalone-package`) to add `package.json` and `tsconfig.json` |

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

## Summary Table

| Difference | Spec Kit | OpenSpec |
|---|---|---|
| **Artifact structure** | Flat: spec + plan + tasks per feature | Layered: proposal + design + per-capability specs + tasks per change |
| **Living documentation** | Static — specs accumulate, nothing merges | Active — delta specs merge into `openspec/specs/` on archive |
| **Phase gates** | Hard: CLI blocks implementation without prerequisites | None: `apply` runs whenever `tasks.md` exists |
| **Change granularity** | One change = entire feature | One change = one capability delta; small changes still require full artifact set |
| **Requirement format** | Free-form prose / acceptance criteria | SHALL + GIVEN/WHEN/THEN scenarios (enforced structure) |
| **Standalone setup** | Included by default | Required explicit second change |

---

## Overall Assessment

Both methodologies produced working, well-tested implementations of the same
feature. The key tradeoff is **structure vs flexibility**:

- **Spec Kit** is better suited to greenfield features where the entire scope is
  known upfront and you want the AI blocked from guessing. The enforcement model
  reduces the chance of premature implementation but slows iteration.

- **OpenSpec** is better suited to an evolving system where requirements emerge
  incrementally. Its archive + living spec model keeps the current system state
  queryable without requiring all scope to be finalized upfront. The overhead per
  change is higher, but the long-term spec hygiene is stronger.
