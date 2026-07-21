# 06 — Milestones Roadmap

<!-- SYNCED-FROM-GITHUB: 2026-07-21 Phase C of the #170 PR (verified live: milestone 1.1.0
     CLOSED 6/6; 1.2.0 open with 4 open issues #167/#168/#170/#182; 2.0.0 open with 3
     open issues #171/#172/#173; #170 is done-pending-merge in this PR) -->
<!-- Current package version: 1.1.0 — released 2026-07-21 (tag + GitHub Release with
     Announcements discussion #197 → npm + Docker Hub via publish.yml); tag matches -->
<!-- Release-discussion convention (user-directed 2026-07-21): every GitHub Release also
     creates a linked discussion — pass --discussion-category "Announcements" to
     gh release create (the UI's "Create a discussion for this release" checkbox) -->

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

From the #170 PR (Phase C, 2026-07-21):

1. **Comment on #182** with the harness's small-n reproductions so the investigation can
   iterate in seconds instead of minutes: the star pathology is already 8.7× at n = 50k
   (`star` scenario), and the `topLevel` 3→4 transition is reachable at n = 300k
   (`sparse-random-l4`: 3.11× vs 2.79× at 50k — the window is exactly n ∈ (2^18, ~376k],
   where t is still 6; t reaches 7 at ~n = 376k and topLevel drops back to 3). Both are
   now standing regression sentinels in `npm run bench`.

_(The #166-PR proposal — close milestone `1.1.0` — was approved and executed 2026-07-21:
milestone #2 is closed on GitHub with 6/6 issues done.)_

_Phase C writes proposed GitHub edits here (and in the PR body); Phase E executes the
approved ones — one confirmation each — and clears them from this list._
_(The #164-PR proposals — re-scope **#166** and the new-export note on **#173** — were
approved 2026-07-21 and found **already executed on GitHub**: #166's live body already
scopes the remaining work to `index.mjs` JSDoc + the `docs/` page (all `src/` modules
verified to carry JSDoc), and #173's body already carries the 2026-07-21
`constantDegreeTransform` update. No writes were needed.)_
_(The #165-PR proposals — none — needed no execution.)_
_(The #188-PR proposals — re-scope **#169** and add the measured optimization note to
**#168** — were executed 2026-07-17.)_
_(The #187-PR proposal — empty-graph validation note on **#165** — was approved and
executed 2026-07-17.)_

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
- **Milestone `1.1.0` — correctness hardening** (in progress). #162 merged (PR #187),
  #163 merged (PR #188), **#165 merged** (PR #191: constructor input validation rejects
  malformed edges, non-numeric node IDs, and invalid weights while preserving empty-graph
  construction), and **#164 done-pending-merge** (this PR): the opt-in constant-degree
  transform (`src/constantDegree.mjs`, re-exported from `index.mjs`) rewrites any graph to
  in/out-degree ≤ 2 by splitting each vertex into a zero-weight port cycle — distance-
  preserving, correctness-independent, verified degree-bounded and oracle-equal from every
  source across the five seeded shapes (incl. the star hub). No bump. **Only #166 (JSDoc)
  now remains — its PR closes the milestone (minor → `1.1.0`).**
- **Phase A reconciliation (2026-07-21, this session):** PR #195 (the #164 branch) merged
  as `main` HEAD `a1dac45`; `05`'s bookmark fast-path flipped. No pending release found
  (`package.json` 1.0.1 == latest tag).
- **#166 merged (PR #196, 2026-07-21):** JSDoc on `index.mjs`'s three public re-exports
  and a full rewrite of `docs/index.html` into a public-API reference (the old page was a
  generic landing page linking to the wrong repo). No `src/`/`test/` changes. Last open
  1.1.0 issue → carried the minor bump; **1.1.0 released same day** (tag + GitHub Release
  with Announcements discussion #197 → npm + Docker Hub) and **milestone 1.1.0 closed**.
- **Phase A reconciliation (2026-07-21):** the #165 PR (#191) and three dependabot workflow
  bumps (#192/#193/#194, `.github/workflows/**` only) had landed on `main` without a
  post-merge session-start marker flip. The #164 PR folds that in: `05`'s bookmark now sits
  at `b36c059` and the "pending" framing for #165 is cleared.
- **Milestone `1.2.0` — performance & ergonomics** (in progress). **#169 merged**
  (PR #189): public `BMSSP.reconstructPath(target)` walks the existing canonical
  predecessor map, with independent path-oracle coverage and public usage docs.
- **#170 done-pending-merge (this PR, 2026-07-21):** the harness runs the head-to-head
  itself. `scenarios.bench.mjs` gains algorithm-only `dijkstra ms`/`bmssp ms`/`ratio`
  columns (both sides on the instance's prebuilt adjacency via the new
  `benchmarks/dijkstra-adj.mjs`; outputs verified, `mismatches` column must be 0) plus a
  `sparse-random-l4` scenario (n = 300k — inside the `topLevel` 3→4 window that starts at
  n = 2^18 + 1). Opt-in `npm run bench:counts` (`compare-counts.bench.mjs`) reproduces
  the comparison-count crossover exactly (sparse 1.20× at 50k → 1.03× at 200k → **0.98×
  at 1M**) via an unconditional `compareKeys` counter in `src/tieBreak.mjs` and matching
  counters in the bench Dijkstra. 7 new harness tests + 3 counter tests (suite 157).
  Fresh `RESULTS.md` captured; `HEAD-TO-HEAD.md` marked as the frozen 1.0.0 record.
  No bump (not a bug fix; #167/#168/#182 still open in 1.2.0).
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

## Milestone `1.1.0` (milestone #2) — correctness hardening — ✅ CLOSED (released 2026-07-21)

All six issues done (build order as executed — cheapest protection first, then the deep work):

| Order | # | Issue | Labels | Notes |
|---|---|---|---|---|
| 1 | 161 | Property/fuzz tests: BMSSP vs Dijkstra on random graphs | enhancement · help wanted | ✅ merged (PR #184, 1.0.1) |
| 2 | 162 | Edge-case tests: disconnected graphs and unreachable nodes | enhancement · help wanted | ✅ merged (PR #187, no bump) |
| 3 | 163 | Deterministic tie-breaking for equal-length paths (Assumption 2.1) | enhancement · help wanted | ✅ merged (PR #188, no bump): composite keys in `src/tieBreak.mjs`, all six tie manifestations resolved by construction |
| 4 | 165 | Input validation for the BMSSP constructor | good first issue · help wanted | ✅ merged (PR #191, no bump): validates graph shape, node IDs, and weights; preserves empty graphs |
| 5 | 164 | Optional constant-degree transform (in/out-degree ≤ 2) | enhancement · help wanted | ✅ merged (PR #195, no bump): `src/constantDegree.mjs`, opt-in + distance-preserving, re-exported |
| 6 | 166 | JSDoc / API docs for the new modules | documentation · good first issue | ✅ merged (PR #196, **minor → `1.1.0`**, released 2026-07-21): JSDoc on `index.mjs`'s re-exports + `docs/index.html` rewritten as the public-API reference (`BMSSP`, `dijkstra`, `constantDegreeTransform`; internals stay out). **Closed milestone 1.1.0** |

## Milestone `1.2.0` (milestone #3) — performance & ergonomics — CURRENT

Build order: ~~#170~~ (done-pending-merge), then **#182** (use the harness's small-n
reproductions to investigate the two measured cliffs), then **#167 / #168** (the
optimizations the investigation informs).

| # | Issue | Labels | Notes |
|---|---|---|---|
| 167 | Restore Lemma 3.3's exact asymptotics in BlockList (balanced-BST bound index + linear-time selection) | enhancement · help wanted | — |
| 168 | Adjacency and relaxation micro-optimizations | enhancement · help wanted | — |
| 169 | Optional shortest-path reconstruction (`Pred[]` → paths) | enhancement · help wanted | ✅ merged (PR #189, no bump): public API + independent path oracle |
| 170 | BMSSP-vs-Dijkstra benchmark comparison | enhancement · help wanted | ✅ done-pending-merge (this PR, no bump): head-to-head + count mode in the harness, verified outputs |
| 182 | Investigate BMSSP performance cliffs: high-fanout (star) graphs and recursion-level transitions | enhancement · help wanted | — |

_Note:_ #182 carries the two measured pathologies (star blowup: 67.8× at n = 500k in the
1.0.0 record, already 8.7× at n = 50k in the harness; the `topLevel` 3→4 transition: 5× at
n = 4M in the record, 3.11× at n = 300k via `sparse-random-l4`); likely overlaps
#167/#168. Since #170 the harness reruns both as regression sentinels on every
`npm run bench`, and `npm run bench:counts` reproduces the comparison-count crossover
(below 1.0 between n = 200k and n = 1M).

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

## Release mechanics (semver: bump only on bug fix or milestone close)

Not every merged PR ships a release — not even every issue-closing PR. **Semver cadence
(user-confirmed 2026-07-17, superseding the 2026-07-16 patch-per-issue cadence):**

1. **Bug-fix PR** (corrects wrong shipped behavior) → **patch** bump inside the PR
   (`npm version patch --no-git-tag-version` keeps `package.json` + `package-lock.json`
   in sync), release after the merge.
2. **PR closing a milestone's last open issue** → **minor** bump (**major** for `2.0.0`),
   so released versions land exactly on the milestone names (`1.1.0`, `1.2.0`, `2.0.0`).
3. **Everything else** — issue-closing or not (tests, docs, tooling, refactors,
   mid-milestone features) → **no bump, no release**; the work reaches npm with the
   milestone-closing release.
4. **After the user confirms the merge** (cases 1–2 only) — tag `main` with the bare
   version (no `v` prefix) and `gh release create` it; publishing the release fires
   `publish.yml` → **npm + Docker Hub**.

(History: pre-1.0 bumped one minor per issue; the #43 PR's `major` closed milestone
`1.0.0`; `1.0.1` shipped under the short-lived patch-per-issue cadence.)

Full procedure + exact commands live in **`../CLAUDE.md` → "Version bump & release"**. The
release step is an outward-facing publish and is **gated on explicit user confirmation**.

## Testing tips
- Small hand-built graphs with known distances for unit tests; seeded generated graphs
  (`benchmarks/generators.mjs`) for equivalence/scale tests — **never unseeded randomness,
  never data files**. `FUZZ_XL=1` opts into the 2M-node round (~30 s).
- Any `bmssp(l, B, S)` call's completed vertices+distances must equal
  `{ v : d_dijkstra(v) < B', shortest path visits S }` — `test/bmssp.test.mjs` has the
  pattern ("recursion contract" describe block).
- Ties (equal path lengths) were the #1 source of subtle bugs until #163 resolved them
  with composite `[length, hops, id]` keys — see "Deterministic tie-breaking" in
  `05-codebase-map.md`. Tie-heavy graphs (0–2 weights) remain the best stress inputs;
  `test/tieBreak.test.mjs` has the edge-order-permutation and lex-oracle patterns.
