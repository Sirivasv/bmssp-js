# 06 — Milestones Roadmap

<!-- SYNCED-FROM-GITHUB: 2026-07-16 (Phase A of the #161 session: GitHub matched this file
     exactly; Phase C update inside the test/161-property-fuzz-suite PR) -->
<!-- Current package version: 1.0.1 (bumped in the #161 PR; 1.0.0 is the latest release) -->

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

From the #161 PR (test/161-property-fuzz-suite), 2026-07-16:

1. **Comment on #163** documenting the fourth tie manifestation, fuzz-found at seed
   163066: through the stall escape hatch, a bounded **partial** execution can return a
   vertex whose true distance **equals** the returned `B'` — Lemma 3.1's strict
   `d(v) < B'` only holds under Assumption 2.1. The honest internal contract under ties
   is `d(v) ≤ B'` (completeness below `B'` stays strict). A principled tie-break (#163's
   goal) would restore the strict form.
2. **Comment on #162** noting partial coverage from #161: the fuzz suite now generates
   disconnected forests (2–6 components) and checks unreachable-stays-Infinity across
   random sources and shapes every run. #162's remaining value is small deterministic
   hand-built edge cases (isolated source, single-node components, empty adjacency) —
   or closing it as covered if that residue isn't worth an issue.

_(Earlier batches — the five #43-PR proposals and the two reflection-session edits
(#182 created, #170 baseline comment) — were all approved and executed on GitHub in
Phase E, 2026-07-16.)_

---

## Current state (as synced)

- **Package version:** `1.0.1` — bumped in the in-flight #161 PR (**patch** per the
  post-1.0 cadence below). Latest release: `1.0.0` (2026-07-16, npm + Docker Hub).
- **Milestone `1.0.0`:** **closed on GitHub** — all 11 issues done. The algorithm is
  functional end-to-end.
- **In flight:** **#161 — property/fuzz suite — PR branch `test/161-property-fuzz-suite`**
  (done pending merge). `test/fuzz.test.mjs`: 8 graph shapes × extreme weight regimes ×
  multi-source bounded `bmssp()` fuzzing vs. per-source oracles, seeds reported on
  failure, `FUZZ_ROUNDS` multiplier. Found + documented the fourth tie deviation
  (boundary-tied return, see proposals above).
- **Milestone `1.1.0` — correctness hardening** (in progress). After #161: **#162**
  (edge-case tests — partially covered by the fuzz suite, see proposals), then #163.
- **2026-07-16 reflection session (post-release):** measured the BMSSP-vs-Dijkstra
  head-to-head, algorithm time only → `benchmarks/HEAD-TO-HEAD.md`. Headlines: Dijkstra
  wins wall-clock everywhere but the sparse ratio narrows with n (1.57× at 2M);
  **comparison counts cross over at ~n = 1M sparse** (0.91× at 2M) — the paper's claim,
  measured. Two pathologies found → new issue **#182** (milestone 1.2.0). Docs PR:
  `docs/head-to-head-vs-dijkstra` (no version bump; closes no issue).

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

| Order | # | Issue | Labels | Notes |
|---|---|---|---|---|
| 1 | 161 | Property/fuzz tests: BMSSP vs Dijkstra on random graphs | enhancement · help wanted | ✅ done pending merge (this PR, 1.0.1) |
| 2 | 162 | Edge-case tests: disconnected graphs and unreachable nodes | enhancement · help wanted | Largely covered by #43 + #161 fuzz (disconnected forests); see proposals |
| 3 | 163 | Deterministic tie-breaking for equal-length paths (Assumption 2.1) | enhancement · help wanted | Four concrete manifestations now: three from #43, boundary-tied return from #161 |
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
| 182 | Investigate BMSSP performance cliffs: high-fanout (star) graphs and recursion-level transitions | enhancement · help wanted |

_Note:_ the seeded **benchmark harness already exists** (`benchmarks/`, `npm run bench`),
and the measured head-to-head lives in `benchmarks/HEAD-TO-HEAD.md`. #170 is now scoped to
harness integration (algorithm-only `bmssp` column + optional comparison-count mode; full
baseline recorded as a comment on the issue, 2026-07-16). #182 (new, 2026-07-16) carries
the two measured pathologies: star-graph blowup (67.8× at n = 500k) and the `topLevel`
3→4 transition cliff (5× at n = 4M); likely overlaps #167/#168.

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

1. **In the PR that closes the issue** — `npm version patch --no-git-tag-version` (keeps
   `package.json` + `package-lock.json` in sync). **Post-1.0 cadence (user-confirmed
   2026-07-16, first applied in the #161 PR):** a **patch** bump per closed issue; the PR
   closing a milestone's **last** issue bumps **minor** (or **major** for `2.0.0`) so
   released versions land exactly on the milestone names (`1.1.0`, `1.2.0`, `2.0.0`).
   (Pre-1.0 history: one minor per issue; the #43 PR's `major` closed milestone `1.0.0`.)
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
