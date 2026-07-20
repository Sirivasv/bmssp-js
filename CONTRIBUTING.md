# Contributing to bmssp-js

Thank you for your interest in contributing to **bmssp-js**! This is a community-driven,
readable JavaScript implementation of the BMSSP shortest-paths algorithm, and help is
genuinely welcome — whether you write the code yourself or pair with an AI agent.

## Two ways to contribute

### 1. With an AI agent — any model

This repo is deliberately built so that **any coding agent, running any model, can pick up
the work without ever reading the source paper, the PDF, or any external article.**
Everything an agent needs is checked into the repository:

- **[`.claude/CLAUDE.md`](.claude/CLAUDE.md)** — the operational entrypoint. It describes the
  complete working lifecycle (session start → implement → pre-PR sync → open PR → release)
  as explicit, literal checklists, so nothing depends on the model guessing.
- **[`.claude/knowledge/`](.claude/knowledge/)** — a self-contained "mental map" of the
  algorithm:
  - `01–04` — **fixed** knowledge: a verified transcription of the paper (overview,
    algorithms, data structures) plus consolidated intuition. Read these instead of the paper.
  - `05` — what the code looks like **today** (module inventory + APIs).
  - `06` — the milestones/issues roadmap and build order (what to work on next).
  - `07` — a glossary of every symbol and term.
  - [`.claude/knowledge/README.md`](.claude/knowledge/README.md) — an index and a
    per-task reading map ("implementing issue X → read exactly these sections").

To contribute this way, just point your agent at the repository and let it read
`.claude/CLAUDE.md` first. The file is written to be model-agnostic on purpose — Claude,
or any other assistant, should be able to follow it start to finish. The knowledge base is
part of the project: if your work changes the code, the same lifecycle asks you (or your
agent) to keep `05`/`06`/`07` and this `README`/docs in sync **inside the same PR**.

### 2. By hand

You don't need an AI agent to contribute. The knowledge base doubles as human-readable
documentation — start with [`.claude/knowledge/README.md`](.claude/knowledge/README.md)
and the root [`README.md`](README.md).

## Getting started

1. **Fork the repository** and clone it locally.
2. Install dependencies (Node.js with npm; the package is ESM-only, `.mjs`):
   ```bash
   npm install
   ```
3. Create a branch for your feature or bugfix:
   ```bash
   git checkout -b your-feature-name
   ```

## Development

- Follow the existing code style and conventions (ES Modules, `.mjs` throughout).
- Add or update tests with every change — see below.
- **Correctness is the top priority.** BMSSP's output must match the Dijkstra oracle
  (`src/dijkstra.mjs`) exactly, for every node. The seeded fuzz suite exists to protect
  that contract.
- Keep the knowledge base (`.claude/knowledge/05`–`07`), this file, and the `README` in
  sync with your change, in the same PR — don't leave a docs update for later.
- Write clear, focused commit messages.

## Running the checks

Before opening a PR, both of these must pass:

```bash
npm test          # Jest suite — every graph is seeded, so every failure is reproducible
npm run lint      # Prettier + ESLint
```

Useful extras:

```bash
npm run format    # auto-format with Prettier
npm run bench     # seeded micro-benchmarks (see benchmarks/README.md)
```

## Submitting changes

1. Push your branch to your fork.
2. Open a pull request against the `main` branch.
3. Describe your change, reference any related issues (`Closes #<issue>`), and confirm that
   tests and lint pass.
4. One PR should carry the whole increment: code + tests + docs. If review feedback needs
   changes, push to the same branch.

Good places to start are the
[`help wanted` / `good first issue` labels](https://github.com/Sirivasv/bmssp-js/issues)
and the roadmap in [`.claude/knowledge/06-milestones-roadmap.md`](.claude/knowledge/06-milestones-roadmap.md).

## Code of Conduct

Please be respectful and considerate in all interactions — see
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

---

Thank you for contributing!
