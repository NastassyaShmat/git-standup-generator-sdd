---
title: "Product Brief Distillate: git-standup-generator"
type: llm-distillate
source: "product-brief-git-standup-generator.md"
created: "2026-04-27"
purpose: "Token-efficient context for downstream PRD creation"
---

## Source of truth

- **Single scope authority:** repo-root `FEATURE_SPEC.md`. Brief adds no requirements.
- **BMAD traceability rule:** PRD / architecture / stories / code under `methodologies/bmad/` must map to `FEATURE_SPEC.md`; divergences only via **explicit spec edits**, never implicit scope creep.

## Product shape

- **Type:** Node.js CLI; uses **git CLI** + Node **built-ins only** (no extra runtime deps).
- **Pipeline:** CLI → git-reader → commit-filter → commit-grouper → report-formatter → stdout/file; optional branch to history-store when `--save`.

## Functional anchors (from spec)

- Inputs: `--repo`, `--since`, `--until`, `--author`, `--format` (text|markdown|json), `--exclude`, `--group-by` (type|branch|path), `--output`, `--save`.
- Grouping: type mode uses conventional-commit regex + known prefixes; non-matching → `"other"` group, messages preserved. Branch/path modes key by branch or first path segment.
- Outputs: human text, markdown, JSON schema as in spec examples/types.

## Out of scope (locked)

- Multi-repo aggregation; Slack/Teams; AI summaries; web/React UI (future only if spec changes).

## Success / NFR (from spec)

- Readable report from real repos; all formats valid; filter/group/save behaviors per spec; **under 2s** at ~10k commits; macOS/Linux/Windows (WSL).

## Context assumptions (non-requirements)

- Audience: devs in short daily syncs; commit messages are the ground truth for “what I did.”
- “Market” is local developer productivity utilities (npm-global or project-local CLI)—no positioning claims beyond fit for that niche.

## Risks / review notes (for PRD authors)

- Output quality **depends on commit hygiene**; tool does not invent narrative (no AI).
- Wrong `--author` or date range produces misleading standup text—CLI should make defaults obvious (spec defines defaults).
- **Configurable template** detail lives in implementation/spec, not the brief.

## Rejected expansions (do not re-propose without spec change)

- Chat integrations, multi-repo, AI summarization, web UI—explicitly deferred in `FEATURE_SPEC.md`.
