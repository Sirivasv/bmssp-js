# bmssp-js benchmarks

Deterministic, dependency-free micro-benchmarks for `bmssp-js`. They exist to
(1) justify the adjacency map added in issue #45, and (2) run the **BMSSP vs.
Dijkstra** head-to-head across graph shapes (#170) — the "when to use which"
question, in both wall-clock time and the paper's own metric, comparison
counts. The measured 1.0.0 baseline record lives in
[`HEAD-TO-HEAD.md`](./HEAD-TO-HEAD.md); the latest captured harness report is
[`RESULTS.md`](./RESULTS.md).

## Running

```bash
npm run bench                      # adjacency + head-to-head timings
npm run bench:counts               # …plus the comparison-count tables (slower)
node benchmarks/run.mjs [--counts] # same, direct
node benchmarks/run.mjs --counts > benchmarks/RESULTS.md   # capture a report
```

All graphs come from seeded generators (`generators.mjs`), so numbers are
reproducible on a given machine. Timings use `process.hrtime.bigint()` with a
warm-up run and the median of several iterations; comparison counts are exact
and machine-independent (one run per side).

## What each file is

| File | Purpose |
|------|---------|
| `generators.mjs` | Seeded graph builders + the named `SCENARIOS` registry |
| `bench-util.mjs` | Timing (`timeMany`) and markdown-table helpers |
| `adjacency.bench.mjs` | Adjacency map (#45) vs. linear edge scan |
| `scenarios.bench.mjs` | Head-to-head per graph shape: construct, Dijkstra and BMSSP timings, verified outputs (#170) |
| `dijkstra-adj.mjs` | Algorithm-only Dijkstra over a prebuilt adjacency map + comparison counter — the fair baseline (#170) |
| `compare-counts.bench.mjs` | Comparison-count mode: the sorting barrier measured in the paper's cost metric (#170) |
| `run.mjs` | Runs everything, prints the report (`--counts` adds the count tables) |
| `HEAD-TO-HEAD.md` | Measured BMSSP-vs-Dijkstra results (1.0.0), methodology + tables |
| `RESULTS.md` | Latest captured harness report (`npm run bench:counts` output) |

---

## Result 1 — the adjacency map (#45) pays for itself immediately

Before #45, fetching a node's outgoing edges meant scanning the whole edge
array (`O(m)` per lookup). The adjacency map makes it a single `Map.get`
(`O(1)`, returning the node's edge list). On a 20k-node / 80k-edge sparse graph
doing 5,000 random per-node lookups:

| method | per-lookup |
|--------|-----------|
| linear scan (pre-#45) | ~75 µs |
| adjacency map (#45) | ~0.02 µs |

That is a **~4000× speedup on this graph**, and the gap grows linearly with edge
count `m` — the scan gets slower as the graph grows while the map stays flat.
Every inner loop of BMSSP (BaseCase, FindPivots, the main recursion) relaxes
edges out of frontier nodes, so this lookup sits on the hottest path in the
whole algorithm. #45 is a prerequisite, not an optimization.

> Exact numbers vary by machine; run `npm run bench` for yours. The captured
> report lives in [`RESULTS.md`](./RESULTS.md).

## Result 2 — graph-shape scenarios (BMSSP vs Dijkstra, #170)

`scenarios.bench.mjs` runs the head-to-head per shape: construction (which
includes building the #45 map), then **algorithm-only timings** for both
sides — `dijkstra-adj.mjs`'s prebuilt-adjacency Dijkstra and
`BMSSP.calculateShortestPaths()` consume the same adjacency Map, so neither
timed window contains graph loading. Outputs are verified node-by-node every
run; the `mismatches` column must read 0.

The shapes stress the axes that separate the two algorithms:

| scenario | shape | why it's here |
|----------|-------|---------------|
| `sparse-random` | `m = O(n)`, degree 3 | the road-network regime where BMSSP's asymptotics are meant to win |
| `dense-random` | avg degree 32 | edge-relaxation-bound; the `m` term dominates and sorting is cheap |
| `grid-4nbr` | 200×200 lattice | large diameter, low uniform degree (spatial/mesh) |
| `chain` | one long path | worst-case depth, minimal branching |
| `star` | one hub, n−1 spokes | extreme degree skew — the #182 blowup case |
| `sparse-random-l4` | degree 3, n = 300k | just past the `topLevel` 3→4 step at n = 2^18 — the #182 level-transition case |

## Result 3 — comparison counts (the sorting barrier, measured)

`npm run bench:counts` adds the paper's own cost metric: **comparisons between
path lengths**. Every BMSSP-side comparison funnels through
`compareKeys` (`src/tieBreak.mjs` keeps an unconditional counter); the
Dijkstra baseline counts its heap sifts, stale-pop checks and relaxations the
same way. Counts are deterministic, so one run per side is exact. On sparse
graphs the bmssp/dijkstra ratio falls as n grows and — since #167's
selection-based BlockList — is **already below 1.0 at n = 50k** (2026-07-21
capture: 0.97× at 50k → 0.77× at 200k → 0.66× at 1M), the measured form of
the paper's asymptotic claim. Before #167, sort-based splits/pulls pushed the
crossover out to ~n = 1M (`1.0.0` record: 1.18× at 50k → 1.01× at 200k →
0.96× at 1M → 0.91× at 2M).

---

## When to use which (measured guidance)

BMSSP's advantage is **asymptotic and narrow**: `O(m · log^(2/3) n)` vs.
Dijkstra's `O(m + n · log n)`. The question is measured, not asserted — the
harness reruns it on every `npm run bench` (fresh capture:
[`RESULTS.md`](./RESULTS.md); the deeper 1.0.0 record up to n = 4M:
[`HEAD-TO-HEAD.md`](./HEAD-TO-HEAD.md)):

- **Use Dijkstra for wall-clock speed:** it wins on every shape and size
  measured (algorithm-only timing, ~1.6–3× on sparse graphs, more on
  dense/chain/star). `bmssp-js` itself uses Dijkstra as the oracle precisely
  because it is correct and fast.
- **BMSSP's asymptotics are real and visible:** on sparse graphs the
  wall-clock gap narrows with n (2.5× at 50k → 1.57× at 2M in the 1.0.0
  record), and in the paper's own metric the harness's count mode shows the
  ratio below 1.0 from n = 50k on: **0.97× at 50k → 0.77× at 200k → 0.66×
  at 1M** (since #167; ~1M crossover before it). The sorting barrier is
  measurably broken; the remaining loss is constant factors.
- **Shapes that blunt BMSSP's edge, per the harness:** `dense-random`
  (relaxation-bound, ~4.7×), `chain` (depth, not sorting, is the cost —
  ~7.4× against the prebuilt-adjacency baseline), `star` (extreme fanout,
  ~3.8× at 50k — the #182 quadratic-`batchPrepend` blowup is **fixed**, 500k
  went 61 s → ~3 s and the ratio now falls with n), and the `topLevel` 3→4
  window (`sparse-random-l4`: ~3× at 300k — a measured **~+24% step** at the
  exact transition n = 2^18 → 2^18 + 1, inherent one-extra-relax-pass cost;
  both stay as regression sentinels; see the #182 addendum in
  [`HEAD-TO-HEAD.md`](./HEAD-TO-HEAD.md)).

**Bottom line for this repo:** BMSSP is implemented here for **correctness and
readability** — a faithful, tested rendering of the 2025 result. Pick Dijkstra
for real workloads; reach for BMSSP to study the algorithm. The measured
crossover in comparison counts — now one `npm run bench:counts` away — is the
honest demonstration of the paper's claim.
