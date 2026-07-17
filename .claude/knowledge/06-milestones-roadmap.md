# 06 — Milestones Roadmap

<!-- SYNCED-FROM-GITHUB: 2026-07-17 (#162 session: milestones 1.1.0/1.2.0/2.0.0 open with
     5/5/3 open issues; #162 done-pending-merge in this PR) -->
<!-- Current package version: 1.0.1 (released 2026-07-16; the #162 PR ships no bump under
     the semver convention — see "Release mechanics" and PR #186) -->

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

From the #162 PR (Phase C, 2026-07-17):

1. **Comment on #165 (input validation):** the #162 edge-case work locked in the current
   empty-graph behavior — `new BMSSP([])` constructs silently and only
   `calculateShortestPaths()` throws (`"Start node not found in the graph"`,
   `test/edgeCases.test.mjs`). Propose adding a note to #165 so the validation design
   explicitly decides whether an empty edge list should throw at construction or stay
   allowed (and, if allowed, that the test's locked-in behavior is the contract).

_Phase C writes proposed GitHub edits here (and in the PR body); Phase E executes the
approved ones — one confirmation each — and clears them from this list._
_(The #185-PR proposal — removal note on closed **#24** — was approved and executed
2026-07-17. Earlier: both #161-PR proposals executed 2026-07-16 on **#163**/**#162**.)_

---

## Current state (as synced)

- **Package version:** `1.0.1` — released 2026-07-16 (npm + Docker Hub), tag matches.
- **Milestone `1.0.0`:** **closed on GitHub** — all 11 issues done. The algorithm is
  functional end-to-end.
- **#161 property/fuzz suite:** merged (PR #184) and released as `1.0.1`.
- **roadNet-CA removal (user-directed, 2026-07-17):** **PR #185 merged** (no issue, no
  version bump). Deleted `test/roadNet-CA.txt` (87 MB, unseeded weights, ~71 s of every
  test run), rewrote `main.test.mjs` on a seeded 10k sparse graph, added seeded scale
  runs to `fuzz.test.mjs` (150k sparse + 300×300 grid default, `FUZZ_XL=1` → 2M nodes).
  Suite: ~75 s → ~3 s. **Same day, post-merge: full history purge + re-sign** —
  `git-filter-repo` removed the blob from all history (pack 17.7 MiB → ~0.5 MiB), every
  commit re-signed with the owner's SSH key (committer normalized to the owner; authors
  and dates preserved), `main` + all 21 tags force-pushed with ruleset 7764713
  temporarily disabled. **All commit SHAs before 2026-07-17 changed**; old SHAs in
  closed PRs/issues no longer resolve. Repo-local git config now signs future commits.
- **Milestone `1.1.0` — correctness hardening** (in progress). **#162 done-pending-merge**
  (this PR: `test/edgeCases.test.mjs`, 9 deterministic disconnection fixtures, no bump).
  Next: **#163** (tie-breaking), then #165.
- **Semver release convention (user-directed 2026-07-17, PR #186):** bumps only on bug
  fix (patch) or milestone-closing PR (minor/major) — see "Release mechanics" below.
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
| 1 | 161 | Property/fuzz tests: BMSSP vs Dijkstra on random graphs | enhancement · help wanted | ✅ merged (PR #184, 1.0.1) |
| 2 | 162 | Edge-case tests: disconnected graphs and unreachable nodes | enhancement · help wanted | ✅ done-pending-merge (this PR, no bump): deterministic fixtures in `test/edgeCases.test.mjs`; randomized side already in #161 fuzz |
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
- Small hand-built graphs with known distances for unit tests; seeded generated graphs
  (`benchmarks/generators.mjs`) for equivalence/scale tests — **never unseeded randomness,
  never data files**. `FUZZ_XL=1` opts into the 2M-node round (~30 s).
- Any `bmssp(l, B, S)` call's completed vertices+distances must equal
  `{ v : d_dijkstra(v) < B', shortest path visits S }` — `test/bmssp.test.mjs` has the
  pattern ("recursion contract" describe block).
- Ties (equal path lengths) are the #1 source of subtle bugs — see the degenerate-tie
  guards in `05-codebase-map.md` and the notes headed for #163.
