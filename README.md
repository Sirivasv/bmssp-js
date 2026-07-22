# BMSSP: Bounded Multi-Source Shortest Paths

[![codecov](https://codecov.io/gh/sirivasv/bmssp-js/branch/main/graph/badge.svg)](https://codecov.io/gh/sirivasv/bmssp-js)
[![npm version](https://img.shields.io/npm/v/bmssp.svg)](https://www.npmjs.com/package/bmssp)
[![Docker Image Version](https://img.shields.io/docker/v/sirivasv/bmssp-js?label=docker&sort=semver)](https://hub.docker.com/r/sirivasv/bmssp-js)
[![GitHub Repo stars](https://img.shields.io/github/stars/sirivasv/bmssp-js?style=social)](https://github.com/sirivasv/bmssp-js/stargazers)

A community-driven JavaScript (ES Modules) implementation of the Tsinghua single-source
shortest-paths algorithm from the paper
["Breaking the Sorting Barrier for Directed Single-Source Shortest Paths"](https://dl.acm.org/doi/10.1145/3717823.3718179)
(Duan, Mao, Mao, Shu, Yin — 2025): a deterministic **O(m·log^(2/3) n)** SSSP algorithm, the
first to beat Dijkstra's O(m + n·log n) bound on sparse directed graphs.

**BMSSP** stands for **B**ounded **M**ulti-**S**ource **S**hortest **P**aths.

## Project status

**The algorithm is functional end-to-end as of `1.0.0`** 🎉 — `calculateShortestPaths()`
computes distances via the paper's method (FindPivots → block list → recursive BMSSP with
the bounded base case), validated node-by-node against a Dijkstra oracle on thousands of
seeded graphs — up to 2 million nodes. The project was built piece by piece against the paper,
with every building block shipped, tested, and released individually:

| Building block (paper) | Where | Status |
| --- | --- | --- |
| Reference Dijkstra oracle (ground truth for tests) | `src/dijkstra.mjs` | ✅ done |
| O(1) adjacency map for edge relaxation ([#45](https://github.com/Sirivasv/bmssp-js/issues/45)) | `BMSSP` constructor | ✅ done |
| Lemma 3.3 block-based partial-sort structure `D` ([#42](https://github.com/Sirivasv/bmssp-js/issues/42)) | `src/blockList.mjs` | ✅ done |
| Indexed binary min-heap ([#41](https://github.com/Sirivasv/bmssp-js/issues/41)) | `src/heap.mjs` | ✅ done |
| `BaseCase(B, S)` — Algorithm 2, bounded mini-Dijkstra ([#40](https://github.com/Sirivasv/bmssp-js/issues/40)) | `src/baseCase.mjs` | ✅ done |
| `FindPivots(B, S)` — Algorithm 1, frontier shrinking ([#44](https://github.com/Sirivasv/bmssp-js/issues/44)) | `src/findPivots.mjs` | ✅ done |
| `BMSSP(l, B, S)` — Algorithm 3, the main recursion ([#43](https://github.com/Sirivasv/bmssp-js/issues/43)) | `src/bmssp.mjs` | ✅ done — **1.0.0** |
| Deterministic tie-breaking — Assumption 2.1 realized ([#163](https://github.com/Sirivasv/bmssp-js/issues/163)) | `src/tieBreak.mjs` | ✅ done |
| Shortest-path reconstruction ([#169](https://github.com/Sirivasv/bmssp-js/issues/169)) | `BMSSP.reconstructPath()` | ✅ done |
| Constructor input validation ([#165](https://github.com/Sirivasv/bmssp-js/issues/165)) | `BMSSP` constructor | ✅ done |
| Opt-in constant-degree transform, in/out-degree ≤ 2 ([#164](https://github.com/Sirivasv/bmssp-js/issues/164)) | `constantDegreeTransform()` | ✅ done |
| BMSSP-vs-Dijkstra head-to-head in the benchmark harness ([#170](https://github.com/Sirivasv/bmssp-js/issues/170)) | `npm run bench` / `npm run bench:counts` | ✅ done |
| Performance-cliff investigation; quadratic `BatchPrepend` fixed ([#182](https://github.com/Sirivasv/bmssp-js/issues/182)) | `src/blockList.mjs` | ✅ done — **1.1.1** |
| Exact Lemma 3.3 asymptotics: balanced-BST bound index + linear-time selection ([#167](https://github.com/Sirivasv/bmssp-js/issues/167)) | `src/boundIndex.mjs` + `src/select.mjs` | ✅ done |
| Relaxation micro-optimizations: allocation-free hot loops, −13–23% wall-clock ([#168](https://github.com/Sirivasv/bmssp-js/issues/168)) | `src/tieBreak.mjs` + the algorithm modules | ✅ done — **1.2.0** |
| Dense-index core: typed-array labels + CSR adjacency, ~½ the wall-clock ([#205](https://github.com/Sirivasv/bmssp-js/issues/205)) | `src/bmssp.mjs` (CSR) + `src/tieBreak.mjs` (typed labels) | ✅ done |
| Typed / flexible graph inputs: `Graph` builder + adjacency Map/object + explicit vertex universe ([#172](https://github.com/Sirivasv/bmssp-js/issues/172)) | `src/graph.mjs` + `BMSSP` constructor | ✅ done |
| Public multi-source / bounded entrypoint ([#171](https://github.com/Sirivasv/bmssp-js/issues/171)) | `BMSSP.calculateShortestPathsFrom()` | ✅ done |
| Public API stabilization + 1.0→2.0 migration note ([#173](https://github.com/Sirivasv/bmssp-js/issues/173)) | `MIGRATION.md` + `docs/index.html` + contract test | ✅ done — **2.0.0** |
| Direct-CSR construction: build the index/CSR straight from the input, ~½ the construction time ([#212](https://github.com/Sirivasv/bmssp-js/issues/212)) | `BMSSP` constructor | ✅ done — **3.0.0** |

> **Honest note:** the paper's win is asymptotic, and this repo optimizes for correctness
> and readability first — but the constant factors have come down a lot. Measured
> head-to-head (algorithm time only, graph loading excluded — rerun it yourself with
> `npm run bench`; methodology and the deep 1.0.0 record in
> [benchmarks/HEAD-TO-HEAD.md](benchmarks/HEAD-TO-HEAD.md)): Dijkstra still wins on
> wall-clock, but after the dense-index engine
> ([#205](https://github.com/Sirivasv/bmssp-js/issues/205): typed-array labels + CSR
> adjacency) **BMSSP is within ~1.1–1.4× on sparse graphs** (sparse-random 1.38×,
> sparse-l4 1.07×, dense 1.16×) — down from ~2.5× before. And in the paper's own metric —
> **comparisons between path lengths** — BMSSP does **fewer comparisons than Dijkstra
> from under n = 50k on sparse graphs** (`npm run bench:counts` measures 0.95× at 50k →
> 0.76× at 200k → **0.65× at 1M**), and the advantage grows with size: the "sorting
> barrier" is measurably broken. That crossover
> used to sit at ~n = 1M until [#167](https://github.com/Sirivasv/bmssp-js/issues/167)
> replaced the block structure's sort-based internals with the paper's exact machinery
> (balanced-BST bound index + deterministic linear-time selection).
> The two performance cliffs found in the 1.0.0 measurements were
> run down in [#182](https://github.com/Sirivasv/bmssp-js/issues/182): the star-graph
> blowup was a quadratic in `BatchPrepend`'s bookkeeping — fixed in `1.1.1` (500k-node
> star: 61 s → ~3 s) — and the recursion-level step is an inherent, measured ~+24% per
> extra level (see the addendum in
> [benchmarks/HEAD-TO-HEAD.md](benchmarks/HEAD-TO-HEAD.md)).
> Where inputs violate the paper's distinct-path-lengths assumption (e.g. zero-weight
> edges), a principled deterministic tie-break
> ([#163](https://github.com/Sirivasv/bmssp-js/issues/163)) realizes that assumption in
> code: paths are ranked by composite `(length, hops, id)` keys, so distances, predecessor
> pointers and completed sets are identical no matter how the edge list is ordered.

## How it works (in two ideas)

1. **Shrink the frontier with pivots.** Instead of keeping every frontier vertex in a
   priority queue like Dijkstra, run `k` rounds of Bellman-Ford-style relaxation and recurse
   only on the "pivots" — roots of large shortest-path trees. Only ~1/k of the frontier
   needs the expensive treatment.
2. **Partial sorting instead of a heap.** A block-based structure keeps batches of vertices
   ordered *between* blocks but unsorted *within* them — enough to repeatedly pull the next
   closest batch without paying the Θ(log n)-per-vertex "sorting barrier."

Dijkstra still wins the wall-clock race, but only by a small margin on sparse graphs now
(~1.1–1.4× since the dense-index engine); in measured comparison counts this
implementation already beats Dijkstra from under 50k nodes on sparse graphs, by a third
at 1M ([benchmarks/HEAD-TO-HEAD.md](benchmarks/HEAD-TO-HEAD.md)). This repo optimizes for
a **correct, readable, well-tested** implementation, validated line-by-line against a
Dijkstra oracle first — with the constant factors brought down where it doesn't cost
clarity.

## Installation

```bash
npm install bmssp
```

## Usage

The package is ESM-only (`.mjs`). Graphs are arrays of `[from, to, weight]` edges with
finite numeric node IDs and finite, non-negative weights. The constructor rejects malformed
edges with an error that identifies their array index; an empty edge array remains valid:

```javascript
import { BMSSP } from "bmssp";

const graph = new BMSSP([
  [0, 1, 50],
  [1, 2, 75],
  [0, 2, 25],
]);

graph.calculateShortestPaths(0);
console.log(graph.shortestPaths); // Map(3) { 0 => 0, 1 => 50, 2 => 25 }
console.log(graph.reconstructPath(1)); // [0, 1]
```

`reconstructPath(target)` uses the latest `calculateShortestPaths()` run. It returns `[]`
when the target is unreachable (or before any run) and throws for a node outside the graph.

A reference `dijkstra` implementation is also exported. See the `examples/` directory for
more, or the [public API reference](https://sirivasv.github.io/bmssp-js/) for the complete
documented surface. The public API has been **stable since 2.0.0** — see
[MIGRATION.md](MIGRATION.md) for the migration notes and the locked surface. (3.0.0 is a
performance release whose only public-surface change is removing the little-used
`graph`/`adjacency` instance fields — use `getEdges(id)` for a node's outgoing edges.)

### Flexible graph inputs

The constructor also accepts an **adjacency map/object** or a small **`Graph` builder** — all
equivalent to the edge-array form (node IDs stay finite numbers). The builder is also the way
to declare an **isolated vertex** (one with no incident edges), which the plain edge list
can't express:

```javascript
import { BMSSP, Graph } from "bmssp";

// Adjacency object ({ from: [[to, weight], ...] }) or a Map with the same shape:
new BMSSP({ 0: [[1, 50], [2, 25]], 1: [[2, 75]] });

// Or the chainable builder — addVertex declares nodes (incl. isolated ones):
const g = new Graph()
  .addEdge(0, 1, 50)
  .addEdge(0, 2, 25)
  .addEdge(1, 2, 75)
  .addVertex(9); // an isolated vertex: present, but unreachable (Infinity)

const graph = new BMSSP(g);
graph.calculateShortestPaths(0);
console.log(graph.shortestPaths.get(2)); // 25
console.log(graph.shortestPaths.get(9)); // Infinity
```

(Plain-object keys are strings in JavaScript, so the object form coerces them to numbers;
use a `Map` or the `Graph` builder if you want to keep numeric keys explicit.)

### Multi-source and bounded runs

`calculateShortestPathsFrom(sources, { bound })` runs the paper's `BMSSP(l, B, S)`
generalization directly: from a **set** of sources, each with an initial distance, optionally
under a strict distance **bound `B`**. Results land in `shortestPaths` just like
`calculateShortestPaths` — single-source SSSP is exactly the special case
`calculateShortestPathsFrom([start])`.

```javascript
import { BMSSP } from "bmssp";

const g = new BMSSP([
  [0, 1, 2],
  [1, 2, 3],
  [5, 2, 1],
]);

// Nearest of several sources (each seeded at distance 0):
g.calculateShortestPathsFrom([0, 5]);
console.log(g.shortestPaths.get(2)); // 1  (via 5 -> 2, beating 0 -> 1 -> 2 = 5)

// Sources with explicit initial distances, as pairs / a Map / an object:
g.calculateShortestPathsFrom([
  [0, 0],
  [5, 10],
]);
console.log(g.shortestPaths.get(2)); // 5  (via 0 -> 1 -> 2; 5's head start no longer wins)

// Bounded: only vertices with distance < B are completed; the rest stay Infinity.
g.calculateShortestPathsFrom([0], { bound: 4 });
console.log(g.shortestPaths.get(1)); // 2
console.log(g.shortestPaths.get(2)); // Infinity  (distance 5 is not < 4)
```

Sources accept a `Map<id, dist>`, an object `{ id: dist }`, an array of `[id, dist]` pairs, or
a bare array of ids (each seeded at distance 0). Initial distances are treated as the sources'
true (complete) distances — with the common all-zero seeding this is automatic. `bound`
defaults to `Infinity` (unbounded).

### Optional: constant-degree transform

The paper's bound assumes every vertex has in-degree and out-degree ≤ 2. That preprocessing
is **not** required for correctness here — BMSSP is validated on arbitrary graphs — but it is
available opt-in via `constantDegreeTransform`, which rewrites any graph into that shape by
splitting each vertex into a zero-weight cycle of "port" copies. The rewrite is
distance-preserving, so you run on the transformed graph and fold the result back onto your
original node IDs:

```javascript
import { BMSSP, constantDegreeTransform } from "bmssp";

const t = constantDegreeTransform([
  [0, 1, 50],
  [0, 2, 25],
  [1, 2, 75],
]);

const g = new BMSSP(t.edges); // every node now has in/out-degree ≤ 2
g.calculateShortestPaths(t.sourceCopy(0)); // start from a copy of original node 0
console.log(t.collapse(g.shortestPaths)); // Map(3) { 0 => 0, 1 => 50, 2 => 25 }
```

`collapse` maps the transformed graph's distances back to the original node IDs; `sourceCopy`
picks a valid start copy for an original node.

### Using the Docker image

The published image is a pre-configured Node environment with `bmssp` installed and the
[`examples/`](examples/) gallery bundled. Run the whole gallery — basic shortest paths,
Dijkstra-oracle validation, the constant-degree transform, and a larger generated grid:

```bash
docker run --rm sirivasv/bmssp-js:latest
```

Run a single bundled example instead:

```bash
docker run --rm sirivasv/bmssp-js:latest node examples/02-dijkstra-oracle.mjs
```

Or mount your own script and run it in the same environment (no local Node install needed):

```bash
docker run --rm -v "$PWD/mine.mjs:/bmssp-js/mine.mjs" sirivasv/bmssp-js:latest node mine.mjs
```

Other image versions are on [Docker Hub](https://hub.docker.com/r/sirivasv/bmssp-js/tags).

## Development

```bash
npm install
npm test              # Jest suite — every graph seeded, every failure reproducible (~7 s)
npm run lint          # Prettier + ESLint
npm run bench         # BMSSP-vs-Dijkstra head-to-head per graph shape, outputs verified
npm run bench:counts  # …plus comparison-count tables (the paper's own cost metric)
```

The benchmark harness runs the measured BMSSP-vs-Dijkstra head-to-head on every
`npm run bench` ([#170](https://github.com/Sirivasv/bmssp-js/issues/170)); methodology,
the deep 1.0.0 record (up to n = 4M) and the "when to use which" guidance live in
[benchmarks/HEAD-TO-HEAD.md](benchmarks/HEAD-TO-HEAD.md) and
[benchmarks/README.md](benchmarks/README.md).

The test suite's core contract: for every node, BMSSP's distances must equal the Dijkstra
oracle's. A seeded property/fuzz suite (`test/fuzz.test.mjs`) hammers that contract across
eight graph shapes (sparse/dense random, grids, chains, stars, DAGs, disconnected forests,
multigraphs), extreme weight regimes (all-zero, mixed zero/huge, exact floats), direct
multi-source bounded calls checked against per-source oracles, and seeded scale runs up to
150k nodes. It runs in `npm test` by default; crank the volume with the `FUZZ_ROUNDS`
multiplier (e.g. `FUZZ_ROUNDS=25 npm test -- test/fuzz.test.mjs` checks several thousand
graphs in a few seconds), and set `FUZZ_XL=1` for an additional 2-million-node round
(~30 s). Failures always report the seed that produced them.

## Roadmap

| Milestone | Theme | Status |
| --- | --- | --- |
| [`1.0.0`](https://github.com/Sirivasv/bmssp-js/milestones) | First end-to-end functional BMSSP (issues #40–#45) | ✅ done |
| `1.1.0` | Correctness hardening — fuzz tests, edge cases, tie-breaking, input validation, constant-degree transform, API docs | ✅ done |
| `1.2.0` | Performance & ergonomics — exact Lemma 3.3 asymptotics, BMSSP-vs-Dijkstra benchmarks, cliff investigation, relaxation micro-optimizations | ✅ done |
| `2.0.0` | API generalization — dense-index engine, typed/flexible inputs, public multi-source/bounded entry point, and public-API stabilization (migration note + locked surface) | ✅ done |

## Contributing (humans and AI agents welcome)

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) and the
[`help wanted` / `good first issue` labels](https://github.com/Sirivasv/bmssp-js/issues).

This repo is built to be **agent-friendly, model-agnostic**: everything a coding assistant
needs to contribute is checked in, so you can point **any AI running any model** at the
project and it can start working **without ever reading the source paper**. Have your agent
read [`.claude/CLAUDE.md`](.claude/CLAUDE.md) first — it lays out the full working lifecycle
as literal, follow-along checklists — backed by a self-contained knowledge base under
[`.claude/knowledge/`](.claude/knowledge/) (a verified transcription of the paper, the
current codebase map, the roadmap, and a glossary). Prefer to work by hand? The same
knowledge base reads as plain documentation.

## Other implementations on GitHub

<https://github.com/search?q=bmssp&type=repositories>

## License

[MPL-2.0](LICENSE)
