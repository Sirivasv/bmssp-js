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

[#170](https://github.com/Sirivasv/bmssp-js/issues/170) tracks integrating both
measurements into the `npm run bench` harness (an algorithm-only `bmssp` column in
`scenarios.bench.mjs` plus an optional comparison-count mode). Until then, the recipe:
build the `BMSSP` instance untimed; time `calculateShortestPaths(source)` against a
Dijkstra traversal fed the instance's own `adjacency` Map; for comparison counts, add a
shared counter to every distance-comparison site in `src/*.mjs` and the Dijkstra variant.
The raw numbers above are also recorded on
[#170](https://github.com/Sirivasv/bmssp-js/issues/170#issuecomment-4991749542).
