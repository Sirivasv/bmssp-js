# bmssp-js — Agent Session Entrypoint

JavaScript (ES Modules) implementation of the **BMSSP** algorithm from the 2025 paper
_"Breaking the Sorting Barrier for Directed Single-Source Shortest Paths"_ — a deterministic
**O(m·log^(2/3) n)** SSSP algorithm, the first to beat Dijkstra on sparse directed graphs.
**BMSSP** = **B**ounded **M**ulti-**S**ource **S**hortest **P**ath.

This file is the **operational entrypoint**. It tells you what to run at the **start of every
working session** in this repo so the `.claude/knowledge/` base stays in sync with reality
(the codebase) and intent (the GitHub milestones/issues). The knowledge base exists so you can
work on the project **without** re-reading the paper, PDF, or any external article.

---

## ▶ Session-start routine (run these every time, in order)

### Step 1 — Load the fixed knowledge (read-only, never changes)
Read these once per session for full algorithm context. They are **static** — do not edit:
- [knowledge/01-paper-overview.md](knowledge/01-paper-overview.md) — core idea, `k`/`t`, model
- [knowledge/02-algorithms.md](knowledge/02-algorithms.md) — FindPivots / BaseCase / BMSSP pseudocode
- [knowledge/03-data-structures.md](knowledge/03-data-structures.md) — Lemma 3.3 block-list + heap
- [knowledge/04-external-enhancement.md](knowledge/04-external-enhancement.md) — consolidated intuition (fixed)

### Step 2 — Validate the codebase map against the bookmark commit
Open [knowledge/05-codebase-map.md](knowledge/05-codebase-map.md) and read its
**`<!-- BOOKMARK-COMMIT: … -->`** line, then compare to the repo's current `main` HEAD:

```bash
git rev-parse HEAD
```

- **If HEAD == bookmark** → `05` is current; do nothing.
- **If HEAD != bookmark** → the repo moved. Re-inspect `src/`, `test/`, `examples/`,
  `package.json`, update `05` to match the new reality, and set the bookmark to the new HEAD.
  (See the "Session-start validation" block inside `05` for the exact procedure.)

### Step 3 — Refresh the milestones roadmap from GitHub (read)
Using `gh`, read the live milestones and issues and reconcile
[knowledge/06-milestones-roadmap.md](knowledge/06-milestones-roadmap.md) to match:

```bash
gh api repos/Sirivasv/bmssp-js/milestones --jq '.[] | {number,title,state,description,open_issues,closed_issues}'
gh issue list --repo Sirivasv/bmssp-js --state open --limit 100 --json number,title,milestone,labels
```

On session start this is **read-only reconciliation**: update the `06` markdown so it reflects
the current GitHub state. Do **not** push changes to GitHub during normal session start.

### Step 4 — Ready to work
Pick up the issue/milestone in focus (see `06`) and use `02`/`03` as the implementation spec.
When a session's work **closes an issue**, follow the **Version bump & release** routine below
(bump inside the PR; tag + release only after the user confirms the merge).

---

## ⟳ On-demand command: `revitalize_knowledge_base` (alias `RKB`)

When the user types **`RKB`** or **`revitalize_knowledge_base`** at any point in a session,
perform a **full two-way refresh**:

1. **`05` codebase-map** — re-inspect the repo regardless of the bookmark, rewrite `05`, and
   reset the bookmark commit to current HEAD.
2. **`06` milestones-roadmap — two-way sync with GitHub.** Beyond reading, you should
   **use `gh` to make GitHub match the roadmap**: reconcile milestone titles/descriptions and
   issue descriptions, and reason about **(a) the current package version, (b) the next one or
   two minor-version milestones, and (c) the next major-version milestone** — proposing the
   issues that each should contain. (Confirm with the user before creating/editing GitHub
   milestones or issues — these are outward-facing writes.)
3. **`07` glossary** — update [knowledge/07-glossary.md](knowledge/07-glossary.md) to add any
   new symbols/terms introduced by code or roadmap changes since the last refresh.

`RKB` = the manual superset of the session-start routine, plus the GitHub write-back for `06`.
It also **re-checks the release state** (`git tag` / `gh release list` vs. `package.json`) so a
version that was bumped-but-not-yet-released is surfaced.

---

## 🚀 Version bump & release (when a working session closes an issue)

The repo ships via **tag → GitHub Release → CI/CD**. Publishing a GitHub Release
(`release: published`) fires `.github/workflows/publish.yml`, which **publishes the package to
npm** (`npm publish --provenance --access public`) **and builds + pushes the multi-arch Docker
image** to Docker Hub. Tags are the **bare version with no `v` prefix** (`0.15.0`, not
`v0.15.0`) and must match `package.json`. (Separately: pushes/PRs to `main` run lint + test via
`npm-build.yml`, and `docs/**` changes deploy Pages via `static.yml` — those need no action.)

> **This is an outward-facing publish (npm + Docker Hub). The release half is GATED on explicit
> user confirmation that the PR merged. Never create a tag or GitHub Release autonomously.**

### Phase 1 — bump the version *inside the PR that closes the issue*
Do this as part of the same PR that closes the issue, so `package.json` **and**
`package-lock.json` (both the root `version` and the `packages[""]` entry) move together. Use
npm so all stay in sync — **do not hand-edit** the version fields:

```bash
# repo root, on the feature branch, before committing the PR:
npm version minor --no-git-tag-version   # e.g. 0.15.0 → 0.16.0; edits package.json + package-lock.json, no git tag/commit
```

Convention: every historical release is a **minor** bump (`0.N.0`), one per closed issue while
pre-1.0 — use `minor` unless the user directs otherwise (e.g. the final `1.0.0` milestone close
is a `major` bump). Commit the bump with the rest of the PR's changes.

### Phase 2 — tag + release *after the user confirms the PR is merged*
Only once the user confirms the PR is merged (issue closed), from an up-to-date `main`:

```bash
git checkout main && git pull origin main               # pull the merged bump commit
git fetch --tags --force                                # sync local tags with GitHub (local can be stale)
VERSION=$(node -p "require('./package.json').version")  # e.g. 0.16.0
git tag "$VERSION" && git push origin "$VERSION"        # tag == version, no "v" prefix
gh release create "$VERSION" --title "$VERSION" --target main --generate-notes
```

Publishing the release triggers `publish.yml` → npm + Docker Hub. After creating it, confirm the
CD started (`gh run list --workflow=publish.yml` / `gh release view "$VERSION"`) and report the
result to the user.

---

## File roles at a glance

| File | Lifecycle |
|------|-----------|
| `CLAUDE.md` (this file) | Entrypoint / routine. Stable. |
| `knowledge/01–03` | **Fixed** — paper facts, algorithms, data structures. Never change. |
| `knowledge/04-external-enhancement.md` | **Fixed** — one-time consolidated intuition. Don't change. |
| `knowledge/05-codebase-map.md` | **Dynamic** — validated at session start vs. bookmark commit; refreshed on `RKB`. |
| `knowledge/06-milestones-roadmap.md` | **Dynamic** — read-reconciled from GitHub at session start; two-way synced on `RKB`. |
| `knowledge/07-glossary.md` | **Dynamic** — updated on `RKB`. |
| `knowledge/README.md` | KB index / reading order. |

## Project quick facts

- **Package:** `bmssp` on npm (currently `0.15.0`). Author: Saul Ivan Rivas Vega. License: MPL-2.0.
- **Entry:** `index.mjs` re-exports `BMSSP` (`src/bmssp.mjs`) and `dijkstra` (`src/dijkstra.mjs`).
- **Runtime:** ESM only, `.mjs`. **Test:** `npm test` (Jest, `--experimental-vm-modules`).
  **Lint/format:** `npm run lint` / `npm run format`.
- **Graph input:** array of `[from, to, weight]` edges; numeric node IDs; non-negative weights.
- **Oracle:** `src/dijkstra.mjs` — BMSSP output must match it exactly (see `test/main.test.mjs`).
- **Status:** Scaffolding + reference Dijkstra done; the real BMSSP algorithm (issues #40–#45,
  milestone `1.0.0`) is not yet implemented.
