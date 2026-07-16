# 07 — Glossary

<!-- Updated on: 2026-07-16 (terms last extended in the #161 PR: fuzz-suite terms +
     the boundary-tied-return tie caveat) -->

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
| `Pred[v]` | predecessor of `v` on the current best path (forms a tree). |
| `B` | upper distance **bound** for a (sub)problem; only vertices with `d < B` are in scope. |
| `B'` | the **returned** boundary of a call, `B' ≤ B`. Says how much real progress was made. |
| `S` | the **frontier** / source set of a (sub)problem. `|S| ≤ 2^(l·t)`. |
| `U` | the set of completed vertices a call returns (all with `d < B'`, reachable via `S`). |
| `U'` | (analysis) all `v` with `d(v) < B` whose shortest path visits `S`. Success ⇒ `U = U'`. |
| `P` | **pivots**: the ⊆ `S` roots of big shortest-path trees; `|P| ≤ |W|/k`. From FindPivots. |
| `W` | vertices completed/collected by FindPivots' `k` Bellman-Ford rounds; `|W| = O(k·|S|)`. |
| `F` | forest of "tight" edges (`d̂[v] == d̂[u]+w(u,v)`) inside `W`; used to find pivot roots. |
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
- **BaseCase / FindPivots / BMSSP** — Algorithm 2 / Algorithm 1 / Algorithm 3. See §02.
- **BlockList (`D`)** — Lemma 3.3 semi-sorted structure. See §03-B.
- **Oracle** — the reference `dijkstra()` in `src/dijkstra.mjs`; ground truth for tests.

## Code / repo terms

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
  vertices, relaxing the shared `dHat` (`d̂[·]`) **in place**. Returns `{ bound, vertices }`
  (= the paper's `B', U`). Internal (not re-exported from `index.mjs`).
- **Settled-vertex guard** (#40) — `baseCase` never re-inserts a vertex it already settled
  in the same call: the paper's `≤` relaxation admits equal-sum re-relaxations (e.g.
  zero-weight cycles) that would loop forever, and with non-negative weights a settled
  vertex cannot strictly improve, so skipping it is loss-free.
- **`findPivots(B, S, dHat, adjacency, k)`** (#44) — `src/findPivots.mjs`, Algorithm 1:
  `k` rounds of Bellman-Ford out of the complete frontier `S`, relaxing the shared `dHat`
  (`d̂[·]`) **in place**; `< B` gates membership in `W` only (the d̂ write is unconditional).
  Returns `{ pivots, W }` (= the paper's `P, W`), with `|pivots| ≤ |W|/k`. Internal (not
  re-exported from `index.mjs`).
- **Early exit** (#44) — `findPivots`' first branch: as soon as `|W| > k·|S|` after a round,
  return `pivots = S` — the frontier is already small relative to `W`.
- **One-parent rule** (#44) — building the tight-edge forest `F`, each vertex accepts at
  most one parent (the first tight edge in W-iteration order). Keeps tree sizes well-defined
  when equal-length paths make `F` a DAG (tie caveat, #163). Corollary: vertices on a tight
  (zero-weight) cycle all have parents, so none roots a tree and none can be a pivot.
- **`bmssp(l, B, S)`** (#43) — method on the `BMSSP` class, Algorithm 3: the main bounded
  multi-source recursion. Level 0 delegates to `baseCase`; level ≥ 1 wires `findPivots` →
  `BlockList` → recursive `bmssp(l-1, Bi, Si)` calls with band-routed relaxation. Returns
  `{ bound, vertices }` (= the paper's `B', U`). `calculateShortestPaths(start)` runs
  `bmssp(topLevel, Infinity, {start})` after setting `d̂[start] = 0`.
- **`deriveParameters()`** (#43) — class method (called by the constructor) that derives and
  stores `this.k`, `this.t`, `this.topLevel` from `n = nodeIDs.size`, each clamped to ≥ 1:
  `k = ⌊(log₂n)^(1/3)⌋`, `t = ⌊(log₂n)^(2/3)⌋`, `topLevel = ⌈log₂n / t⌉`. The clamp keeps
  tiny graphs out of degenerate regimes; `k·2^(topLevel·t) ≥ n` makes the top call a
  successful execution.
- **Workload guard / cap** (#43) — Algorithm 3's `|U| < k·2^(l·t)` loop condition: trips on
  partial executions (`bound < B`); can never trip below `n` at the top level.
- **Completed-vertex guard** (#43) — `bmssp()` never re-queues a vertex already in the
  current call's `U` on an equal-sum relaxation (the level-≥1 mirror of `baseCase`'s
  settled-vertex guard; prevents zero-weight ping-pong loops).
- **Out-of-scope pivot gate** (#43) — a pivot arriving with `d̂ ≥ B` (possible when a pull
  returns a key tied with its separator) is skipped when seeding `D`; the ancestor whose
  band covers its distance handles it. Tie caveat, #163.
- **Stall escape hatch** (#43) — when a child `bmssp`/`baseCase` call returns zero vertices
  (everything it settled tied exactly at its boundary — zero-weight paths, #163), each batch
  member is settled with an uncapped `baseCase` run (`k = n`) bounded by `Bi` so the loop
  always makes progress. Correct, just not sublinear; only reachable on Assumption 2.1
  violations.
- **Boundary-tied re-queue** (#43) — an `Si` member left at `d̂ == Bi < B` after the child
  returns re-enters `D` via a regular `insert` (the paper's `[Bi', Bi)` band would silently
  drop it). Tie caveat, #163.
- **Boundary-tied return** (#161) — under ties, a bounded **partial** `bmssp()` execution
  can return a vertex with `d(v) == B'` (via the stall escape hatch); Lemma 3.1's strict
  `d(v) < B'` holds only under Assumption 2.1. Internal contract under ties: returned
  vertices satisfy `d(v) ≤ B'`, completeness below `B'` stays strict. Tie caveat, #163;
  fuzz-found at seed 163066.
- **Fuzz suite** (#161) — `test/fuzz.test.mjs`: high-volume seeded property tests. Full-map
  oracle equality across 8 graph shapes and 4 extreme weight regimes, plus direct
  multi-source bounded `bmssp(topLevel, B, S)` checks against per-source Dijkstra oracles
  (`trueDist(v) = min_s(d0[s] + dist_s(v))`). Failure messages carry the round's seed.
- **`FUZZ_ROUNDS`** (#161) — environment variable multiplying every fuzz round count
  (default 1). `FUZZ_ROUNDS=25 npm test -- test/fuzz.test.mjs` runs several thousand
  graphs in ~5 s.
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
