# bmssp-js — Agent Session Entrypoint

JavaScript (ES Modules) implementation of the **BMSSP** algorithm from the 2025 paper
_"Breaking the Sorting Barrier for Directed Single-Source Shortest Paths"_ — a deterministic
**O(m·log^(2/3) n)** SSSP algorithm, the first to beat Dijkstra on sparse directed graphs.
**BMSSP** = **B**ounded **M**ulti-**S**ource **S**hortest **P**ath.

This file is the **operational entrypoint**: the complete lifecycle of a working session,
from session start to release. The `.claude/knowledge/` base exists so **any agent — any
model** — can work on this project without re-reading the paper, PDF, or any external
article. Follow the checklists literally; every decision point is written as an explicit
if/else so nothing depends on inference.

---

## Ground rules (apply to everything below)

1. **Single source of truth.** Static files (this file, `knowledge/01–04`) must never carry
   dynamic facts (version numbers, issue states, test counts, module lists). Every dynamic
   fact lives in exactly one dynamic file:
   - What the code looks like today → [knowledge/05-codebase-map.md](knowledge/05-codebase-map.md)
   - What to build next (milestones/issues) → [knowledge/06-milestones-roadmap.md](knowledge/06-milestones-roadmap.md)
   - Symbol/term lookup → [knowledge/07-glossary.md](knowledge/07-glossary.md)
   If you spot a dynamic fact anywhere else (including this file), treat it as a bug: move
   it to the right dynamic file and replace it with a pointer.
2. **One PR per issue, and that PR carries everything**: code + tests + version bump +
   refreshed `05`/`06`/`07` + `README.md` updates. Never open a second "sync the docs" PR —
   the pre-PR sync (Phase C below) exists precisely to prevent that.
3. **Two hard gates — never bypass:**
   - **GitHub writes beyond the PR itself** (creating/editing/closing issues or milestones):
     _propose_ first, _execute_ only after explicit user confirmation, **one ask per edit**.
     Collect proposals in the PR body (Phase C) and execute approved ones in Phase E.
   - **Tag + GitHub Release** (fires npm + Docker Hub publish): only after the user
     explicitly confirms the PR is merged. Never tag or release autonomously.
4. **Correctness over speed.** BMSSP output must match the Dijkstra oracle exactly
   (`test/main.test.mjs`, "BMSSP vs Dijkstra"). The asymptotic win is theoretical; this repo
   optimizes for a correct, readable implementation.
5. **Knowledge-base authoring style** (when you rewrite `05`/`06`/`07`): keep the existing
   heading/table structure stable, write procedures as numbered steps with exact commands,
   use absolute dates (never "yesterday"), and prefer short declarative sentences. The next
   reader may be a smaller model — leave it nothing to guess.

---

## The session lifecycle

```
A. Session start  →  B. Implement  →  C. Pre-PR sync (automatic RKB)  →  D. Open the PR
        →  (user reviews & merges, then confirms)  →  E. Release + approved GitHub edits
```

### Phase A — Session start (run every time, in order)

1. **Load the fixed knowledge** (read-only, never changes):
   [01-paper-overview.md](knowledge/01-paper-overview.md) ·
   [02-algorithms.md](knowledge/02-algorithms.md) ·
   [03-data-structures.md](knowledge/03-data-structures.md) ·
   [04-external-enhancement.md](knowledge/04-external-enhancement.md).
   For a task-scoped shortcut ("implementing issue X → read exactly this"), see the
   reading map in [knowledge/README.md](knowledge/README.md).
2. **Sync `main` — never reason from a stale checkout:**
   ```bash
   git checkout main && git pull origin main
   git rev-parse HEAD
   ```
3. **Validate the codebase map** (`05`): follow the **bookmark validation procedure written
   at the top of `05` itself** — it is an explicit if/else covering the normal case, the
   "our own PR just merged" case (`PENDING-PR-BRANCH` marker), and the "repo moved under
   us" case. Outcome: `05` describes reality and its bookmark equals `main` HEAD.
4. **Reconcile the roadmap** (`06`) — read-only against live GitHub:
   ```bash
   gh api repos/Sirivasv/bmssp-js/milestones --jq '.[] | {number,title,state,description,open_issues,closed_issues}'
   gh issue list --repo Sirivasv/bmssp-js --state open --limit 100 --json number,title,milestone,labels
   ```
   Update the `06` markdown to match GitHub. Do **not** write to GitHub in this phase.
5. **Check release state** — surface a bumped-but-unreleased version instead of silently
   working past it:
   ```bash
   git fetch --tags --force && git tag --sort=-creatordate | head -3
   node -p "require('./package.json').version"
   ```
   If `package.json`'s version has no matching tag, tell the user before doing anything else.
6. **Check `README.md` currency** — compare its Status section against `05`/`06`. If stale,
   note it now and fix it in Phase C (inside the next PR), not as a separate PR.

### Phase B — Implement

Pick the next issue from the build order in `06`. Use `02`/`03` as the spec and `05` for the
existing APIs to build on. Ship focused unit tests with every piece. Before Phase C:
`npm test` and `npm run lint` must both pass.

### Phase C — Pre-PR sync (automatic; this replaces the old on-request `RKB`)

**Run this on the feature branch, before opening any PR. Do not wait to be asked.**

1. **Version bump** (only if the PR closes an issue — see "Version bump & release" below
   for which of patch/minor/major applies):
   ```bash
   npm version patch --no-git-tag-version
   ```
2. **Rewrite `05`** to describe the tree **as it will exist once this PR merges** (the
   branch's own tree). Set the `PENDING-PR-BRANCH:` marker to the feature branch name and
   leave `BOOKMARK-COMMIT:` at the `main` commit the branch is based on — the Phase A
   procedure uses these to fast-path validation after the merge.
3. **Reconcile `06`**: mark the issue done-pending-merge, re-derive what's next, and
   **re-examine the roadmap itself** — every increment of progress teaches something about
   the issues ahead. Are open issue titles/descriptions still the best statement of the
   work? Is the milestone slicing (next one or two minors, next major) still right? Write
   any resulting GitHub edits (issue edits/closes/moves, milestone re-scoping, new issues)
   as a **"Roadmap proposals"** list — into `06` and into the PR body — but do **not**
   execute them yet (gate 3). Proposing nothing after real progress should be rare.
4. **Update `07`** with any new symbols, module names, or terms this PR introduces.
5. **Update `README.md`** — the public face must showcase the current state: version,
   status/progress table, usage that actually works, roadmap summary. Keep it honest about
   what is and isn't implemented yet.
6. Commit all of the above **in the same PR branch** as the code.

### Phase D — Open the PR

```bash
git push -u origin <feature-branch>
gh pr create --title "<type>(#<issue>): <summary>" --body "..."
```

PR body must contain: `Closes #<issue>`, a summary of the change, test/lint status, and the
**Roadmap proposals** section from Phase C (or "none"). Then hand off to the user for review.
One PR = the whole increment; if review feedback requires changes, push to the same branch.

### Phase E — After the user confirms the merge

1. Run the **release routine** below (tag + GitHub Release → npm + Docker Hub).
2. Walk the **Roadmap proposals** with the user and execute each approved GitHub edit
   (`gh issue edit/close/create`, milestone edits) — one confirmation per edit.
3. Session can end here; the next session's Phase A will find everything consistent.

---

## ⟳ On-demand command: `revitalize_knowledge_base` (alias `RKB`)

`RKB` is no longer required around PRs — Phase C runs automatically. It remains available
for **out-of-band refreshes** (e.g. after external PRs merged, or when things feel out of
sync). When the user types **`RKB`**: run Phase A steps 2–6, then Phase C steps 2–5 directly
on `main`'s state (no `PENDING-PR-BRANCH` marker; re-stamp `05`'s bookmark to HEAD), present
any Roadmap proposals, and execute only user-approved GitHub edits.

---

## 🚀 Version bump & release (when a working session closes an issue)

The repo ships via **tag → GitHub Release → CI/CD**. Publishing a GitHub Release
(`release: published`) fires `.github/workflows/publish.yml`, which **publishes to npm**
(`npm publish --provenance --access public`) **and pushes the multi-arch Docker image** to
Docker Hub. Tags are the **bare version, no `v` prefix** (`0.19.0`, not `v0.19.0`) and must
match `package.json`. (Pushes/PRs to `main` run lint + test via `npm-build.yml`; `docs/**`
changes deploy Pages via `static.yml` — no action needed for those.)

> **Outward-facing publish — gate 3 applies. Never create a tag or Release autonomously.**

**Phase 1 — bump inside the PR** (part of Phase C, step 1). Use npm so `package.json` and
`package-lock.json` (root `version` **and** the `packages[""]` entry) move together — never
hand-edit:

```bash
npm version patch --no-git-tag-version   # e.g. 1.0.0 → 1.0.1
```

Convention (post-1.0, user-confirmed 2026-07-16): one **patch** bump per closed issue; the
PR that closes a milestone's **last** issue bumps **minor** instead (`major` for the
`2.0.0` milestone), so released versions land exactly on the milestone names. Deviate only
when the user directs otherwise.

**Phase 2 — tag + release, only after the user confirms the merge:**

```bash
git checkout main && git pull origin main
git fetch --tags --force
VERSION=$(node -p "require('./package.json').version")
git tag "$VERSION" && git push origin "$VERSION"
gh release create "$VERSION" --title "$VERSION" --target main --generate-notes
```

Then confirm CD fired (`gh run list --workflow=publish.yml`) and report the result.

---

## File roles at a glance

| File | Lifecycle |
|------|-----------|
| `CLAUDE.md` (this file) | Entrypoint / lifecycle. Stable; no dynamic facts. |
| `knowledge/01–03` | **Fixed** — verified paper transcription (facts, algorithms, structures). Change only to fix a factual error against the paper. |
| `knowledge/04` | **Fixed** — one-time consolidated intuition. Don't change. |
| `knowledge/05-codebase-map.md` | **Dynamic** — validated in Phase A; rewritten in Phase C of every PR. |
| `knowledge/06-milestones-roadmap.md` | **Dynamic** — read-reconciled in Phase A; updated + proposals in Phase C; GitHub writes in Phase E. |
| `knowledge/07-glossary.md` | **Dynamic** — updated in Phase C. |
| `knowledge/README.md` | KB index, reading order, per-task reading map. |
| `README.md` (repo root) | **Public face** — kept current in Phase C of every PR. |

## Project quick facts (stable only — dynamic facts live in `05`/`06`)

- **Package:** `bmssp` on npm. Author: Saul Ivan Rivas Vega. License: MPL-2.0.
  Current version: see `package.json` / `05`.
- **Entry:** `index.mjs` re-exports `BMSSP` (`src/bmssp.mjs`) and `dijkstra`
  (`src/dijkstra.mjs`). Algorithm-internal modules are deliberately **not** re-exported.
- **Runtime:** ESM only, `.mjs`. **Test:** `npm test` (Jest). **Lint/format:**
  `npm run lint` / `npm run format`. **Benchmarks:** `npm run bench`.
- **Graph input:** array of `[from, to, weight]` edges; numeric node IDs; non-negative weights.
- **Oracle:** `src/dijkstra.mjs` — BMSSP output must match it exactly.
- **Implementation status, module inventory, next issue:** see `05` and `06`.
