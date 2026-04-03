# SDD Study — Spec-Driven Development Methodology Comparison

A hands-on study of Spec-Driven Development through implementing the same feature
using four different methodologies: **Spec Kit**, **OpenSpec**, **Kiro**, and **BMAD**.

## Goal

Learn and compare SDD approaches by building a real CLI tool — `git-standup-generator` —
four times, each time following a different methodology's workflow.

## Feature Under Study

**git-standup-generator** — a Node.js CLI tool that generates daily standup reports from git commit history.

See [FEATURE_SPEC.md](./FEATURE_SPEC.md) for the full specification.

## Methodologies

| #   | Methodology | Source                                                        | Status      |
| --- | ----------- | ------------------------------------------------------------- | ----------- |
| 1   | Spec Kit    | [github/spec-kit](https://github.com/github/spec-kit)         | Not started |
| 2   | OpenSpec    | [Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec) | Not started |
| 3   | Kiro        | [kiro.dev](https://kiro.dev/)                                 | Not started |
| 4   | BMAD        | [docs.bmad-method.org](https://docs.bmad-method.org)          | Not started |

## Project Structure

```
git-standup-generator/
├── FEATURE_SPEC.md              # shared feature specification
├── docs/
│   ├── sdd-principles.md        # core SDD concepts
│   └── comparison.md            # final comparison of all methodologies
├── methodologies/
│   ├── spec-kit/                # Spec Kit implementation
│   │   ├── spec/                #   spec artifacts
│   │   └── src/                 #   source code
│   ├── openspec/                # OpenSpec implementation
│   │   ├── spec/
│   │   └── src/
│   ├── kiro/                    # Kiro implementation
│   │   ├── spec/
│   │   └── src/
│   └── bmad/                    # BMAD implementation
│       ├── spec/
│       └── src/
└── unified-template/            # custom SDD workflow template
```

## Tech Stack

- **Runtime:** Node.js
- **Language:** TypeScript
- **CLI framework:** TBD (commander / yargs)
- **Output formats:** plain text, markdown, JSON

## Getting Started

```bash
npm install
```

Each methodology implementation is self-contained in its `methodologies/<name>/` directory.

## License

MIT
