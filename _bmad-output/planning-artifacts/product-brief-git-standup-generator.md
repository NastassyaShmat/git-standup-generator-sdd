---
title: "Product Brief: git-standup-generator"
status: "complete"
created: "2026-04-27"
updated: "2026-04-27"
inputs:
  - "FEATURE_SPEC.md"
---

# Product Brief: git-standup-generator

## Executive Summary

**git-standup-generator** is a Node.js command-line tool that turns local git history into a concise daily standup report. Developers already record what they did in commits; the product removes the extra step of manually rewriting that history into standup wording. It reads `git log` for a chosen period and author, strips noise (merge commits and configurable patterns such as WIP/fixup), groups work in a predictable way, and emits the same story in **text**, **markdown**, or **JSON**—optionally saved to a local history file.

The product fits teams that run short syncs and value accuracy without ceremony. Success is practical: a readable report in under two seconds on large repos, no runtime beyond Node built-ins and the git CLI, and predictable behavior on macOS, Linux, and Windows (including WSL). **Scope and behavior are fixed by a single source of truth:** the repository-root `FEATURE_SPEC.md`; this brief frames motivation and outcomes only—it does not add requirements.

## The Problem

Daily standups ask “what did you do?” and “what’s next?” The first half is often redundant with git: the work is already described in commit messages, but re-summarizing by hand is slow and easy to get wrong under time pressure. People forget branches, mis-remember scope, or paste unstructured lists. The cost is small per day but steady—friction before every standup and occasional mistrust when the verbal summary does not match the record.

## The Solution

A **local-first CLI** that automates the translation from commits to standup-shaped output. The user points at a repo, time range, and author; the tool filters, groups (by conventional-commit type, branch, or path prefix per spec), formats, and prints or writes the result. Optional **local persistence** (`--save`) supports revisiting past reports without adding cloud services or chat integrations.

## What Makes This Different

Honest differentiation here is **narrow scope and explicit boundaries**, not a proprietary algorithm. The tool deliberately avoids chat bots, multi-repo dashboards, AI summaries, and web UIs—those are explicitly out of scope for this phase—so it stays fast to ship, easy to trust, and simple to run in CI or a developer laptop. Differentiation versus “use raw `git log`” is **opinionated filtering, grouping, and multiple output shapes** (including JSON for tooling) in one command, with **configurable templates** as specified.

## Who This Serves

- **Primary:** Individual contributors who run or attend daily standups and already use conventional commits or consistent branch naming. They want a faithful, quick summary aligned to how they actually worked.
- **Secondary:** Tech leads or scrum facilitators who care that standup narratives match the repo and who may standardize flags or templates for the team—still without mandating a new platform.

Success for these users means: correct filtering and grouping, valid outputs in all three formats, and optional local history that works as described in `FEATURE_SPEC.md`.

## Success Criteria

Aligned with the feature spec (not expanded):

1. Running the CLI in a repo with commits yields a **readable** standup-style report.
2. **Text, markdown, and JSON** outputs are valid and structurally consistent with the spec’s examples and types.
3. **Filtering** reliably excludes merge commits and user-configured patterns.
4. **Grouping** behaves as defined: conventional types with `"other"` fallback for type mode; branch and path modes independent of message format.
5. **`--save`** persists reports and supports later retrieval per spec.
6. **Non-functional:** under **2 seconds** for up to ~10k commits; **no** npm runtime deps beyond Node built-ins; **cross-platform** as stated.

## Scope

**In scope (MVP):** Exactly the capabilities listed under “In Scope” in `FEATURE_SPEC.md`—git log ingestion, author/time filters, exclusions, three grouping strategies, three output formats, configurable template, optional local history, and the module breakdown (`git-reader`, `commit-filter`, `commit-grouper`, `report-formatter`, `history-store`, `cli`).

**Explicitly out (for now):** Multi-repo aggregation, Slack/Teams (or other) integrations, AI-powered summarization, web or React UI—per spec.

### Traceability and downstream work

All planning and implementation aligned with BMAD in this repository must **trace to `FEATURE_SPEC.md` (repository root)** as the authoritative scope:

- **PRD**, **architecture**, **user stories/epics**, and **code** produced or refined through artifacts under `methodologies/bmad/` (and any related planning outputs) must be **justified by and consistent with** that file.
- **Any departure** from `FEATURE_SPEC.md`—whether a new feature, a relaxed constraint, or a changed behavior—is allowed **only** as an **explicit, reviewed change to the spec itself**, not as silent drift in downstream documents or implementation.

This brief does not introduce features beyond that spec; contextual language about users and market is for clarity only.

## Vision

If the CLI proves useful, the natural long-term direction—**only when the spec is intentionally updated**—could include integrations or richer surfaces. Until then, the vision is a **dependable, boring utility**: one command, predictable output, and a spec that stays the contract between intent and code.
