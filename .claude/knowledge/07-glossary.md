# 07 — Glossary

<!-- Updated on: 2026-07-21 (#205 PR: dense-index engine — makeLabels, labelKey, CSR,
     dense index, buildIndex, syncLabelsIn/Out, boundToEngine/keyToPublic, bmsspIndex;
     NO_PRED now -1; relaxEdge/baseCase/findPivots entries updated to the typed-array
     signature. Previous update the same day: #168 PR added compareKeyParts + RELAX_*) -->

> **Lifecycle: dynamic — updated in Phase C of every PR.** When a PR introduces new symbols
> or terms (module names, data-structure fields, paper notation newly used in code), add
> them here as part of the automatic pre-PR sync (see `../CLAUDE.md`, Phase C), inside the
> same PR. Also refreshed by the on-demand `RKB` command. Not touched during session start.

Quick lookup for the symbols and terms used across the paper, the notes, and the code.

## Symbols

| Symbol | Meaning |
|---|---|
| `n`, `m` | number of vertices / edges. Sparse graphs: `m = O(n)`. |
| `s` | the source vertex. |
| `d(v)` | **true** shortest distance from `s` to `v`. |
| `d̂[v]` | current distance **estimate** (`≥ d(v)`, starts ∞, only decreases). In code: `shortestPaths` map. |
| `w(u,v)`, `w_uv` | weight of edge `(u,v)`; non-negative. |
| `Pred[v]` | predecessor of `v` on the current best path (forms a tree). In code: the canonical `preds` map (#163), deterministic smallest optimal parent. |
| `B` | upper distance **bound** for a (sub)problem; only vertices with `d < B` are in scope. |
| `B'` | the **returned** boundary of a call, `B' ≤ B`. Says how much real progress was made. |
| `S` | the **frontier** / source set of a (sub)problem. `|S| ≤ 2^(l·t)`. |
| `U` | the set of completed vertices a call returns (all with `d < B'`, reachable via `S`). |
| `U'` | (analysis) all `v` with `d(v) < B` whose shortest path visits `S`. Success ⇒ `U = U'`. |
| `P` | **pivots**: the ⊆ `S` roots of big shortest-path trees; `|P| ≤ |W|/k`. From FindPivots. |
| `W` | vertices completed/collected by FindPivots' `k` Bellman-Ford rounds; `|W| = O(k·|S|)`. |
| `F` | forest of "tight" edges (`d̂[v] == d̂[u]+w(u,v)`) inside `W`; used to find pivot roots. In code since #163: the canonical `preds` pointers restricted to `W`. |
| `D` | the Lemma 3.3 **block-based list** (Insert / BatchPrepend / Pull). §03-B. |
| `k` | `⌊log^(1/3) n⌋`. Bellman-Ford step count in FindPivots; base-case batch cap (`k+1`). |
| `t` | `⌊log^(2/3) n⌋`. Governs branching/level sizing. |
| `l` | recursion **level**, `0 … ⌈(log n)/t⌉`. `l = 0` is the base case. |
| `M` | block-list block/pull size at level `l`: `M = 2^((l-1)·t)`. |
| `Si`, `Bi` | the `i`-th `Pull`'s batch of keys and its separating bound. |
| `Bi'`, `Ui` | boundary and completed-set returned by the `i`-th recursive `BMSSP(l-1,…)`. |
| `K` | staging set for BatchPrepend: newly-relaxed neighbors landing in `[Bi', Bi)`. |

## Terms

- **Complete / incomplete vertex** — `v` is *complete* when `d̂[v] == d(v)` (estimate is
  final); otherwise *incomplete*. Completeness is relative to algorithm progress.
- **Frontier** — the set `S` such that every in-scope incomplete vertex's shortest path
  passes through a complete member of it. Dijkstra's is the priority queue; BMSSP keeps it
  small via FindPivots.
- **Pivot** — a frontier vertex that is the root of a shortest-path tree with `≥ k` vertices;
  the only frontier vertices worth recursing on.
- **Relaxation** — `if d̂[u]+w(u,v) ≤ d̂[v]: d̂[v] ← d̂[u]+w(u,v)`. Note `≤` (Remark 3.4) so a
  lower-level relaxation can be reused higher up.
- **Sorting barrier** — the Ω(n log n) cost of producing a fully sorted order; Dijkstra pays
  it, BMSSP sidesteps it by not sorting the frontier.
- **Comparison-addition model** — cost model where only `+` and `<` on real weights are
  allowed, each O(1). The paper's setting.
- **Successful vs partial execution** — a `BMSSP` call is *successful* if `D` empties
  (`B' = B`, returns all of `U'`); *partial* if the workload cap `|U| < k·2^(l·t)` trips
  (`B' < B`, returns only vertices below `B'`).
- **Constant-degree transform** — reduces any graph to in/out-degree ≤ 2 by splitting each
  vertex into a zero-weight cycle. Needed for the paper's bounds; optional in practice.
  Implemented in `src/constantDegree.mjs` (#164) — see "`constantDegreeTransform`" below.
- **Port copy** (#164) — one copy of a vertex created per incident edge endpoint by the
  constant-degree transform. Each port copy hosts exactly one original edge endpoint, so
  threading the copies onto a zero-weight cycle caps in/out-degree at 2.
- **Zero-weight cycle** (#164) — the directed cycle of a vertex's port copies added by the
  transform; costs nothing to traverse, so all copies of a vertex share one distance, making
  the transform distance-preserving.
- **BaseCase / FindPivots / BMSSP** — Algorithm 2 / Algorithm 1 / Algorithm 3. See §02.
- **BlockList (`D`)** — Lemma 3.3 semi-sorted structure. See §03-B.
- **Oracle** — the reference `dijkstra()` in `src/dijkstra.mjs`; ground truth for tests.
- **Path oracle** (#169) — the independent Dijkstra implementation local to
  `test/pathReconstruction.test.mjs`; it tracks complete node sequences and compares them
  with `BMSSP.reconstructPath()`, without reading the production `preds` map.

## Code / repo terms

- **Constructor input contract (#165)** — `new BMSSP(inputGraph)` requires an array of exact
  `[from, to, weight]` arrays. Both node IDs and the weight must be finite numbers, and the
  weight must be non-negative; failures identify the offending edge index. `[]` remains a
  valid empty graph, whose `calculateShortestPaths()` call rejects every start node.
- **`constantDegreeTransform(graph)`** (#164) — `src/constantDegree.mjs`, the opt-in
  constant-degree transform. Validates `graph` exactly like the BMSSP constructor, then
  returns `{ edges, copiesOf, originalOf, sourceCopy, collapse }`: `edges` is the rewritten
  in/out-degree-≤-2 graph (fresh integer copy IDs from 0, ~2m copies / ~3m edges, O(m));
  `copiesOf` maps an original ID to its port copies and `originalOf` is the inverse;
  `sourceCopy(orig)` returns a canonical start copy (any works — the zero-weight cycle
  equalizes them); `collapse(distances)` folds a transformed distance map back onto original
  IDs (min over a vertex's copies). **Public** — re-exported from `index.mjs` (unlike the
  algorithm-internal modules). Correctness-independent: BMSSP never calls it. Usage:
  `const t = constantDegreeTransform(g); …run from t.sourceCopy(s)…; t.collapse(dist)`.
- **`adjacency`** (#45) — `Map<nodeId, Array<[to, weight]>>` field on the `BMSSP` class:
  a node's outgoing edges. Since #205 this is the **public edge view** behind `getEdges`
  (and the fair-baseline Dijkstra in the benchmarks); the algorithm's hot path uses the
  CSR arrays instead. Every known node has an entry (empty array for sinks). Built in the
  constructor.
- **`buildAdjacency()`** (#45) — class method that (re)builds `this.adjacency` from
  `this.graph`. Called by the constructor.
- **`getEdges(nodeId)`** (#45) — class method returning a node's outgoing edges as
  `[to, weight]` pairs; returns `[]` for unknown nodes.
- **Dense index** (#205) — the `BMSSP` class maps every original node id to a contiguous
  integer `0..n-1`, assigned in **ascending numeric id order** (`buildIndex`). `this.ids`
  (`Float64Array`) is index → id, `this.indexOf` (`Map`) is the inverse. Index order
  equals id order, so the composite-key tie-break makes the same canonical choice it did
  on ids — the refactor is label-preserving. The algorithm modules run entirely on indices.
- **CSR** (#205) — Compressed-Sparse-Row graph layout, `this.csr = { offsets:Uint32Array,
  targets:Uint32Array, weights:Float64Array }`. Node `u`'s outgoing edges are
  `targets/weights[offsets[u] .. offsets[u+1])`. Replaces per-edge `adjacency.get` +
  iterator/destructuring in the hot loops.
- **`buildIndex()`** (#205) — constructor step building the dense index (`ids`/`indexOf`),
  the CSR arrays (`this.csr`), and the typed label state (`this.labels`).
- **Adjacency list (oracle)** — the *local* adjacency `Map` that `src/dijkstra.mjs` builds
  internally per call; distinct from the class's persistent `this.adjacency`.
- **`BlockList`** (#42) — `src/blockList.mjs`, the Lemma 3.3 structure `D`. API:
  `insert(key, value)` / `batchPrepend(pairs)` / `pull() → { keys, bound }`, plus
  `size` / `isEmpty()`. `pull()`'s `{ keys, bound }` is Algorithm 3's `Si, Bi`. Values must
  be `< B`; duplicate keys keep the smallest value everywhere. Internal to the algorithm
  (not re-exported from `index.mjs`).
- **`d0` / `d1`** (#42) — the `BlockList`'s two block sequences: `d1` receives `insert`s
  (each block carries an upper `bound`, non-decreasing across blocks; the last block's bound
  is `B`), `d0` receives `batchPrepend` blocks and conceptually sits in front of `d1`.
- **`locator`** (#42) — the `BlockList`'s `Map<key, block>` giving O(1) duplicate handling
  (find/replace an existing key without scanning blocks).
- **Bound index shortcut (historical, resolved by #167)** — until #167, `d1`'s block
  bounds were binary-searched in a plain array (O(#blocks) `splice` maintenance) and
  splits/chunking used a sort (O(M log M)) instead of linear-time selection. Both
  shortcuts are gone: see `BoundIndex` and `partitionByRank` below.
- **`BoundIndex`** (#167) — `src/boundIndex.mjs`, the paper's "balanced BST over block
  upper bounds": a POSITIONAL AVL tree holding `d1`'s block sequence (a node's in-order
  position is its sequence position; the tree itself never compares items). API:
  `append` / `insertBefore(node, item)` / `remove(node)` / `first` / `last` /
  `next(node)` / `findFirst(predicate)` / `size` / `clear`, all O(log size); nodes are
  handles (`{ item, parent, left, right, height }`), stored by BlockList in
  `block.node`. `findFirst` requires a predicate monotone along the sequence — with
  monotone bounds, `bound >= value` binary-searches in O(log #blocks). Internal (not
  re-exported from `index.mjs`).
- **`partitionByRank(items, rank, compare?, cheapBudget?)`** (#167) — `src/select.mjs`,
  deterministic worst-case-linear selection: reorders `items` in place so
  `items[0..rank]` are the rank+1 smallest and `items[rank]` the rank-th smallest.
  Used by BlockList for block splits, batchPrepend chunking and pulls. Internal (not
  re-exported from `index.mjs`).
- **Introselect (budgeted)** (#167) — `partitionByRank`'s strategy: median-of-3
  quickselect (deterministic, ~2–3n comparisons — below a sort's n log n) with a work
  budget (`cheapBudget`, default 6·|items|); exhausting it switches pivots to
  median-of-medians (groups of 5, guaranteed middle-40% split), keeping the worst case
  linear. Pure median-of-medians costs ~10–20n comparisons — measured worse than the
  sorts it replaced — hence the hybrid. `cheapBudget: 0` forces the fallback (tests).
- **`MinHeap`** (#41) — `src/heap.mjs`, the *indexed* binary min-heap for BaseCase (Alg 2):
  `insert` / `extractMin()` / `peekMin() → { key, value }` / `decreaseKey` / `has` /
  `getValue` / `size` / `isEmpty()`. `has` is Algorithm 2's "is `v` in `H`?" branch;
  `decreaseKey` ignores non-decreasing values (smallest wins, mirroring `≤` relaxation);
  an extracted key may be re-inserted. Internal (not re-exported from `index.mjs`).
- **`position` map** (#41) — the `MinHeap`'s `Map<key, arrayIndex>` kept in sync on every
  swap; what makes `has`/`getValue` O(1) and `decreaseKey` O(log n).
- **Indexed vs. lazy heap** — `MinHeap` is the paper-literal *indexed* variant (true
  `DecreaseKey`); `src/dijkstra.mjs` internally uses the *lazy* variant (push duplicates,
  skip stale pops). Both are correct; §03-A discusses the trade-off. **Resolved by
  measurement in #168:** lazy wins an isolated BaseCase micro-benchmark, but BaseCase
  heaps are capped at k+1 ≈ 4 entries and never register in end-to-end profiles, so the
  indexed paper-literal `MinHeap` is kept.
- **`baseCase(B, S, labels, csr, k)`** (#40; dense engine #205) — `src/baseCase.mjs`,
  Algorithm 2: bounded mini-Dijkstra from the singleton complete source **index** in `S`,
  settling at most `k+1` vertices, relaxing the shared typed-array `labels` (d̂/hops/preds)
  **in place** over the `csr` graph. Returns `{ bound, boundKey, vertices }` (= the paper's
  `B'`, its composite key, `U` as index set). Internal (not re-exported from `index.mjs`).
- **Settled filter** (#40, re-scoped by #163) — `baseCase` never re-inserts a vertex it
  already settled in the same call. Pre-#163 this guarded against equal-sum ping-pong
  loops; since #163 strict canonical relaxation makes improvements on settled vertices
  impossible, and the filter only skips exact-equality re-enqueue signals (see
  "Re-enqueue signal"), keeping zero-weight plateaus quiescent.
- **`findPivots(B, S, labels, csr, k)`** (#44; dense engine #205) — `src/findPivots.mjs`,
  Algorithm 1: `k` strictly-layered rounds of canonical Bellman-Ford out of the complete
  frontier `S` (indices), relaxing the shared typed-array `labels` **in place** over the
  `csr` graph; `< B` (composite) gates membership in `W` only (the d̂ write is
  unconditional). Returns `{ pivots, W }` (= the paper's `P, W`, index sets), with
  `|pivots| ≤ |W|/k`; the forest is the canonical `labels.preds` pointers. Internal
  (not re-exported from `index.mjs`).
- **Early exit** (#44) — `findPivots`' first branch: as soon as `|W| > k·|S|` after a round,
  return `pivots = S` — the frontier is already small relative to `W`.
- **One-parent rule** (#44, superseded by #163) — pre-#163, each vertex accepted the first
  tight edge in W-iteration order as its parent to keep tree sizes well-defined when ties
  made `F` a DAG. Since #163 the forest **is** the canonical `preds` pointers: exactly one
  deterministic parent per vertex of `W \ S`, no DAG possible, and tight cycles cannot
  exist (zero-weight edges strictly increase hops). `S` members are roots by definition.
- **`bmssp(l, B, S)`** (#43; public wrapper since #205) — method on the `BMSSP` class:
  the PUBLIC Algorithm 3 entry in **id space**. Snapshots seeded distances from
  `this.shortestPaths` into the engine (`syncLabelsIn`), translates `S`/bound to indices
  (`boundToEngine`), runs `bmsspIndex`, then mirrors labels back (`syncLabelsOut`) and
  translates the result to ids (`keyToPublic`). Returns `{ bound, boundKey, vertices }`
  (= the paper's `B'`, its composite key, `U`); scalar `B` in → scalar `bound` out.
- **`bmsspIndex(l, boundKey, S)`** (#43; dense engine #205) — the actual Algorithm 3
  recursion, **entirely in dense-index space**: `S`/`U` are index sets, keys are
  `[len, hops, index]`, the graph is `this.csr`, labels are `this.labels`. Level 0
  delegates to `baseCase`; level ≥ 1 wires `findPivots` → `BlockList` → recursive
  `bmsspIndex(l-1, Bi, Si)` with band-routed relaxation. `calculateShortestPaths(start)`
  sets `labels.dist[startIdx] = 0` and calls `bmsspIndex(topLevel, toBound(∞), {startIdx})`
  directly (skipping the id-translation wrapper), then `syncLabelsOut`.
- **`syncLabelsIn()` / `syncLabelsOut()`** (#205) — the public↔engine label bridge.
  `syncLabelsIn` fills the typed arrays from `this.shortestPaths` (seeded distances only —
  sources are hop-0 roots) before a public `bmssp()` call; `syncLabelsOut` mirrors the
  arrays back into `shortestPaths`/`hops`/`preds` (keyed by id) after a run, skipping
  unreached (∞) vertices and the `NO_PRED` sentinel.
- **`boundToEngine(B)` / `keyToPublic(key)`** (#205) — id↔index translation for the public
  boundary: a scalar bound → `toBound`, a composite bound's id → its index; a returned
  key's index → its id (sentinel / out-of-range components pass through).
- **`deriveParameters()`** (#43) — class method (called by the constructor) that derives and
  stores `this.k`, `this.t`, `this.topLevel` from `n = nodeIDs.size`, each clamped to ≥ 1:
  `k = ⌊(log₂n)^(1/3)⌋`, `t = ⌊(log₂n)^(2/3)⌋`, `topLevel = ⌈log₂n / t⌉`. The clamp keeps
  tiny graphs out of degenerate regimes; `k·2^(topLevel·t) ≥ n` makes the top call a
  successful execution.
- **Workload guard / cap** (#43) — Algorithm 3's `|U| < k·2^(l·t)` loop condition: trips on
  partial executions (`bound < B`); can never trip below `n` at the top level.
- **Pre-#163 tie guards (historical)** — four deviations from the paper's literal text
  that handled Assumption 2.1 violations before #163 removed them by construction:
  the *completed-vertex guard* (no equal-sum re-queue of `U` members), the *out-of-scope
  pivot gate* (pivots tied with `B` skipped at seeding), the *stall escape hatch*
  (uncapped `baseCase` runs when a child returned zero vertices), and the *boundary-tied
  re-queue / return* (`d̂ == Bi` batch members re-inserted; partial executions returning
  `d(v) == B'`, fuzz-found at seed 163066). All are impossible under composite keys; the
  scalar-projection caveat `d(v) ≤ bound` for returned vertices remains the documented
  external contract (`boundKey` carries the strict form).
- **Composite key** (#163) — `[length, hops, id]` compared lexicographically
  (`src/tieBreak.mjs`): `length` = path length, `hops` = edge count (the paper's
  "#vertices" tie-break — zero-weight extensions strictly increase it), `id` = pred id in
  relaxation / own id in frontier order (O(1) stand-in for the paper's vertex-sequence
  comparison). Since #205 the engine's third component is a dense **index** rather than a
  raw id; index order equals id order, so the canonical choice is unchanged. Realizes
  Assumption 2.1: all frontier comparisons strict.
- **`makeLabels(n)` / `labelKey(v, labels)`** (#205) — `src/tieBreak.mjs`: the engine label
  state and its frontier key. `makeLabels` returns `{ dist:Float64Array(∞),
  hops:Uint32Array(0), preds:Int32Array(NO_PRED) }`; `labelKey(v, labels)` builds
  `[dist[v], hops[v], v]`. These replace the Map-based `dHat`/`ties`/`orderKey` in the
  algorithm's hot path (the Maps remain at the public boundary).
- **`NO_PRED`** (#163; `-1` since #205) — the source predecessor sentinel: compares below
  every real vertex, so a source never loses an equal-`(length, hops)` tie. Was `-Infinity`
  when preds lived in a Map (ids could be negative); since #205 preds live in an
  `Int32Array` over dense indices (`≥ 0`), so `-1` both fits the array and stays below all.
- **Canonical label / relaxation** (#163; allocation-free #168; typed arrays #205) —
  `relaxEdge(u, v, w, labels, bound?)` updates `labels.dist`/`hops`/`preds` together iff the
  candidate path key beats the stored one; the fixed point is the lexicographic minimum
  over all paths, so labels, predecessor pointers and completed sets are invariant under
  edge/iteration order (tested in `test/tieBreak.test.mjs` against an O(n²)
  lexicographic Dijkstra oracle). Since #168 it returns one of three integer codes —
  `RELAX_IMPROVED` / `RELAX_EQUAL` / `RELAX_LOST` — and allocates nothing; a caller
  that enqueues `v` materializes its key with `labelKey` on that path only. Since #205 `u`
  and `v` are dense indices and the labels are typed arrays.
- **`compareKeyParts(length, hops, id, key)`** (#168) — `src/tieBreak.mjs`: compareKeys
  with the left key unpacked into its components, so the hot relax/routing loops can
  test a stored label against a band bound without building a throwaway array. Same
  lexicographic order, counts as one comparison (agreement with `compareKeys` swept in
  `test/tieBreak.test.mjs`).
- **`RELAX_LOST` / `RELAX_EQUAL` / `RELAX_IMPROVED`** (#168) — `relaxEdge`'s result
  codes (−1 / 0 / 1): candidate lost or bound-gated (labels untouched) / candidate
  exactly matches v's canonical label (the re-enqueue signal) / labels updated.
  Compare against the constants, not truthiness — `RELAX_EQUAL` is 0.
- **Re-enqueue signal** (#163; `RELAX_EQUAL` since #168) — the candidate exactly
  matches `v`'s stored label, meaning `u` is the recorded label-setter and `v` was
  labeled by a deeper call without being completed. The caller re-enqueues `v` unless it
  is already settled/completed — the paper's `≤` relaxation made canonical, firing from
  exactly one predecessor.
- **`ties`** (#163; public boundary since #205) — the `{ hops, preds }` bundle
  (`makeTies`) that the `BMSSP` class owns as `this.ties` (`this.hops`, `this.preds`),
  cleared by `initializeShortestPaths()`. Since #205 these Maps are the **public mirror**
  of the engine's typed `labels` (refreshed by `syncLabelsOut`), used by `reconstructPath`
  and external inspection — the algorithm no longer threads them through relaxation.
- **`reconstructPath(target)`** (#169) — public `BMSSP` method that walks the canonical
  `preds` chain (the public mirror Map, #205) from `target` to the latest calculation's
  source, then reverses it into a source-to-target node sequence. Returns `[]` before a
  calculation or for an unreachable target; throws when `target` is not a known graph node.
- **`boundKey`** (#163) — the composite boundary in `baseCase`/`bmssp` results: every
  returned vertex's order key is strictly below it. The scalar `bound` is its projection
  (a returned vertex may tie `bound`'s length, never exceed it).
- **Fuzz suite** (#161) — `test/fuzz.test.mjs`: high-volume seeded property tests. Full-map
  oracle equality across 8 graph shapes and 4 extreme weight regimes, plus direct
  multi-source bounded `bmssp(topLevel, B, S)` checks against per-source Dijkstra oracles
  (`trueDist(v) = min_s(d0[s] + dist_s(v))`). Failure messages carry the round's seed.
- **Edge-case suite** (#162) — `test/edgeCases.test.mjs`: deterministic hand-built
  disconnection fixtures with hand-verifiable expected maps — isolated/sink/self-loop-only
  sources, single-node and many-chain components, wrong-direction bridge edges, tiny
  component beside a giant chain, and source switching across components on one instance.
  Complements the randomized disconnected-forest coverage in the fuzz suite (#161).
- **`FUZZ_ROUNDS`** (#161) — environment variable multiplying every fuzz round count
  (default 1). `FUZZ_ROUNDS=25 npm test -- test/fuzz.test.mjs` runs several thousand
  graphs in ~5 s.
- **`FUZZ_XL`** — environment variable opting into the seeded 2M-node sparse scale round
  in `test/fuzz.test.mjs` (~30 s; `test.skip` otherwise). With the default-suite scale
  runs (sparse 150k, grid 300×300) it replaced `roadNet-CA.txt` — the 87 MB SNAP road
  network removed 2026-07-17 (unseeded weights, ~71 s per run). Note: `topLevel` is 3
  from n = 10k to 2M, so scale rounds buy volume and memory pressure, not depth.
- **Dyadic-float regime** (#161) — fuzz weight regime using multiples of `1/256` (dyadic
  rationals) of bounded magnitude: every path sum is exact in float64, so float-weight
  testing keeps bit-exact oracle equality instead of needing tolerances.
- **Benchmark harness** — `benchmarks/` (run via `npm run bench`, or `npm run
  bench:counts` for the count tables): seeded graph **generators** + a `SCENARIOS`
  registry (sparse-random / dense-random / grid / chain / star / sparse-random-l4),
  `timeMany` timing, and three benchmarks: adjacency-vs-scan, the per-shape
  BMSSP-vs-Dijkstra head-to-head (#170), and the opt-in comparison-count mode (#170).
- **Scenario** — a named, seeded graph shape in the benchmark registry used to probe where
  BMSSP's asymptotics would help vs. where Dijkstra dominates. See `benchmarks/README.md`.
- **`sparse-random-l4`** (#170) — the level-transition scenario: sparse degree-3 at
  n = 300k, inside the `topLevel` 3→4 window `n ∈ (2^18, ~376k]` (where `t` is still 6;
  at ~376k `t` reaches 7 and `topLevel` drops back to 3). A standing regression sentinel
  for #182's transition cliff.
- **Head-to-head** — the measured BMSSP-vs-Dijkstra comparison. **Algorithm-only
  timing**: construction and adjacency building are excluded for both sides; the Dijkstra
  baseline consumes the BMSSP instance's own prebuilt `adjacency` Map (the exported
  `dijkstra()` builds its own per call — that's loading, not algorithm). Since #170 the
  harness runs it per shape with node-by-node output verification (`mismatches` column);
  `benchmarks/HEAD-TO-HEAD.md` is the frozen 1.0.0 record (2026-07-16, up to n = 4M),
  `benchmarks/RESULTS.md` the latest capture.
- **`dijkstraAdjacency(adjacency, nodeIDs, source)`** (#170) — `benchmarks/dijkstra-adj.mjs`,
  the fair baseline: the oracle's lazy-heap Dijkstra reworked to consume a prebuilt
  `Map<from, [to, weight][]>`, with distance-comparison counters
  (`resetDijkstraComparisonCount` / `getDijkstraComparisonCount`). Bench-only — not part
  of the package API.
- **Comparison counter (#170)** — `resetComparisonCount()` / `getComparisonCount()` in
  `src/tieBreak.mjs`: an unconditional per-call counter in `compareKeys`. Because the heap
  and BlockList receive `compareKeys` as their comparator and the algorithm modules call
  it directly, this one counter measures every BMSSP path-length comparison. Internal
  (not re-exported from `index.mjs`).
- **Comparison-count crossover** — head-to-head result in the paper's comparison-addition
  model: counting every comparison between two distance values (heap sifts, BlockList
  searches/selections, relaxations), BMSSP does **fewer** comparisons than Dijkstra on
  sparse graphs — since #167, from **before n = 50k** (0.97× at 50k → 0.77× at 200k →
  0.66× at 1M; grid 700×700 at 1.12×), where the sort-based 1.0.0/1.1.1 records crossed
  only at ~n = 1M (0.91× at 2M). Dijkstra still wins wall-clock — the sorting barrier is
  measurably broken, with constant factors as the remaining gap. Since #170,
  `npm run bench:counts` reproduces it exactly (`compare-counts.bench.mjs` `COUNT_CASES`).
- **Performance cliffs (#182, resolved 2026-07-21)** — two measured regimes where the
  head-to-head ratio broke from its ~1.6–2× pattern; profiled and dispatched in the #182
  investigation (full write-up: `benchmarks/HEAD-TO-HEAD.md` addendum). (1) **Star
  blowup**: quadratic per-chunk `d0.unshift` in `BlockList.batchPrepend` (M = 1 at level
  1 → ~n single-entry chunks) — **fixed in 1.1.1** with a single-concat prepend; star
  500k went 61 s → ~3.1 s (67.8× → ~5.5×) and the ratio now falls with n. (2)
  **`topLevel = ⌈log₂n / t⌉` 3→4 transition**: an inherent **~+24% step** (one extra
  full relax pass + Set churn per level), measured at the exact n = 2^18 → 2^18 + 1
  straddle; the 1.0.0 record's 5× at n = 4M is that step plus GC/memory amplification —
  known behavior, constant-factor work tracked in #168. Both shapes stay as regression
  sentinels in every `npm run bench` (`star`, `sparse-random-l4`).
- **Docs page (#166)** — `docs/index.html`, the GitHub-Pages-published public-API reference
  (deployed by `static.yml` on `docs/**` changes). Documents exactly the three `index.mjs`
  exports — `BMSSP` (constructor contract, `calculateShortestPaths`, `reconstructPath`),
  `dijkstra`, `constantDegreeTransform` — and explicitly keeps algorithm internals out.
  Static, dependency-free HTML.
