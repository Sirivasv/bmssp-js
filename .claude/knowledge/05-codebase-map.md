# 05 — Codebase Map (current state)

<!-- BOOKMARK-COMMIT: e25d89795947484726a72ae394ac19d502f86942 -->
<!-- PENDING-PR-BRANCH: northset/bmssp-js-169 -->
<!-- Last validated: 2026-07-19 (Phase C of the #169 PR). Describes the tree as it will
     exist once that PR merges: BMSSP.reconstructPath(target) exposes the canonical
     predecessor tree already maintained since #163; path-oracle tests and public usage
     documentation are included. No version bump (mid-milestone enhancement; milestone
     1.2.0 remains open — semver convention, 06 "Release mechanics"). -->

Snapshot of what exists in `bmssp-js` today, so you know what to build on vs. what's missing.

## 🔄 Bookmark validation procedure (this file is DYNAMIC)

This map describes the repo **as of the tree identified by the two markers above**:

- `BOOKMARK-COMMIT` — the `main` commit this map was last validated against.
- `PENDING-PR-BRANCH` — set only while a PR is in flight: this map was rewritten **inside
  that PR** (Phase C of `../CLAUDE.md`) and already describes the tree that PR will merge.
  `(none)` otherwise.

**At session start** (Phase A — after `git checkout main && git pull origin main`), run
`git rev-parse HEAD` and follow exactly one branch:

1. **HEAD == `BOOKMARK-COMMIT`** → map is current. Done.
2. **`PENDING-PR-BRANCH` is set** (not `(none)`) → our own PR may have just merged:
   ```bash
   gh pr list --repo Sirivasv/bmssp-js --head <PENDING-PR-BRANCH> --state merged \
     --json number,mergeCommit --jq '.[0]'
   ```
   - If it merged and its `mergeCommit` **== HEAD** → this map already describes HEAD.
     Set `BOOKMARK-COMMIT` to HEAD, set `PENDING-PR-BRANCH` to `(none)`, refresh the
     "Last validated" comment. Done — no re-inspection needed.
   - If it merged but HEAD moved **past** the merge commit → do step 3 using the merge
     commit as the baseline instead of `BOOKMARK-COMMIT`.
   - If it did **not** merge (PR still open/closed unmerged) → the map describes a tree
     that isn't on `main`; rewrite the map from `main`'s actual tree (step 3 with
     `BOOKMARK-COMMIT` as baseline), keep or clear the marker to match PR reality.
3. **Otherwise (repo moved under us)** →
   ```bash
   git diff --stat <baseline> HEAD    # if the baseline commit is unresolvable locally,
                                      # skip the diff and re-inspect everything below
   ```
   Re-read whatever changed under `src/`, `test/`, `benchmarks/`, `examples/`,
   `index.mjs`, `package.json`; rewrite the affected sections (layout, module APIs,
   "Gaps to fill" table); set `BOOKMARK-COMMIT` to HEAD and `PENDING-PR-BRANCH` to
   `(none)`.

**In Phase C (pre-PR, on the feature branch):** rewrite the body of this map to describe
the branch's tree (i.e. post-merge reality), leave `BOOKMARK-COMMIT` at the `main` commit
the branch is based on (`git merge-base main HEAD`), and set `PENDING-PR-BRANCH` to the
feature branch name. Step 2 above then fast-paths the post-merge session start.

## Layout

```
index.mjs                 # re-exports { BMSSP } and { dijkstra }
src/
  bmssp.mjs               # BMSSP class — full Algorithm 3 recursion (#43); wires the pieces below
  dijkstra.mjs            # reference Dijkstra (array binary-heap) — DONE, used as oracle
  tieBreak.mjs            # #163: composite [length, hops, id] keys — Assumption 2.1 realized (compareKeys/toBound/relaxEdge)
  blockList.mjs           # #42: Lemma 3.3 block-based partial-sort structure D (comparator-aware since #163)
  heap.mjs                # #41: indexed binary min-heap (MinHeap) for BaseCase (comparator-aware since #163)
  baseCase.mjs            # #40: BaseCase(B, S) — Algorithm 2 bounded mini-Dijkstra on composite keys
  findPivots.mjs          # #44: FindPivots(B, S) — Algorithm 1 frontier shrink, canonical-pred forest
test/
  main.test.mjs           # Jest tests: constructor, nodeIDs, adjacency, shortestPaths, BMSSP-vs-Dijkstra (seeded 10k sparse)
  bmssp.test.mjs          # #43: 15 recursion tests — params, hand graphs, ties, Lemma 3.1 contract, seeded stress
  fuzz.test.mjs           # #161: 18 high-volume fuzz tests — shapes × weight regimes × multi-source × seeded scale; FUZZ_ROUNDS / FUZZ_XL env vars
  edgeCases.test.mjs      # #162: 9 deterministic disconnection fixtures — isolated/sink sources, many components, source switching
  tieBreak.test.mjs       # #163: 16 tests — key order, canonical relaxEdge, edge-order determinism, strict Lemma 3.1, lex-oracle hops/preds
  pathReconstruction.test.mjs # #169: 3 public-API tests — Dijkstra path oracle, unreachable/pre-run/source switching, target validation
  blockList.test.mjs      # #42: 18 BlockList tests incl. a seeded random stress test
  heap.test.mjs           # #41: 16 MinHeap tests incl. a seeded stress test vs. a naive queue
  baseCase.test.mjs       # #40: 13 BaseCase tests incl. seeded oracle-comparison stress
  findPivots.test.mjs     # #44: 12 FindPivots tests incl. two seeded oracle stress tests
  README.md               # test-suite principles (everything seeded, no data files) + file map
benchmarks/               # dependency-free benchmark harness, `npm run bench`
  generators.mjs          #   seeded graph builders + SCENARIOS registry (sparse/dense/grid/chain/star)
  bench-util.mjs          #   timing (timeMany) + markdown-table helpers
  adjacency.bench.mjs     #   adjacency map (#45) vs. linear edge scan
  scenarios.bench.mjs     #   construct + Dijkstra timings per graph shape
  run.mjs                 #   runs all benchmarks, prints markdown report
  README.md               #   methodology + "when to use which" guidance
  RESULTS.md              #   captured sample run
  HEAD-TO-HEAD.md         #   measured BMSSP-vs-Dijkstra (1.0.0): wall-clock + comparison counts
examples/
  main.mjs                # tiny usage example (constructs BMSSP, prints .graph)
docs/index.html           # published docs page
```

Tooling: Jest (`npm test`, needs `--experimental-vm-modules`, already in the `test` script),
ESLint + Prettier (`npm run lint` / `npm run format`), Dockerfile, GitHub Actions (dependabot
bumps dominate recent history). `eslint.config.js` **ignores `.claude/**`** so the agent
knowledge base (markdown with pseudocode fences) isn't linted as shippable code.
**`main` now has branch-protection rules**: changes land through PRs only, commits must have
verified signatures (squash-merge via the GitHub UI signs for you), and CodeQL must pass —
direct `git push origin main` is rejected, including for docs-only bookkeeping commits.

## `src/bmssp.mjs` — the BMSSP class (Algorithm 3 wired in, #43)

```js
class BMSSP {
  constructor(inputGraph)          // inputGraph = array of [from, to, weight]
  //   this.graph          : deep-copied edge array
  //   this.nodeIDs        : Set of all node IDs (from both endpoints)
  //   this.shortestPaths  : Map<nodeId, distance>, initialized to Infinity  ← this is d̂[·]
  //   this.adjacency      : Map<nodeId, Array<[to, weight]>>  ← #45, built in constructor
  //   this.hops, this.preds : Map — #163 canonical labels (edge count + predecessor of the
  //                           canonical shortest path), updated in lockstep with d̂
  //   this.ties           : { hops, preds } bundle handed to relaxEdge
  //   this.k, this.t, this.topLevel : paper parameters, derived in the constructor
  initializeShortestPaths()        // (re)set every nodeId's distance to Infinity; clears hops/preds
  buildAdjacency()                 // #45: (re)build adjacency from this.graph
  getEdges(nodeId)                 // #45: O(1) outgoing-edge lookup; [] for unknown nodes
  deriveParameters()               // #43: k = max(1,⌊(log₂n)^⅓⌋), t = max(1,⌊(log₂n)^⅔⌋),
                                   //      topLevel = max(1,⌈log₂n / t⌉) — from this.nodeIDs.size
  bmssp(l, B, S)                   // #43: Algorithm 3 → { bound, boundKey, vertices } (B', its
                                   //      composite key, U); B scalar or composite — scalar in,
                                   //      scalar bound out (boundKey always composite)
  calculateShortestPaths(startNode)// #43: validates, sets d̂[start] = 0 (hop 0), runs
                                   //      bmssp(topLevel, Infinity, {startNode}) — NO Dijkstra
  reconstructPath(target)          // #169: source→target path from canonical preds; [] before
                                   //      a run or when unreachable; throws for unknown target
}
```

**`bmssp(l, B, S)` (#43):** level 0 delegates to `baseCase`. At level ≥ 1: `findPivots`
shrinks the frontier; pivots seed a `BlockList(M = 2^((l-1)·t), B, compareKeys)`; the loop
pulls `Bi, Si ← D.pull()`, recurses `bmssp(l-1, Bi, Si)`, relaxes edges out of the returned
`Ui` (band `[Bi, B)` → `D.insert`, band `[Bi', Bi)` → staged `K` → `D.batchPrepend` together
with the uncompleted `Si` members), and stops when `D` empties (success, `boundKey` = B's
key) or `|U| ≥ k·2^(l·t)` trips (partial). Finally folds in the `W` vertices below the
returned bound. Since `k·2^(topLevel·t) ≥ n`, the top call is always a successful execution.

**Deterministic tie-breaking (#163, `src/tieBreak.mjs`).** All internal ordering uses
composite `[length, hops, id]` keys (lexicographic), realizing the paper's Assumption 2.1
(distinct path lengths): a zero-weight edge strictly increases `hops`, distinct vertex ids
make every frontier comparison strict. Consequences, replacing the pre-#163 guards:
1. **Canonical relaxation** (`relaxEdge`): d̂/hops/preds update together iff the candidate
   path key `[d̂[u]+w, hops[u]+1, u]` beats the stored one — the chosen predecessor is the
   smallest among `(length, hops)`-optimal parents, independent of edge/iteration order.
2. **Exact-equality re-enqueue** (the paper's `≤` made canonical): when a completed `u`
   re-derives `v`'s label exactly, `v` is re-enqueued at the current level (it was labeled
   by a deeper call without being completed) — only the recorded label-setter triggers
   this; the `U.has(v)` / `settled.has(v)` filters keep it finite. This is the lazy repair
   chain that lets labels set by excluded boundary vertices get completed later.
3. **Strict Lemma 3.1:** pull separators are strict, pivots never arrive tied with `B`
   (the seeding filter now only scopes direct multi-source callers' sources), boundary-tied
   batch members are impossible, a child's `U` is never empty — the old stall escape hatch
   is gone. `boundKey` is strict: every returned vertex's key < `boundKey`; in the scalar
   projection a returned vertex may still tie `bound`'s length (`d(v) ≤ bound`), never
   exceed it.
4. **Full determinism:** distances, hops, preds, and even partial-call `U`/`boundKey` are
   invariant under edge-list permutation (`test/tieBreak.test.mjs` asserts this).

**Performance (measured 2026-07-16, Apple Silicon, node v26.5.0 — full data + methodology
in `benchmarks/HEAD-TO-HEAD.md`):** algorithm-only wall-clock (construction excluded,
Dijkstra fed the same prebuilt adjacency): Dijkstra wins every shape/size; sparse-graph
ratio narrows with n (2.54× at 50k → **1.57× at 2M**). **Comparison
counts (the paper's metric) cross over:** BMSSP does fewer distance comparisons than
Dijkstra past ~n = 1M sparse (0.96× at 1M, **0.91× at 2M**). Two measured pathologies,
tracked in **#182**: star graphs blow up superlinearly (67.8× at n = 500k) and the ratio
cliffs to 5× at n = 4M where `topLevel` steps 3→4. Note `topLevel` is **3 from n = 10k
all the way to 2M** — scale tests buy volume/memory pressure, not recursion depth. The
default suite runs in ~3 s; the opt-in `FUZZ_XL=1` 2M-node round takes ~33 s (#163's
composite keys added ~10% over the ~30 s scalar baseline — candidate for #168).

## `src/blockList.mjs` — Lemma 3.3 structure `D` (#42)

```js
class BlockList {
  constructor(M, B, compare?) // block/pull size M >= 1 (floored), strict value upper bound B
                              // (Infinity OK); optional value comparator (default numeric) —
                              // #163 passes compareKeys with composite-key values and bounds
  get size / isEmpty()
  insert(key, value)       // throws if !(value < B); duplicate key keeps the smallest value
  batchPrepend(pairs)      // iterable of [key, value]; caller guarantees "smaller than everything stored"
  pull()                   // → { keys: Set, bound } — the ≤M smallest keys; bound = min(remaining)
}                          //   exactly (strict under a total order); bound === B when drained
export { BlockList };      // NOT re-exported from index.mjs — internal to the algorithm
```

Implementation notes (matches §03-B including its documented shortcuts):
- `d1` (insert blocks) + `d0` (prepend blocks); values ordered between blocks, unsorted within.
  Blocks are `{ bound, entries: Map }`; a `locator` Map (key → block) gives O(1) duplicate handling.
- Bound index = plain array + binary search instead of a balanced BST (upgrade tracked as #167).
- Overfull `d1` block splits around the median via sort (O(M log M), not linear-time selection).
- Big `batchPrepend` batches are sorted and chunked into blocks of ≤ ⌈M/2⌉, prepended to `d0`.
- Last `d1` block (bound `B`) is kept even when empty so every `insert` finds a home.
- The pulled set is always the exact M smallest values regardless of block layout, so pulls
  are insertion-order independent. Under #163's composite keys (all values distinct) the
  separator is strictly above every pulled value — the pre-#163 tie caveat (bound tying a
  pulled key, `d̂ == Bi` batch members) is gone.

## `src/heap.mjs` — indexed binary min-heap (#41)

```js
class MinHeap {
  constructor(compare?)    // optional value comparator (default numeric; non-number values
                           // then throw) — #163's baseCase passes compareKeys
  get size / isEmpty()
  has(key)                 // O(1) membership — Algorithm 2's "if v not in H"
  getValue(key)            // current value or undefined
  peekMin()                // → { key, value } without removing; throws when empty
  insert(key, value)       // throws on duplicate key (and non-number value in numeric mode)
  decreaseKey(key, value)  // throws on missing key; ignored unless value < current (smallest wins)
  extractMin()             // → { key, value }; throws when empty
}
export { MinHeap };        // NOT re-exported from index.mjs — internal to the algorithm
```

The **true indexed heap** from §03-A (entries array + `position` Map for O(log n)
`decreaseKey`), matching Algorithm 2 literally — deliberately not the lazy duplicate-and-skip
variant `src/dijkstra.mjs` uses internally. An extracted key may be re-inserted later.

## `src/baseCase.mjs` — `BaseCase(B, S)`, Algorithm 2 (#40)

```js
baseCase(B, S, dHat, adjacency, k, ties?)  // → { bound, boundKey, vertices }
// B         : strict upper bound — scalar (Infinity OK) or composite key; scalar in,
//             scalar bound out (boundKey always the composite boundary)
// S         : singleton Set holding the complete source x (throws otherwise)
// dHat      : Map<nodeId, number> — the global d̂[·]; RELAXED IN PLACE
// adjacency : Map<nodeId, [to, weight][]> — the class's this.adjacency
// k         : settle cap >= 1 (floored); throws otherwise
// ties      : { hops, preds } canonical labels (#163); fresh throwaway maps by default
export { baseCase };     // NOT re-exported from index.mjs — internal to the algorithm
```

Bounded mini-Dijkstra from `x` on a `MinHeap(compareKeys)` ordered by composite keys,
stopping after settling `k+1` vertices. Full success (heap exhausted at ≤ k settled) →
`{ bound: B, vertices: U0 }`; partial (cap hit) → `boundKey` = max settled key, `vertices` =
exactly the k strictly-closer ones (composite-strict: a returned vertex may tie the
boundary's scalar length). Relaxation is canonical `relaxEdge` gated by `< B`; the settled
filter only skips exact-equality re-enqueue signals, keeping zero-weight plateaus quiescent.
`bmssp()` calls it at level 0 (the pre-#163 escape-hatch re-use is gone).

## `src/findPivots.mjs` — `FindPivots(B, S)`, Algorithm 1 (#44)

```js
findPivots(B, S, dHat, adjacency, k, ties?)  // → { pivots, W }
// B         : strict bound gating membership in W — scalar (Infinity OK) or composite key;
//             d̂ updates are NOT gated
// S         : non-empty Set of complete frontier sources (throws if empty / any d̂ not finite)
// dHat      : Map<nodeId, number> — the global d̂[·]; RELAXED IN PLACE
// adjacency : Map<nodeId, [to, weight][]> — the class's this.adjacency
// k         : rounds + tree-size threshold >= 1 (floored); throws otherwise
// ties      : { hops, preds } canonical labels (#163); fresh throwaway maps by default
export { findPivots };   // NOT re-exported from index.mjs — internal to the algorithm
```

`k` strictly-layered rounds of canonical relaxation out of `S` (`relaxEdge`, ungated;
`< B` in the composite order gates only membership in `W`, and exact canonical equality
re-admits an already-labeled vertex through its recorded setter). **Early exit:** as soon
as `|W| > k·|S|`, returns `pivots = S` (copy) with the partial `W`. Otherwise the paper's
tight-edge forest is simply the canonical predecessor pointers: every vertex of `W \ S`
hangs off `preds[v]` (always itself in `W`), a DAG or tight cycle is impossible (one pred
per vertex; zero-weight edges strictly increase hops), parent chains always end in `S`,
and `S` members are roots by definition. Pivots = `S`-roots of trees with `≥ k` vertices;
`|pivots| ≤ |W|/k`. The two #44-era tie ambiguities are resolved by construction. Note: a
source with key ≥ `B` can still be returned as a pivot (early exit copies all of `S`,
and direct multi-source callers may pass such sources); `bmssp()` filters them at seeding.

## `src/tieBreak.mjs` — composite keys, Assumption 2.1 realized (#163)

```js
compareKeys(a, b)                  // lexicographic compare of [length, hops, id] triples
toBound(B)                         // scalar B → [B, -Infinity, -Infinity] (infimum of length-B
                                   // keys, so key < toBound(B) ⇔ the strict scalar contract);
                                   // composite bounds pass through
makeTies(hops?, preds?)            // bundle the canonical label maps (fresh by default)
orderKey(v, dHat, ties)            // frontier key [d̂[v], hops[v] ?? 0, v]
relaxEdge(u, v, w, dHat, ties, bound?) // canonical relaxation → { key, improved } | null:
                                   // improved=true updated d̂/hops/preds together;
                                   // improved=false = candidate exactly matches v's stored
                                   // label (u is the recorded setter) — the re-enqueue signal
export { compareKeys, toBound, makeTies, orderKey, relaxEdge, NO_PRED };
                                   // NOT re-exported from index.mjs — internal to the algorithm
```

The paper's Assumption 2.1 ("all path lengths distinct") in code: paths ranked by
`[length, hops, id]` — `hops` (the paper's "#vertices") makes zero-weight extensions
strictly increasing, `id` (pred id inside relaxation, own id for frontier order) stands in
for the paper's full vertex-sequence comparison at O(1). Sources (no stored pred) hold a
`-Infinity` pred sentinel and never lose an equal-`(length, hops)` tie; unlabeled vertices
read as hop-0 / distance-∞, so externally seeded multi-source calls need no extra setup.

## `src/dijkstra.mjs` — the oracle (already done)

`dijkstra(graph, nodeIDs, source) → Map<nodeId, distance>`. Standard array binary min-heap
with lazy stale-entry skipping (no `DecreaseKey`). Builds its own adjacency list from the edge
array (independent of the class's `this.adjacency`). This is the **ground truth** the BMSSP
implementation is tested against — and, since #43, no longer part of the BMSSP code path.

## Tests — the contract

- `test/main.test.mjs` (12): constructor/nodeIDs/adjacency/shortestPaths contracts, plus the
  **key one** — "BMSSP vs Dijkstra" on a **seeded 10k-node sparse graph** (`sparseRandom(10_000,
  3, 1601)`, already `topLevel` 3): for a fixed source, `myBMSSP.shortestPaths` must equal
  `dijkstra(...)` for every node. (Until 2026-07-17 this ran on `roadNet-CA.txt`, an 87 MB
  SNAP road network with unseeded random weights — removed in PR #185 and purged from git
  history: irreproducible failures, ~71 s of every run, coverage superseded by the seeded
  fuzz + scale suite.)
- `test/bmssp.test.mjs` (15, NEW in #43): parameter derivation (clamps, paper formulas,
  `k·2^(topLevel·t) ≥ n` guard), end-to-end hand-built graphs (README example, multi-hop vs
  direct, unreachable ⇒ Infinity, self-loop, source switch), degenerate ties (zero-weight
  cycles/clusters, layered equal-length paths, seeded 0–2-weight stress), the Lemma 3.1
  recursion contract (bounded call: complete-below-boundary, exact membership, d̂ never
  underestimates; unbounded call: successful execution returning exactly the reachable set),
  and seeded full-map-vs-oracle stress across sizes (up to n = 2000).
- `test/blockList.test.mjs` (18), `test/heap.test.mjs` (16), `test/baseCase.test.mjs` (13),
  `test/findPivots.test.mjs` (12): per-module contracts incl. seeded stress — see the
  module sections above. (Since #163 the baseCase partial-run tests assert the composite
  contract: strictly below `boundKey`, `≤` the scalar bound.)
- `test/tieBreak.test.mjs` (16, #163): unit tests for `compareKeys`/`toBound`/`relaxEdge`
  (lexicographic order, scalar-bound infimum, canonical pred choice, zero-weight-cycle
  quiescence, the equality re-enqueue signal), then the system-level properties:
  **edge-order determinism** (full runs AND bounded partial calls return identical
  d̂/hops/preds/`boundKey`/`U` across seeded permutations of tie-heavy 0–2-weight graphs),
  **strict Lemma 3.1** (returned vertices strictly below `boundKey`; strict completeness),
  the old zero-weight-cluster stall scenario under a tied bound, and canonical-label
  equality against an independent O(n²) lexicographic-(length, hops) Dijkstra oracle
  (hops = minimal edge count among shortest paths; preds = smallest optimal parent, chain
  reaching the source acyclically).
- `test/pathReconstruction.test.mjs` (3, #169): the public `reconstructPath(target)` API
  checked against an independent Dijkstra path oracle, including competing paths, an
  unreachable vertex, calls before a run, source switching on one instance, and rejection
  of a target that is not in the graph.
- `test/edgeCases.test.mjs` (9, #162): deterministic hand-built disconnection fixtures,
  each checked against a hand-computed full distance map **and** the Dijkstra oracle
  (Infinity entries included): self-loop-only source, sink source (adjacency keeps an
  empty list), empty graph rejects any start, five single-node components, ten 3-node
  chain components, a bridge edge pointing into the source's component, a 2-node island
  beside a 100-node chain (source on each side), and A→B→A source switching on one
  instance to prove state resets. Complements the randomized disconnected-forest rounds
  in `fuzz.test.mjs`.
- `test/fuzz.test.mjs` (18, #161 + scale runs added 2026-07-17): the high-volume
  property/fuzz suite. Full-map oracle equality across 8 shapes (the 5 benchmark generators
  reused, plus local random-DAG, disconnected-forest and uniform-multigraph generators; 2
  sources per graph; a thousands-of-nodes round), 4 extreme weight regimes (all-zero,
  zero-or-huge, tiny-int 0–2, dyadic floats — multiples of 1/256 so every path sum is exact
  in float64 and oracle equality stays bit-exact), direct multi-source `bmssp(topLevel, B, S)`
  fuzzing: random source sets (1–4) with initial distances, ground truth = per-source Dijkstra
  oracles (`trueDist(v) = min_s(d0[s] + dist_s(v))`), checking the Lemma 3.1 contract for
  bounded (incl. boundary-tie `B` choices) and unbounded calls — plus **seeded scale runs**:
  sparse n = 150k (asserted `topLevel` 3) and grid 300×300 in the default suite, and an
  **opt-in `FUZZ_XL=1` sparse n = 2M round** (~33 s, `test.skip` otherwise). Every failure
  message carries the round's seed for reproduction. **`FUZZ_ROUNDS=<x>`** multiplies all
  round counts (default 1 ≈ 0.5 s; 25 ≈ 10 s, several thousand graphs).
- Current suite: **132 tests — 131 passing + 1 XL skipped by default**, 100% statement
  coverage, ~3 s wall-clock. No graph data files: every generated test graph comes from a
  seed; the #162 fixtures are hand-built and fully deterministic.

## Benchmarks (`benchmarks/`, `npm run bench`)

Deterministic (seeded) micro-benchmarks. `adjacency.bench.mjs` shows the #45 map is
~thousands× faster per-node than a linear scan. `scenarios.bench.mjs` times construction +
a Dijkstra run across five graph shapes. **`HEAD-TO-HEAD.md` records the measured
BMSSP-vs-Dijkstra comparison** (2026-07-16): wall-clock tables by shape and size, the
sparse scaling trend, and the comparison-count crossover (~n = 1M). #170 tracks folding
both measurements into the harness itself (algorithm-only `bmssp` column + optional
comparison-count mode); the raw baseline is also on #170 as a comment.

## Gaps to fill (the actual work)

| Missing piece | Lives where | Issue | Status |
|---|---|---|---|
| Per-node edge adjacency map | `BMSSP` constructor | #45 | ✅ done (PR #160) |
| Lemma 3.3 block-list `D` | `src/blockList.mjs` | #42 | ✅ done (PR #175) |
| Binary min-heap module | `src/heap.mjs` | #41 | ✅ done (PR #177) |
| Base case (bounded Dijkstra) | `src/baseCase.mjs` | #40 | ✅ done (PR #178) |
| FindPivots | `src/findPivots.mjs` | #44 | ✅ done (PR #180) |
| Main `BMSSP(l, B, S)` recursion + `k,t` derivation | `src/bmssp.mjs` | #43 | ✅ done (PR #181) — **1.0.0 milestone complete** |
| Property/fuzz suite vs. the oracle | `test/fuzz.test.mjs` | #161 | ✅ done (PR #184, 1.0.1) |
| Deterministic disconnection edge cases | `test/edgeCases.test.mjs` | #162 | ✅ done (PR #187, no bump) |
| Deterministic tie-breaking (Assumption 2.1) | `src/tieBreak.mjs` + all modules | #163 | ✅ done (PR #188, no bump) |
| Public shortest-path reconstruction | `BMSSP.reconstructPath()` + `test/pathReconstruction.test.mjs` | #169 | ✅ done-pending-merge (this PR, no bump) |

Milestone `1.1.0` (correctness hardening) remains in progress with #165, #164 and #166
open. Milestone `1.2.0` is also in progress: #169 lands with this PR; see
[06-milestones-roadmap.md](06-milestones-roadmap.md).
