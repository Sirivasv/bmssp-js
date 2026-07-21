# 06 — Milestones Roadmap

<!-- SYNCED-FROM-GITHUB: 2026-07-21 (Phase C of the #171 PR, branch
     feat/171-multi-source-entrypoint, based on main 6cab602): 1.2.0 CLOSED; 2.0.0 open,
     2 closed (#205, #172) + 2 open (#171/#173). #171 done-pending-merge this PR (no bump,
     mid-2.0.0), leaving #173 as the milestone-closing issue (major → 2.0.0). -->
<!-- Current package version: 1.2.0 — released 2026-07-21 (tag + GitHub Release with
     Announcements discussion → npm + Docker Hub via publish.yml); tag matches -->
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

**#171 PR (this PR) — one proposal:**

1. **Comment on #173** (API stabilization, the milestone-closing issue) recording the
   #171-derived decisions it must resolve, now that the public multi-source surface exists:
   - #171 shipped `calculateShortestPathsFrom` as **additive** (write-to-Map, returns nothing)
     rather than taking the "may change existing signatures" latitude the #171 body mentioned —
     so #173 owns every remaining breaking decision. Decide the **public/private split** for
     the now-plain-method interior (`bmssp(l,B,S)`, `bmsspIndex`, `syncLabelsIn/Out`,
     `boundToEngine`/`keyToPublic`, `normalizeSources`) — should the raw `bmssp` wrapper stay
     public or move behind a private boundary?
   - Document `calculateShortestPathsFrom` in the **migration note + `docs/index.html`** as a
     public export alongside `Graph` (#172): its flexible `sources` shapes and the
     **bounded-run pruning semantic** (finite `B` exposes only the completed set `U`).
   - Consider whether to surface the richer `{ bound, vertices }` result #171 **discarded**
     (write-to-Map was chosen for parallelism with `calculateShortestPaths`) — e.g. an
     optional return or a companion method — as part of finalizing the 2.0 surface.

   _(No new issues and no milestone re-slicing: 2.0.0 is on track with **#173 the only issue
   left**; #171's substrate is exactly what #173 stabilizes.)_

_Previously executed proposals (kept for provenance):_

_(The #172-PR proposals (PR #208) — scope-summary comment on closed **#172** (flexible-input
surface shipped; direct-CSR construction perf lever deferred because `this.graph` /
`this.adjacency` are public tested fields) and a carry-over comment on **#173** (decide the
fate of those public fields → unblocks direct-CSR construction; document the `Graph` /
adjacency surface + object-key coercion in the migration note, add `Graph` as the 4th export
on `docs/index.html`, mirror a `Graph` example into the gallery) — were approved and executed
2026-07-21: both comments posted.)_

_(No #171 proposal was needed: #172's normalization + explicit vertex-set API is exactly the
substrate #171's public multi-source entrypoint will consume, which the #171 notes already
anticipate.)_

_(The examples/Docker-PR proposal (PR #207) — comment on **#173** pointing its migration
note / public-surface decision at the new `examples/` gallery as the canonical runnable
public-API reference, and keeping the gallery in lockstep with any 2.0.0 surface change —
was approved and executed 2026-07-21: comment posted on #173.)_

_(The #205-PR proposals — engine-baseline comment on **#172** (class now holds the graph
as index+CSR + typed labels; typed inputs should ingest straight into it and expose an
explicit vertex-set API; #205 ~halved wall-clock so #172 is the next lever) and a
build-order confirmation (#205 kept the API backward-compatible → #171 is surface design;
order stays #205 → #172 → #171 → #173) — were handled 2026-07-21: the #172 comment was
approved and posted; the ordering note needed no GitHub write.)_
_(The #168-PR proposals — close milestone **1.2.0** (5/5 done) and open the
**dense-index core** issue (typed-array labels + CSR adjacency; label-Map traffic ~38%
of post-#168 self-time) — were approved and executed 2026-07-21: milestone #3 closed,
issue **#205** created in 2.0.0.)_
_(The #167-PR proposal — the post-#167 baseline comment on **#168** (BlockList no longer
a count factor, crossover now <50k; relaxEdge allocation / Set churn / per-level relax
pass are the remaining targets; #168 is the milestone-closing issue) — was approved and
executed 2026-07-21.)_
_(The #182-PR proposals — findings comments on **#167** (remaining scope = BST bound
index + linear-time selection; batchPrepend quadratic fixed) and **#168** (per-level
O(m + n) relax pass dominates; relaxEdge allocation + Set churn targets; +24% level
step) — were approved and executed 2026-07-21.)_
_(The #170-PR proposal — comment on **#182** with the harness's small-n reproductions —
was approved and executed 2026-07-21: star 8.7× at n = 50k, `sparse-random-l4` 3.11× at
n = 300k inside the topLevel 3→4 window n ∈ (2^18, ~376k].)_
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
- **#170 merged (PR #198, 2026-07-21, commit a1a9ef5):** the harness runs the
  head-to-head itself. `scenarios.bench.mjs` gained algorithm-only
  `dijkstra ms`/`bmssp ms`/`ratio` columns (both sides on the instance's prebuilt
  adjacency via the new `benchmarks/dijkstra-adj.mjs`; outputs verified, `mismatches`
  column must be 0) plus a `sparse-random-l4` scenario (n = 300k — inside the `topLevel`
  3→4 window that starts at n = 2^18 + 1). Opt-in `npm run bench:counts`
  (`compare-counts.bench.mjs`) reproduces the comparison-count crossover exactly (sparse
  1.20× at 50k → 1.03× at 200k → **0.98× at 1M**) via an unconditional `compareKeys`
  counter in `src/tieBreak.mjs` and matching counters in the bench Dijkstra. 7 new
  harness tests + 3 counter tests (suite 157). Fresh `RESULTS.md` captured;
  `HEAD-TO-HEAD.md` marked as the frozen 1.0.0 record. No bump, no release. The Phase E
  proposal (comment on #182 with the small-n reproductions) was approved and posted the
  same day.
- **Coverage follow-up merged (PR #199, 2026-07-21, commit 4891318; no issue, no bump):**
  the harness's mismatch counter extracted to `bench-util.mjs` `countMismatches` (shared
  by `scenarios.bench.mjs` and `compare-counts.bench.mjs`) and unit-tested on both
  branches, closing the uncovered defensive lines in `compare-counts.bench.mjs` — both
  benchmark modules now at 100% statement+branch coverage (suite 159).
- **#182 merged (PR #200, 2026-07-21, commit 16e53f2; 1.1.1 released same day):** cliff
  investigation complete. CPU
  profiles + prototype-level instrumentation localized the **star blowup** to quadratic
  per-chunk `d0.unshift` in `BlockList.batchPrepend` (~1.25e9 element moves at n = 50k;
  64% of self-time) — **fixed** with a single-concat prepend (star 500k: 61 s → ~3.1 s,
  67.8× → ~5.5×, ratio now falls with n; 2 regression tests added, suite 161). The
  **`topLevel` 3→4 cliff** was measured at the exact straddle (n = 2^18 → 2^18 + 1, same
  seed): an inherent **+24% step** (one extra full relax pass + Set churn per level) —
  documented as known behavior in `HEAD-TO-HEAD.md`'s #182 addendum; the 1.0.0 record's
  5× at 4M is that step plus GC/memory amplification. **Bug fix → patch bump 1.1.1**
  (batchPrepend violated its documented Lemma 3.3 amortized bound); **1.1.1 released
  2026-07-21**. Findings posted on #167/#168 (approved proposals, executed same day).
- **#167 merged (PR #202, 2026-07-21, commit 1af81c2; no bump):** BlockList's two documented
  shortcuts replaced to meet Lemma 3.3's exact per-operation bounds — the plain-array
  bound index by `src/boundIndex.mjs` (`BoundIndex`, a positional AVL tree searched
  through the monotone block bounds; O(log #blocks) search/split/drop) and the
  sort-based splits/chunking/pulls by `src/select.mjs` (`partitionByRank`, budgeted
  introselect: deterministic median-of-3 quickselect with a median-of-medians fallback —
  worst-case linear, ~2–3n comparisons typical). First cut used pure median-of-medians
  (~10–20n comparisons) and REGRESSED both wall-clock (star +68%) and counts (1M
  crossover lost) — caught by the harness, fixed with the introselect budget and a
  two-branch batchPrepend chunker (sort when |L| ≥ ⌈M/2⌉², median recursion below).
  Net result: **comparison-count crossover moved from ~n = 1M to before n = 50k**
  (0.97×/0.77×/0.66× at 50k/200k/1M; grid 1.27× → 1.12×), wall-clock at-or-better than
  1.1.1 everywhere. +22 tests (suite 185: `select` 11, `boundIndex` 8, BlockList +5,
  incl. a forced-fallback path via the `cheapBudget: 0` knob). Behavior-preserving:
  all pre-existing tests unchanged; extended FUZZ_ROUNDS=25 and FUZZ_XL runs green.
  No bump (not a bug fix; #168 still open in 1.2.0). Addendum added to
  `HEAD-TO-HEAD.md`; `RESULTS.md` recaptured; stale crossover blurbs updated in the
  harness and `benchmarks/README.md`. The Phase E proposal (baseline comment on #168)
  was approved and posted the same day.
- **#168 merged (PR #203, 2026-07-21, commit f7052c5; minor → 1.2.0, released and
  milestone closed same day):** relaxation
  micro-optimizations. `relaxEdge` reworked allocation-free (returns `RELAX_LOST` /
  `RELAX_EQUAL` / `RELAX_IMPROVED` codes; the old per-attempt `{ key, improved }`
  object + up to three throwaway key arrays are gone — callers materialize a key with
  `orderKey` only on enqueue paths), new `compareKeyParts(length, hops, id, key)` lets
  the band routing in `bmssp()`/`findPivots` compare unpacked stored labels without
  allocating, and the three hot edge loops became indexed loops (no per-edge iterator +
  destructuring). Clean A/B vs post-#167 main: **−13–23% wall-clock** (sparse 50k ~111
  → ~87 ms, star ~147 → ~127 ms, sparse-l4 300k ~1123 → ~862 ms), comparison counts
  down ~1–3% (1.2.0 capture: sparse 0.95×/0.76×/0.65× at 50k/200k/1M). **Heap
  strategy resolved by measurement:** lazy duplicate-and-skip wins an isolated
  BaseCase micro-benchmark but BaseCase heaps are capped at k+1 ≈ 4 entries and never
  register end-to-end — the paper-literal indexed `MinHeap` is kept. The "skip the
  per-level re-relax pass" idea was rejected as paper-infidelity: that pass is the `≤`
  reuse mechanism (Remark 3.4) surfacing ≥-Bi neighbors the child deliberately drops.
  Suite 186 (+1 compareKeyParts agreement sweep; relaxEdge unit tests updated to the
  code contract); FUZZ_ROUNDS=25 and FUZZ_XL green. Next lever (label-Map traffic,
  ~38% self-time) proposed as a 2.0.0 dense-index issue (Roadmap proposal 2).
- **#205 merged (PR #206, 2026-07-21, commit cbcaab1; no bump — API-non-breaking):** the
  dense-index core, first issue of milestone 2.0.0. `buildIndex()` assigns every node id
  a dense index in **ascending-id order**, lays the graph out in **CSR** typed arrays
  (`this.csr` = offsets/targets/weights), and holds d̂/hops/preds as typed arrays
  (`makeLabels` in `tieBreak`: Float64/Uint32/Int32). `baseCase`/`findPivots`/the new
  `bmsspIndex` recursion run **entirely on indices** — `relaxEdge` reads/writes the typed
  arrays, edge loops walk CSR ranges, `NO_PRED` became `-1`. Because index order = id
  order, canonical labels are byte-for-byte identical to the Map engine (the whole
  determinism + oracle suite passes unchanged — the correctness proof). **The public API
  did NOT change:** `bmssp(l,B,S)` is now a thin id↔index wrapper (syncLabelsIn/Out +
  boundToEngine/keyToPublic), `shortestPaths`/`hops`/`preds` stay the public Maps,
  `reconstructPath` reads the mirror. **Result: roughly halved wall-clock** — clean A/B
  vs 1.2.0: sparse 50k ~104 → ~53 ms, star ~145 → ~100 ms, sparse-l4 300k ~982 → ~424 ms;
  head-to-head **sparse-random 2.5× → 1.38×**, l4 1.07×, dense 1.16×. Comparison counts
  unchanged (0.95×/0.76×/0.65× sparse). Suite 191 (+5: 4 #205 boundary tests in
  `bmssp.test.mjs` + a `makeLabels`-defaults check; `baseCase`/`findPivots`/`tieBreak`
  unit tests rewritten to drive the index API); 100% statement coverage, lint clean,
  FUZZ_ROUNDS=25 + FUZZ_XL green. Phase E: engine-baseline comment posted on #172; the
  build-order confirmation needed no GitHub write. **#172 is next.**
- **#172 merged (PR #208, 2026-07-21, commit 6cab602; no bump — mid-2.0.0):** typed /
  flexible graph inputs. New `src/graph.mjs` exports a
  chainable **`Graph`** builder (`addVertex`/`addEdge`, isolated-vertex declaration) and
  `normalizeGraphInput`; the BMSSP constructor now accepts an **edge array** (unchanged),
  an **adjacency `Map`**, a **plain adjacency object** (`{ from: [[to,weight]…] }`,
  numeric-string keys coerced), or a **`Graph`** — all reduced to `{ edges, vertices }`,
  with `vertices` the explicit declarable universe (isolated nodes get an index, an empty
  CSR range, an ∞ estimate, and are valid as a source). `Graph` re-exported from
  `index.mjs` (now four public exports). Node-ID semantics unchanged (finite numbers,
  ascending-id indices) → canonical `[length, hops, id]` tie-break and every
  oracle/determinism assertion untouched; 18-test `graph.test.mjs` (cross-shape oracle
  equivalence on seeded 2k + all failure modes), suite 209 (208 + 1 XL skip), `graph.mjs`
  100%, lint clean. **Scope boundary (flag for review):** this delivers the flexible-input
  *surface* but keeps the internal edge-list round-trip — the #206 comment's "construct
  straight into CSR without the `[from,to,weight]` array" perf lever was **deferred**,
  because `this.graph` (and `this.adjacency`) are public, tested fields that must be
  populated regardless; removing them to build CSR directly is a breaking change better
  owned by **#173** (API stabilization). See Roadmap proposals.
- **#171 done-pending-merge (this PR, no bump — mid-2.0.0):** public multi-source /
  bounded entrypoint. `BMSSP.calculateShortestPathsFrom(sources, { bound })` is a thin,
  ergonomic surface over the existing `bmssp(topLevel, B, S)` wrapper — it hides the
  recursion level and the "seed `this.shortestPaths` first" ritual the fuzz suite uses
  directly. `sources` accepts a `Map<id,dist>`, object `{id:dist}`, array of `[id,dist]`
  pairs, or bare id array (distance 0), reduced by the new `normalizeSources` helper;
  `bound` defaults to `Infinity`. Results write into the public Maps (returns nothing, like
  `calculateShortestPaths`); under a **finite** bound the mirror is pruned to the returned
  completed set `U`, so only vertices with `d(v) < B` keep their exact distance (BMSSP's
  above-`B` over-estimates are cleared). **Additive only** — `calculateShortestPaths`,
  `bmssp`, `reconstructPath` and the `[length, hops, id]` tie-break are untouched; the
  breaking-signature latitude the #171 body mentioned is deferred to #173. New 19-test
  `multiSource.test.mjs` (single-source equivalence, nearest-of-many + custom-`d0`
  multi-source oracle, bounded pruning, all input shapes, integration, validation); suite
  228 (227 + 1 XL skip), `bmssp.mjs` 100%, lint clean. **#173 is the only 2.0.0 issue
  left** (milestone-closing, major → 2.0.0). One Roadmap proposal (comment on #173).
- **Examples + Docker refresh (PR #207 merged, 2026-07-21, commit 50faa4a;
  user-directed, no issue, no bump):** the stale single `examples/main.mjs` (it only
  printed the raw edge list — never ran the algorithm) is replaced by a standalone gallery
  — `01-basic` (calculateShortestPaths + reconstructPath), `02-dijkstra-oracle` (per-node
  match table vs the exported oracle), `03-constant-degree` (transform + sourceCopy/collapse),
  `04-larger-graph` (generated 40×40 grid, timing + oracle spot-check), `run-all` and a
  gallery `README`. Each file imports from the **published** `bmssp` package, so users run
  them after `npm install bmssp`. The Dockerfile now `COPY examples/`-es the whole dir,
  carries OCI image labels + `--omit=dev`, and defaults its `CMD` to `run-all.mjs` (was the
  trivial example); the README Docker section documents the run / single-example-override /
  volume-mount recipes. Verified end-to-end with the local docker CLI (build + run: all four
  examples green, oracle checks pass; override and mount forms confirmed). No src/test
  change; docs/tooling only → no bump, no release.
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

## Milestone `1.2.0` (milestone #3) — performance & ergonomics — ✅ CLOSED (released 2026-07-21)

Build order (as executed): ~~#170~~ (merged, PR #198), ~~#182~~ (merged, PR #200, 1.1.1),
~~#167~~ (merged, PR #202), ~~#168~~ (merged, PR #203, **minor → 1.2.0**, released
2026-07-21) — all five issues done; milestone closed 2026-07-21.

| # | Issue | Labels | Notes |
|---|---|---|---|
| 167 | Restore Lemma 3.3's exact asymptotics in BlockList (balanced-BST bound index + linear-time selection) | enhancement · help wanted | ✅ merged (PR #202, no bump): `BoundIndex` AVL sequence + `partitionByRank` introselect; count crossover moved ~1M → <50k (0.66× at 1M); wall-clock at-or-better |
| 168 | Adjacency and relaxation micro-optimizations | enhancement · help wanted | ✅ merged (PR #203, **minor → 1.2.0**, released 2026-07-21): allocation-free relaxEdge (RELAX_* codes) + compareKeyParts routing + indexed edge loops → −13–23% wall-clock, counts down ~1–3%; heap strategy measured, indexed MinHeap kept; dense-index follow-up = #205 (2.0.0) |
| 169 | Optional shortest-path reconstruction (`Pred[]` → paths) | enhancement · help wanted | ✅ merged (PR #189, no bump): public API + independent path oracle |
| 170 | BMSSP-vs-Dijkstra benchmark comparison | enhancement · help wanted | ✅ merged (PR #198, no bump): head-to-head + count mode in the harness, verified outputs |
| 182 | Investigate BMSSP performance cliffs: high-fanout (star) graphs and recursion-level transitions | enhancement · help wanted | ✅ merged (PR #200, **patch → 1.1.1**, released 2026-07-21): star = quadratic batchPrepend, fixed (61 s → ~3.1 s at 500k); level step = inherent +24%, documented (HEAD-TO-HEAD addendum) |

_Note:_ both #182 shapes stay as regression sentinels in every `npm run bench` (`star`,
`sparse-random-l4`), and `npm run bench:counts` reproduces the comparison-count crossover
(below 1.0 before n = 50k since #167; ~n = 1M in the 1.0.0/1.1.1 records).

## Milestone `2.0.0` (milestone #4) — API-breaking generalization — CURRENT

Build order (derived 2026-07-21 at RKB, after 1.2.0 closed): ~~#205~~
(merged, PR #206) → ~~#172~~ (merged, PR #208) → ~~#171~~ (done-pending-merge, this PR) →
**#173**. Rationale:
the dense-index engine (#205) decides the internal shapes every new API wraps, so it went
first; typed/flexible inputs (#172) generalized the constructor surface over it; the public
multi-source entrypoint (#171) is designed value-in/value-out over the finished engine and
reuses #172's normalization + explicit vertex-set substrate; and stabilization (#173) locks
the surface last and takes the **major → 2.0.0** bump as the milestone-closing PR.

| # | Issue | Labels | Notes |
|---|---|---|---|
| 205 | Dense-index core: typed-array labels + CSR adjacency | enhancement | ✅ merged (PR #206, no bump — API-non-breaking): sorted-id index + CSR + typed labels; wall-clock ~halved (sparse head-to-head 2.5× → 1.38×), counts unchanged |
| 172 | Typed / flexible graph inputs | enhancement · help wanted | ✅ merged (PR #208, no bump): `Graph` builder + adjacency Map/object inputs + explicit declarable vertex universe, reduced via `normalizeGraphInput`; node-ID semantics unchanged. Deferred the direct-CSR construction perf lever to #173 (coupled to public `this.graph`) |
| 171 | Public multi-source / bounded BMSSP entrypoint | enhancement · help wanted | ✅ done-pending-merge (this PR, no bump): `calculateShortestPathsFrom(sources, { bound })` — additive surface over the `bmssp(l,B,S)` wrapper, flexible `sources` shapes + finite-bound pruning to the completed set `U`. Breaking-signature latitude deferred to #173 |
| 173 | Stabilize the public API surface for 1.0 → 2.0 | documentation · enhancement | **NEXT / milestone-closing**: per-module public/private decision (incl. whether the raw `bmssp(l,B,S)` wrapper stays public, and whether `this.graph`/`this.adjacency` stay public — the deferred #172 direct-CSR lever), migration note + `Graph`/`calculateShortestPathsFrom` docs, **major → 2.0.0** |

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
