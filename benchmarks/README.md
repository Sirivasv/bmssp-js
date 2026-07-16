# bmssp-js benchmarks

Deterministic, dependency-free micro-benchmarks for `bmssp-js`. They exist to
(1) justify the adjacency map added in issue #45, and (2) stand up the harness
that drives the **BMSSP vs. Dijkstra** comparison across graph shapes — the
"when to use which" question. The measured 1.0.0 head-to-head (wall-clock *and*
comparison counts) lives in [`HEAD-TO-HEAD.md`](./HEAD-TO-HEAD.md).

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
| `HEAD-TO-HEAD.md` | Measured BMSSP-vs-Dijkstra results (1.0.0), methodology + tables |

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
map) and one single-source Dijkstra run per shape — the Dijkstra baseline
column of the head-to-head. The real BMSSP recursion landed in `1.0.0` (#43);
integrating an algorithm-only `bmssp` column (and an optional comparison-count
mode) into this harness is tracked in #170. The measured results so far are in
[`HEAD-TO-HEAD.md`](./HEAD-TO-HEAD.md).

The five shapes are chosen to stress the axes that separate the two algorithms:

| scenario | shape | why it's here |
|----------|-------|---------------|
| `sparse-random` | `m = O(n)`, degree 3 | the road-network regime where BMSSP's asymptotics are meant to win |
| `dense-random` | avg degree 32 | edge-relaxation-bound; the `m` term dominates and sorting is cheap |
| `grid-4nbr` | 200×200 lattice | large diameter, low uniform degree (spatial/mesh) |
| `chain` | one long path | worst-case depth, minimal branching |
| `star` | one hub, n−1 spokes | extreme degree skew |

---

## When to use which (measured guidance, 1.0.0)

BMSSP's advantage is **asymptotic and narrow**: `O(m · log^(2/3) n)` vs.
Dijkstra's `O(m + n · log n)`. With the full algorithm now functional, the
question is measured rather than asserted — see
[`HEAD-TO-HEAD.md`](./HEAD-TO-HEAD.md) for methodology and tables:

- **Use Dijkstra for wall-clock speed:** it wins on every shape and size
  measured so far (algorithm-only timing, ~1.6–2× faster on large sparse
  graphs, more on dense/chain/star). `bmssp-js` itself uses Dijkstra as the
  oracle precisely because it is correct and fast.
- **BMSSP's asymptotics are real and visible:** on sparse graphs the wall-clock
  gap narrows steadily with n (2.5× at 50k nodes → 1.57× at 2M), and in the
  paper's own metric — comparisons between path lengths — **BMSSP does fewer
  comparisons than Dijkstra from about n = 1M**, improving with size. The
  sorting barrier is measurably broken; the remaining loss is constant factors.
- **Shapes that blunt BMSSP's edge:** `dense-random` (relaxation-bound, nothing
  to save), `chain` (depth, not sorting, is the cost), and `star` (extreme
  fanout — currently a real performance defect, tracked in #182).

**Bottom line for this repo:** BMSSP is implemented here for **correctness and
readability** — a faithful, tested rendering of the 2025 result. Pick Dijkstra
for real workloads; reach for BMSSP to study the algorithm. The measured
crossover in comparison counts (#170 tracks putting it in the harness) is the
honest demonstration of the paper's claim.
