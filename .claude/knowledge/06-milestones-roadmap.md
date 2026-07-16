# 06 — Milestones Roadmap

<!-- SYNCED-FROM-GITHUB: 2026-07-16 (Phase E after PR #181 merged; #43 closed, milestone
     1.0.0 closed, 1.0.0 tagged + released) -->
<!-- Current package version: 1.0.0 (tagged + released) -->

Maps GitHub **milestones** and **issues** (Sirivasv/bmssp-js) to the paper's building blocks,
with a dependency-aware build order. This is the "intent" side of the knowledge base (what to
build next); `05-codebase-map.md` is the "reality" side (what exists now).

## 🔄 How this file stays current (this file is DYNAMIC)

Three touch-points, matching the lifecycle in `../CLAUDE.md`:

- **Phase A (session start) — read-only reconciliation.** Pull live milestones + issues via
  `gh` and update the markdown below to match GitHub. Do **not** write to GitHub here.
  ```bash
  gh api repos/Sirivasv/bmssp-js/milestones --jq '.[] | {number,title,state,description,open_issues,closed_issues}'
  gh issue list --repo Sirivasv/bmssp-js --state open  --limit 100 --json number,title,milestone,labels
  gh issue list --repo Sirivasv/bmssp-js --state closed --limit 100 --json number,title,milestone
  ```
- **Phase C (pre-PR, automatic — the old on-request `RKB`).** Inside the PR branch: mark the
  closed issue done-pending-merge, re-derive the build order, and **re-examine the roadmap
  itself** with the session's learnings — issue titles/descriptions, the slicing of the next
  one or two minor-version milestones, and the next major-version milestone (which issues
  belong where; add/remove/split/merge as warranted). Write the resulting GitHub edits as a
  **"Roadmap proposals"** list here and in the PR body. **Do not execute them in this phase.**
  Proposing nothing after real progress should be the rare exception: every increment teaches
  something about the issues ahead, and the agent co-owns this roadmap.
- **Phase E (post-merge) — gated GitHub writes.** Walk the Roadmap proposals with the user and
  execute each approved edit (`gh issue edit/close/create`, milestone edits) — **one
  confirmation per edit**. Then clear the executed proposals from this file.

The on-demand **`RKB`** command still exists for out-of-band refreshes (see `../CLAUDE.md`);
it runs the same Phase C reconciliation directly on `main`.

---

## 📋 Roadmap proposals (pending user approval)

_None right now. Phase C writes proposed GitHub edits here (and in the PR body); Phase E
executes the approved ones — one confirmation each — and clears them from this list._
_(All five #43-PR proposals — close milestone 1.0.0, tie findings into #163, baseline +
scope into #170, re-scope #161, partial-coverage note into #162 — were approved and
executed on GitHub in Phase E, 2026-07-16.)_

---

## Current state (as synced)

- **Package version:** `1.0.0` — **tagged + released** (2026-07-16; publish.yml fired →
  npm + Docker Hub). The major bump for closing the `1.0.0` milestone.
- **Milestone `1.0.0`:** **closed on GitHub** — all 11 issues done. The algorithm is
  functional end-to-end.
- **Just merged:** **#43 — `BMSSP(l, B, S)` main recursion (Algorithm 3) — PR #181**
  (squash commit `909a606`). `calculateShortestPaths` runs the paper's method end-to-end
  (no Dijkstra delegation); the "BMSSP vs Dijkstra" test passes on the full road network.
  See `05-codebase-map.md` for the shipped API and the degenerate-tie guards.
- **Next milestone:** **`1.1.0` — correctness hardening** (6 open issues). Recommended next
  issue: **#161** (fuzz suite — cheapest way to protect everything else), then #162, #163.

## Milestone `1.0.0` — issues → paper (CLOSED — all done)

| # | Title | What it is (paper) | Depends on | Status |
|---|---|---|---|---|
| **45** | Add a map of arrays for edges of each node | Adjacency map. §05 | — | ✅ merged (PR #160) |
| **41** | Implement a priority heap | Binary min-heap (Alg 2). §03-A | — | ✅ merged (PR #177) |
| **40** | Implement the base case of the bmssp algorithm | `BaseCase(B, S)`. **Alg 2**, §02 | #41 | ✅ merged (PR #178) |
| **42** | Implement Lema 3.3 data structure | Block-list `D`. **Lemma 3.3**, §03-B | — | ✅ merged (PR #175) |
| **44** | Implement the findingPivots function | `FindPivots(B, S)`. **Alg 1**, §02 | #45 | ✅ merged (PR #180) |
| **43** | Implement main bmssp algorithm | `BMSSP(l, B, S)` + `k,t`. **Alg 3**, §02 | #40, #42, #44 | ✅ merged (PR #181) |

### Closed (context)
`#36` main `calculateShortestPaths` · `#35` Dijkstra oracle + BMSSP-vs-Dijkstra test ·
`#28` `shortestPaths` output map (∞ init) · `#27` `nodeIDs` vertex index ·
`#24` datasets research (roadNet-CA).

### Definition of done for `1.0.0` — ✅ met
- `calculateShortestPaths(source)` computes distances **via BMSSP** (not by calling
  `dijkstra`), and the "BMSSP vs Dijkstra" test passes for every node. ✅
- Each sub-piece (#40/#41/#42/#44/#45) shipped with focused unit tests. ✅
- `npm run lint` clean; ESM + Prettier style preserved. ✅

## Milestone `1.1.0` (milestone #2) — correctness hardening — NEXT

Recommended order (cheapest protection first, then the deep work):

| Order | # | Issue | Labels | Notes after #43 |
|---|---|---|---|---|
| 1 | 161 | Property/fuzz tests: BMSSP vs Dijkstra on random graphs | enhancement · help wanted | Extend the seeded stress already in `test/bmssp.test.mjs` (re-scope noted on the issue) |
| 2 | 162 | Edge-case tests: disconnected graphs and unreachable nodes | enhancement · help wanted | Partially covered by #43 tests (noted on the issue) |
| 3 | 163 | Deterministic tie-breaking for equal-length paths (Assumption 2.1) | enhancement · help wanted | Three concrete manifestations found in #43 (documented on the issue) |
| 4 | 165 | Input validation for the BMSSP constructor | good first issue · help wanted | — |
| 5 | 164 | Optional constant-degree transform (in/out-degree ≤ 2) | enhancement · help wanted | — |
| 6 | 166 | JSDoc / API docs for the new modules | documentation · good first issue | `bmssp()` / `deriveParameters()` ship with JSDoc already |

## Milestone `1.2.0` (milestone #3) — performance & ergonomics

| # | Issue | Labels |
|---|---|---|
| 167 | Restore Lemma 3.3's exact asymptotics in BlockList (balanced-BST bound index + linear-time selection) | enhancement · help wanted |
| 168 | Adjacency and relaxation micro-optimizations | enhancement · help wanted |
| 169 | Optional shortest-path reconstruction (`Pred[]` → paths) | enhancement · help wanted |
| 170 | BMSSP-vs-Dijkstra benchmark comparison | enhancement · help wanted |

_Note:_ the seeded **benchmark harness already exists** (`benchmarks/`, `npm run bench`);
#170 is unblocked by #43 and carries a first baseline (recorded on the issue).

## Milestone `2.0.0` (milestone #4) — API-breaking generalization

| # | Issue | Labels |
|---|---|---|
| 171 | Public multi-source / bounded BMSSP entrypoint | enhancement · help wanted |
| 172 | Typed / flexible graph inputs | enhancement · help wanted |
| 173 | Stabilize the public API surface for 1.0 → 2.0 | documentation · enhancement |

_Note after #43:_ `bmssp(l, B, S)` already **is** a bounded multi-source call internally —
#171 is mostly about designing the public API around it (initial per-source distances,
returning `{ bound, vertices }` sensibly) rather than new algorithm work.

---

## Release mechanics (version bump per closed issue)

Closing an issue bumps the package version and, after the PR merges, ships a release:

1. **In the PR that closes the issue** — `npm version minor --no-git-tag-version` (keeps
   `package.json` + `package-lock.json` in sync; historical cadence is a **minor** `0.N.0`
   bump per issue). **The #43 PR used `npm version major`** — the `1.0.0` milestone close is
   the major bump, per convention.
2. **After the user confirms the merge** — tag `main` with the bare version (no `v` prefix)
   and `gh release create` it; publishing the release fires `publish.yml` → **npm + Docker
   Hub**.

Full procedure + exact commands live in **`../CLAUDE.md` → "Version bump & release"**. The
release step is an outward-facing publish and is **gated on explicit user confirmation**.

## Testing tips
- Small hand-built graphs with known distances for unit tests; `roadNet-CA.txt` for the big
  equivalence test (120 s Jest timeouts on the two tests that run BMSSP on it).
- Any `bmssp(l, B, S)` call's completed vertices+distances must equal
  `{ v : d_dijkstra(v) < B', shortest path visits S }` — `test/bmssp.test.mjs` has the
  pattern ("recursion contract" describe block).
- Ties (equal path lengths) are the #1 source of subtle bugs — see the degenerate-tie
  guards in `05-codebase-map.md` and the notes headed for #163.
