# 07 — Glossary

<!-- Updated on: 2026-07-21 (#166 PR: no new symbols — the PR adds JSDoc to index.mjs and
     rewrites docs/index.html; added the "Docs page" repo term. Terms last extended in the
     #164 PR: the constant-degree transform — port copies, zero-weight cycle,
     constantDegreeTransform and its sourceCopy/collapse/copiesOf/originalOf surface) -->

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
  a node's outgoing edges, so lookups are O(1) instead of scanning the whole edge array.
  Every known node has an entry (empty array for sinks). Built in the constructor.
- **`buildAdjacency()`** (#45) — class method that (re)builds `this.adjacency` from
  `this.graph`. Called by the constructor.
- **`getEdges(nodeId)`** (#45) — class method returning a node's outgoing edges as
  `[to, weight]` pairs; returns `[]` for unknown nodes.
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
- **Bound index shortcut** (#42) — `d1`'s block bounds are binary-searched in a plain array
  instead of the paper's balanced BST, and block **splits**/batch chunking use a sort
  (O(M log M)) instead of linear-time median selection — same correctness, worse constants.
  Both upgrades are tracked together in issue #167.
- **`MinHeap`** (#41) — `src/heap.mjs`, the *indexed* binary min-heap for BaseCase (Alg 2):
  `insert` / `extractMin()` / `peekMin() → { key, value }` / `decreaseKey` / `has` /
  `getValue` / `size` / `isEmpty()`. `has` is Algorithm 2's "is `v` in `H`?" branch;
  `decreaseKey` ignores non-decreasing values (smallest wins, mirroring `≤` relaxation);
  an extracted key may be re-inserted. Internal (not re-exported from `index.mjs`).
- **`position` map** (#41) — the `MinHeap`'s `Map<key, arrayIndex>` kept in sync on every
  swap; what makes `has`/`getValue` O(1) and `decreaseKey` O(log n).
- **Indexed vs. lazy heap** — `MinHeap` is the paper-literal *indexed* variant (true
  `DecreaseKey`); `src/dijkstra.mjs` internally uses the *lazy* variant (push duplicates,
  skip stale pops). Both are correct; §03-A discusses the trade-off.
- **`baseCase(B, S, dHat, adjacency, k)`** (#40) — `src/baseCase.mjs`, Algorithm 2:
  bounded mini-Dijkstra from the singleton complete source in `S`, settling at most `k+1`
  vertices, relaxing the shared `dHat` (`d̂[·]`) **in place** (canonically, with an optional
  `ties` bundle since #163). Returns `{ bound, boundKey, vertices }` (= the paper's `B'`,
  its composite key, `U`). Internal (not re-exported from `index.mjs`).
- **Settled filter** (#40, re-scoped by #163) — `baseCase` never re-inserts a vertex it
  already settled in the same call. Pre-#163 this guarded against equal-sum ping-pong
  loops; since #163 strict canonical relaxation makes improvements on settled vertices
  impossible, and the filter only skips exact-equality re-enqueue signals (see
  "Re-enqueue signal"), keeping zero-weight plateaus quiescent.
- **`findPivots(B, S, dHat, adjacency, k, ties?)`** (#44) — `src/findPivots.mjs`,
  Algorithm 1: `k` strictly-layered rounds of canonical Bellman-Ford out of the complete
  frontier `S`, relaxing the shared `dHat` (`d̂[·]`) **in place**; `< B` (composite) gates
  membership in `W` only (the d̂ write is unconditional). Returns `{ pivots, W }` (= the
  paper's `P, W`), with `|pivots| ≤ |W|/k`; the forest is the canonical `preds` pointers.
  Internal (not re-exported from `index.mjs`).
- **Early exit** (#44) — `findPivots`' first branch: as soon as `|W| > k·|S|` after a round,
  return `pivots = S` — the frontier is already small relative to `W`.
- **One-parent rule** (#44, superseded by #163) — pre-#163, each vertex accepted the first
  tight edge in W-iteration order as its parent to keep tree sizes well-defined when ties
  made `F` a DAG. Since #163 the forest **is** the canonical `preds` pointers: exactly one
  deterministic parent per vertex of `W \ S`, no DAG possible, and tight cycles cannot
  exist (zero-weight edges strictly increase hops). `S` members are roots by definition.
- **`bmssp(l, B, S)`** (#43) — method on the `BMSSP` class, Algorithm 3: the main bounded
  multi-source recursion. Level 0 delegates to `baseCase`; level ≥ 1 wires `findPivots` →
  `BlockList` → recursive `bmssp(l-1, Bi, Si)` calls with band-routed relaxation. Returns
  `{ bound, boundKey, vertices }` (= the paper's `B'`, its composite key, `U`); scalar `B`
  in → scalar `bound` out. `calculateShortestPaths(start)` runs
  `bmssp(topLevel, Infinity, {start})` after setting `d̂[start] = 0`, `hops[start] = 0`.
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
  comparison). Realizes Assumption 2.1: all frontier comparisons strict.
- **Canonical label / relaxation** (#163) — `relaxEdge(u, v, w, dHat, ties, bound?)`
  updates `d̂`/`hops`/`preds` together iff the candidate path key beats the stored one;
  the fixed point is the lexicographic minimum over all paths, so labels, predecessor
  pointers and completed sets are invariant under edge/iteration order (tested in
  `test/tieBreak.test.mjs` against an O(n²) lexicographic Dijkstra oracle).
- **Re-enqueue signal** (#163) — `relaxEdge`'s `improved: false` result: the candidate
  exactly matches `v`'s stored label, meaning `u` is the recorded label-setter and `v` was
  labeled by a deeper call without being completed. The caller re-enqueues `v` unless it
  is already settled/completed — the paper's `≤` relaxation made canonical, firing from
  exactly one predecessor.
- **`ties`** (#163) — the `{ hops, preds }` bundle (`makeTies`) that accompanies `dHat`
  through `baseCase`/`findPivots`/`relaxEdge`; the `BMSSP` class owns one as `this.ties`
  (`this.hops`, `this.preds`), cleared by `initializeShortestPaths()`. Missing entries
  read as hop-0 / no-pred, so externally seeded sources need no setup.
- **`reconstructPath(target)`** (#169) — public `BMSSP` method that walks the canonical
  `preds` chain from `target` to the latest calculation's source, then reverses it into a
  source-to-target node sequence. Returns `[]` before a calculation or for an unreachable
  target; throws when `target` is not a known graph node.
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
- **Benchmark harness** — `benchmarks/` (run via `npm run bench`): seeded graph
  **generators** + a `SCENARIOS` registry (sparse-random / dense-random / grid / chain /
  star), `timeMany` timing, and two benchmarks (adjacency-vs-scan, per-shape Dijkstra). Will
  host the BMSSP-vs-Dijkstra comparison once #43 lands.
- **Scenario** — a named, seeded graph shape in the benchmark registry used to probe where
  BMSSP's asymptotics would help vs. where Dijkstra dominates. See `benchmarks/README.md`.
- **Head-to-head** — the measured BMSSP-vs-Dijkstra comparison
  (`benchmarks/HEAD-TO-HEAD.md`, 2026-07-16). **Algorithm-only timing**: construction and
  adjacency building are excluded for both sides; the Dijkstra variant consumes the BMSSP
  instance's own prebuilt `adjacency` Map (the exported `dijkstra()` builds its own per
  call — that's loading, not algorithm). Harness integration tracked in #170.
- **Comparison-count crossover** — head-to-head result in the paper's comparison-addition
  model: counting every comparison between two distance values (heap sifts, BlockList
  searches/sorts, relaxations), BMSSP does **fewer** comparisons than Dijkstra past
  ~n = 1M on sparse graphs (0.91× at n = 2M) even though Dijkstra still wins wall-clock —
  the sorting barrier measurably broken, with constant factors as the remaining gap.
- **Performance cliffs (#182)** — two measured regimes where the head-to-head ratio breaks
  from its ~1.6–2× pattern: star graphs (superlinear blowup, 67.8× at n = 500k) and the
  `topLevel = ⌈log₂n / t⌉` 3→4 transition (5× at n = 4M on sparse). Milestone 1.2.0.
- **Docs page (#166)** — `docs/index.html`, the GitHub-Pages-published public-API reference
  (deployed by `static.yml` on `docs/**` changes). Documents exactly the three `index.mjs`
  exports — `BMSSP` (constructor contract, `calculateShortestPaths`, `reconstructPath`),
  `dijkstra`, `constantDegreeTransform` — and explicitly keeps algorithm internals out.
  Static, dependency-free HTML.
