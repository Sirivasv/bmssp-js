# BMSSP vs. Dijkstra — the 1.0.0 head-to-head

The question this repo exists to answer: now that the full Algorithm 3 recursion is
functional (`1.0.0`), **does BMSSP actually beat Dijkstra?** Measured 2026-07-16 on
node v26.5.0, darwin/arm64, with the seeded generators from
[`generators.mjs`](./generators.mjs). Two answers, both honest:

- **Wall-clock: no.** Dijkstra wins at every size that fits in memory — but the gap
  *narrows* as sparse graphs grow (2.5× at 50k nodes → 1.57× at 2M).
- **Comparison counts — the paper's own metric: yes.** On sparse graphs BMSSP performs
  **fewer distance comparisons than Dijkstra from about n = 1M**, and the advantage grows
  with n. The "sorting barrier" is measurably broken; the wall-clock loss is JS constant
  factors (Map churn, allocation), not algorithmic work.

> This document is the frozen 1.0.0 measurement record (sizes up to n = 4M). Since #170
> the harness reruns the head-to-head on every `npm run bench` (both timing columns,
> outputs verified) and `npm run bench:counts` reproduces the comparison-count crossover;
> the latest capture lives in [`RESULTS.md`](./RESULTS.md).

## Methodology — algorithm time only

Timing starts when the algorithm starts and stops when it finishes. Everything that is
*loading*, not *algorithm*, sits outside the timed window, identically for both sides:

- Graph construction (edge-array copy, `nodeIDs`, the #45 adjacency map, parameter
  derivation) happens once, untimed, in the `BMSSP` constructor.
- The Dijkstra variant used here consumes the **same prebuilt `adjacency` Map** the BMSSP
  instance uses. (The exported `dijkstra()` builds its own adjacency list inside the call —
  that would bill graph loading to Dijkstra, so it is excluded.)
- Timed regions: `graph.calculateShortestPaths(source)` vs. the Dijkstra heap traversal.
  Median of 3 runs after a warm-up (2 runs for n ≥ 2M). Outputs verified node-by-node
  identical every run.

## Result 1 — wall-clock by graph shape

| case | n | m | dijkstra ms | bmssp ms | bmssp/dijkstra |
| --- | --- | --- | --- | --- | --- |
| sparse d3 n=50k | 50,000 | 150,000 | 36.3 | 90.3 | 2.49× |
| sparse d3 n=200k | 200,000 | 600,000 | 230.5 | 438.7 | 1.90× |
| sparse d3 n=1M | 1,000,000 | 3,000,000 | 2,180 | 4,020 | 1.84× |
| sparse d2 n=1M | 1,000,000 | 2,000,000 | 1,694 | 2,971 | 1.75× |
| dense d32 n=8k | 8,000 | 256,000 | 16.8 | 48.4 | 2.88× |
| grid 200x200 | 40,000 | 159,200 | 24.2 | 81.7 | 3.38× |
| grid 700x700 | 490,000 | 1,957,200 | 513 | 1,362 | 2.65× |
| chain n=50k | 50,000 | 49,999 | 9.3 | 45.1 | 4.83× |
| star n=50k | 50,000 | 99,998 | 46.0 | 284.5 | 6.18× |
| star n=500k | 500,000 | 999,998 | 901 | 61,090 | **67.8×** ([#182](https://github.com/Sirivasv/bmssp-js/issues/182)) |

Dijkstra wins everywhere, and the shapes rank exactly as the theory predicts: sparse
random graphs (BMSSP's home regime) are closest; dense, chain, and star graphs — where
there is little sorting to save — are worst. The star blow-up is superlinear and tracked
as a real defect in [#182](https://github.com/Sirivasv/bmssp-js/issues/182).

## Result 2 — the sparse scaling trend (and a cliff)

Sparse random, out-degree 3, one row per size (`k`, `t`, `topLevel` from
`deriveParameters()`):

| n | m | topLevel | dijkstra ms | bmssp ms | ratio |
| --- | --- | --- | --- | --- | --- |
| 50,000 | 150,000 | 3 | 35 | 89 | 2.54× |
| 200,000 | 600,000 | 3 | 220 | 366 | 1.67× |
| 500,000 | 1,500,000 | 3 | 782 | 1,513 | 1.94× |
| 1,000,000 | 3,000,000 | 3 | 2,000 | 3,398 | 1.70× |
| 2,000,000 | 6,000,000 | 3 | 5,249 | 8,217 | **1.57×** |
| 4,000,000 | 12,000,000 | **4** | 11,475 | 57,353 | 5.00× |

The ratio narrows steadily with n — the asymptotic advantage showing through — until
n = 4M, where `topLevel = ⌈log₂n / t⌉` steps from 3 to 4 and the ratio jumps 3× worse
(GC/memory pressure at 12M edges may contribute). The cliff is part of
[#182](https://github.com/Sirivasv/bmssp-js/issues/182).

## Result 3 — comparison counts: the sorting barrier, measured

The paper's claim lives in the **comparison-addition model**: only `+` and `<` on path
lengths count. So count them. Instrumented copies of the five algorithm modules increment
a counter at every comparison between two distance values — heap sift comparisons,
BlockList binary searches, block-split and batch sorts, and every relaxation test — on
both sides (same counting rules for the Dijkstra variant).

| case | dijkstra cmps | bmssp cmps | bmssp/dijkstra |
| --- | --- | --- | --- |
| sparse d3 n=50k | 1,653,644 | 1,957,387 | 1.18× |
| sparse d3 n=200k | 7,509,518 | 7,568,672 | 1.01× |
| sparse d3 n=1M | 42,837,183 | 41,292,114 | **0.96×** |
| sparse d3 n=2M | 90,023,950 | 81,843,075 | **0.91×** |
| grid 700x700 | 15,269,647 | 19,355,165 | 1.27× |

**On sparse graphs, BMSSP crosses below Dijkstra between n = 200k and n = 1M, and keeps
pulling away** — with this implementation's shortcuts (array bound index, O(M log M)
splits, #167) still in place. This is the O(m·log^(2/3) n) vs. O(m + n·log n) separation
showing up in real operation counts. Dijkstra's comparisons grow with the n·log n sorting
term; BMSSP replaces that with partial sorting, and past the crossover it simply does
less ordering work per vertex.

## Reading the two results together

- **Use Dijkstra for wall-clock speed** at any practical size in JS. Its inner loop is a
  tight array-heap; BMSSP's recursion pays for Map/Set traffic, block bookkeeping, and
  FindPivots' repeated Bellman-Ford passes on every level.
- **The algorithm itself is doing less work** (Result 3) exactly where the theory says it
  should — large sparse graphs. A constant-factor-focused implementation (typed arrays,
  #167's exact Lemma 3.3 asymptotics, #168's micro-optimizations) is what would move the
  wall-clock crossover from "astronomical" toward "large".
- Independent experimental studies of this algorithm report the same shape of outcome:
  asymptotics visible in operation counts, wall-clock wins rare-to-absent at practical
  sizes. This repo's numbers are consistent with the literature.

## Reproducing

Both measurements are integrated into the harness since
[#170](https://github.com/Sirivasv/bmssp-js/issues/170): `npm run bench` reruns the
algorithm-only head-to-head per shape (outputs verified node-by-node), and
`npm run bench:counts` reproduces the comparison-count tables. The latest capture lives
in [`RESULTS.md`](./RESULTS.md); the raw 1.0.0 numbers above are also recorded on
[#170](https://github.com/Sirivasv/bmssp-js/issues/170#issuecomment-4991749542).

## Addendum — the #182 cliff investigation (2026-07-21)

The two pathologies in the 1.0.0 tables above were profiled
([#182](https://github.com/Sirivasv/bmssp-js/issues/182)); one was a fixable defect, the
other is inherent recursion cost. Both are permanent regression sentinels in
`npm run bench` (`star`, `sparse-random-l4`).

**1. The star blowup was quadratic `BatchPrepend` bookkeeping — fixed.** CPU profiles put
64% of star-graph self-time in `BlockList.batchPrepend`: it prepended each chunk with
`d0.unshift`, re-shifting the whole block array per chunk. At recursion level 1 the block
size is `M = 1`, so a hub fanning out to ~n neighbors staged ~n single-entry chunks —
~1.25 **billion** element moves at n = 50k, and O(n²) overall, matching the superlinear
ratios above (67.8× at 500k). The fix (all chunk blocks prepended in one concat) restores
the documented amortized bound. Measured after: star 500k **61,090 ms → ~3,100 ms
(67.8× → ~5.5×)**, and the ratio now *falls* with n (6.6× at 50k → 5.5× at 500k) — the
superlinearity is gone. The residual ~5× is ordinary constant-factor overhead on a shape
where BMSSP's frontier machinery buys nothing (one hub completes and everything else is
distance-2). Further constant-factor work: #167 (block-index structure), #168.

**2. The `topLevel` 3→4 cliff is one extra full relax pass — inherent, and much smaller
than the 4M row suggests.** A clean straddle at the exact step (n = 262,144 → 262,145,
one vertex apart, same seed) measures 2.71× → 3.37×: a **~+24% step**, not 3×. Per-level
instrumentation shows BlockList work is virtually identical on both sides; the extra
level adds one more full pass of edge relaxations out of the children's returned `U` sets
plus another round of `U`/`W` set bookkeeping — O(m + n) of Map/Set/composite-key work
per level, which is the recursion's designed cost model. The remaining gap up to the
recorded 5.00× at n = 4M is memory/GC amplification at 12M edges (visible as GC time in
profiles), not an algorithmic discontinuity. Known behavior; the per-level constant is
#168's target. The `topLevel = 4` window at practical sizes is exactly
n ∈ (2^18, ~376k] — `sparse-random-l4` (n = 300k) sits inside it.

## Addendum — #167 moves the comparison-count crossover to n < 50k (2026-07-21)

Restoring Lemma 3.3's exact asymptotics in the BlockList
([#167](https://github.com/Sirivasv/bmssp-js/issues/167): balanced-BST bound index +
deterministic linear-time selection replacing the array `splice`s and the O(M log M)
sort-based splits/chunks/pulls) turned out to be worth far more in the paper's own metric
than the "ordinary constant factors" the #182 profiles suggested. Selection via budgeted
introselect (median-of-3 quickselect, ~2–3n comparisons, with a median-of-medians
fallback keeping the worst case linear) does strictly less comparison work than the sorts
it replaced, at every M:

| case | 1.1.1 (sort-based) | post-#167 | change |
| --- | --- | --- | --- |
| sparse d3 n=50k | 1.20× | **0.97×** | crossover reached at 50k |
| sparse d3 n=200k | 1.03× | **0.77×** | |
| sparse d3 n=1M | 0.98× | **0.66×** | |
| grid 700x700 | 1.27× | 1.12× | |

The sparse crossover that previously required ~n = 1M now happens **before n = 50k**, and
the separation widens with n exactly as O(m·log^(2/3) n) vs. O(m + n·log n) predicts.
Wall-clock stayed at-or-better than 1.1.1 on every shape (star 50k ~144 ms → ~131 ms;
sparse 50k within noise; `sparse-random-l4` ~1,246 ms → ~1,083 ms) — the AVL bound index
and selection cost about what the array + native sort did, while doing asymptotically
honest work. Current capture: [`RESULTS.md`](./RESULTS.md).
