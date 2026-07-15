# bmssp-js benchmarks

Deterministic, dependency-free micro-benchmarks for `bmssp-js`. They exist to
(1) justify the adjacency map added in issue #45, and (2) stand up the harness
that will drive the eventual **BMSSP vs. Dijkstra** comparison across graph
shapes — the "when to use which" question.

## Running

```bash
node benchmarks/run.mjs            # print a markdown report
node benchmarks/run.mjs > RESULTS.md
npm run bench                      # same, via package script
```

All graphs come from seeded generators (`generators.mjs`), so numbers are
reproducible on a given machine. Timings use `process.hrtime.bigint()` with a
warm-up run and the median of several iterations.

## What each file is

| File | Purpose |
|------|---------|
| `generators.mjs` | Seeded graph builders + the named `SCENARIOS` registry |
| `bench-util.mjs` | Timing (`timeMany`) and markdown-table helpers |
| `adjacency.bench.mjs` | Adjacency map (#45) vs. linear edge scan |
| `scenarios.bench.mjs` | Construct + Dijkstra timings per graph shape |
| `run.mjs` | Runs everything, prints the report |

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

## Result 2 — graph-shape scenarios (Dijkstra baseline)

`scenarios.bench.mjs` times construction (which now includes building the #45
map) and one single-source Dijkstra run per shape. **Today
`calculateShortestPaths` delegates to the Dijkstra oracle**, so this is a pure
Dijkstra baseline — deliberately so. When the real BMSSP recursion lands
(#40–#44) the same harness gains a second column and this table becomes the
head-to-head.

The five shapes are chosen to stress the axes that separate the two algorithms:

| scenario | shape | why it's here |
|----------|-------|---------------|
| `sparse-random` | `m = O(n)`, degree 3 | the road-network regime where BMSSP's asymptotics are meant to win |
| `dense-random` | avg degree 32 | edge-relaxation-bound; the `m` term dominates and sorting is cheap |
| `grid-4nbr` | 200×200 lattice | large diameter, low uniform degree (spatial/mesh) |
| `chain` | one long path | worst-case depth, minimal branching |
| `star` | one hub, n−1 spokes | extreme degree skew |

---

## When to use which (current guidance)

BMSSP's advantage is **asymptotic and narrow**. Its bound is
`O(m · log^(2/3) n)` vs. Dijkstra's `O(m + n · log n)`, so it can only win where
the `n · log n` sorting term actually dominates and `n` is enormous. Concretely:

- **Use Dijkstra (default, today):** essentially always in practice. It wins on
  every graph size you can hold in memory in JS, on dense graphs (the `m` term
  dominates and there is little sorting to save), on small/medium graphs, and
  wherever you also want vertices emitted in sorted distance order. `bmssp-js`
  itself uses Dijkstra as the oracle precisely because it is correct and fast.
- **Where BMSSP is designed to win (theory):** very large, **sparse** directed
  graphs (`m = O(n)`, the `sparse-random`/`grid` shapes) where the sorting
  barrier — the `n · log n` term — is the bottleneck and you only need
  distances, not their order. The crossover `n` is astronomically large;
  independent studies find real speedups far smaller than theory and often
  negative at practical sizes.
- **Shapes that blunt BMSSP's edge:** `dense-random` (relaxation-bound, nothing
  to save), `chain` (depth, not sorting, is the cost — frontier tricks don't
  help), and `star` (one node dominates degree; the frontier never gets wide).

**Bottom line for this repo:** BMSSP is implemented here for **correctness and
readability** — a faithful, tested rendering of the 2025 result — not to beat
Dijkstra on wall-clock time. Pick Dijkstra for real workloads; reach for BMSSP
to study the algorithm or when you have a provably huge sparse instance and only
need distances. These benchmarks make that trade-off measurable rather than
asserted, and will show the real crossover (if any) once #43 is done.
