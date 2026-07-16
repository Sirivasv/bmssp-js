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
the bounded base case), validated node-by-node against a Dijkstra oracle, including on a
real 2-million-node road network. The project was built piece by piece against the paper,
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

> **Honest note:** the paper's win is asymptotic, and this repo optimizes for correctness
> and readability, not raw speed. Measured head-to-head (algorithm time only, graph
> loading excluded — see [benchmarks/HEAD-TO-HEAD.md](benchmarks/HEAD-TO-HEAD.md)):
> Dijkstra still wins on wall-clock at every practical size, though the gap narrows as
> sparse graphs grow (2.5× at 50k nodes → 1.57× at 2M). But in the paper's own metric —
> **comparisons between path lengths** — BMSSP does **fewer comparisons than Dijkstra
> from about n = 1M on sparse graphs** (0.91× at n = 2M), and the advantage grows with
> size: the "sorting barrier" is measurably broken; what remains is JS constant factors.
> Where inputs violate the paper's distinct-path-lengths assumption (e.g. zero-weight
> edges), documented tie guards keep the results correct
> ([#163](https://github.com/Sirivasv/bmssp-js/issues/163) tracks a principled tie-break).

## How it works (in two ideas)

1. **Shrink the frontier with pivots.** Instead of keeping every frontier vertex in a
   priority queue like Dijkstra, run `k` rounds of Bellman-Ford-style relaxation and recurse
   only on the "pivots" — roots of large shortest-path trees. Only ~1/k of the frontier
   needs the expensive treatment.
2. **Partial sorting instead of a heap.** A block-based structure keeps batches of vertices
   ordered *between* blocks but unsorted *within* them — enough to repeatedly pull the next
   closest batch without paying the Θ(log n)-per-vertex "sorting barrier."

The wall-clock crossover point is astronomically large, but the asymptotics are real: in
measured comparison counts this implementation already beats Dijkstra past ~1M nodes on
sparse graphs ([benchmarks/HEAD-TO-HEAD.md](benchmarks/HEAD-TO-HEAD.md)). This repo
optimizes for a **correct, readable, well-tested** implementation, validated line-by-line
against a Dijkstra oracle — not for raw speed.

## Installation

```bash
npm install bmssp
```

## Usage

The package is ESM-only (`.mjs`). Graphs are arrays of `[from, to, weight]` edges with
numeric node IDs and non-negative weights:

```javascript
import { BMSSP } from "bmssp";

const graph = new BMSSP([
  [0, 1, 50],
  [1, 2, 75],
  [0, 2, 25],
]);

graph.calculateShortestPaths(0);
console.log(graph.shortestPaths); // Map(3) { 0 => 0, 1 => 50, 2 => 25 }
```

A reference `dijkstra` implementation is also exported. See the `examples/` directory for
more.

### Using the Docker image

Run the bundled example:

```bash
docker run -it sirivasv/bmssp-js:latest
```

Or run your own tests in a pre-configured environment (replace `folder-mytest/` with your
tests folder and `index.mjs` with your test file):

```bash
docker run -it -v ./folder-mytest/:/bmssp-js/folder-mytest/ sirivasv/bmssp-js:latest node /bmssp-js/folder-mytest/index.mjs
```

Other image versions are on [Docker Hub](https://hub.docker.com/r/sirivasv/bmssp-js/tags).

## Development

```bash
npm install
npm test          # Jest suite, incl. BMSSP-vs-Dijkstra equivalence on a real road network
npm run lint      # Prettier + ESLint
npm run bench     # seeded micro-benchmarks (see benchmarks/README.md)
```

The measured BMSSP-vs-Dijkstra head-to-head — wall-clock and comparison counts, with
methodology — lives in [benchmarks/HEAD-TO-HEAD.md](benchmarks/HEAD-TO-HEAD.md)
([#170](https://github.com/Sirivasv/bmssp-js/issues/170) tracks harness integration).

The test suite's core contract: for every node, BMSSP's distances must equal the Dijkstra
oracle's — including on `test/roadNet-CA.txt`, a real road network from SNAP. A seeded
property/fuzz suite (`test/fuzz.test.mjs`) hammers that contract across eight graph shapes
(sparse/dense random, grids, chains, stars, DAGs, disconnected forests, multigraphs),
extreme weight regimes (all-zero, mixed zero/huge, exact floats), and direct multi-source
bounded calls checked against per-source oracles. It runs in `npm test` by default; crank
the volume with the `FUZZ_ROUNDS` multiplier (e.g. `FUZZ_ROUNDS=25 npm test -- test/fuzz.test.mjs`
checks several thousand graphs in a few seconds). Failures always report the seed that
produced them.

## Roadmap

| Milestone | Theme | Status |
| --- | --- | --- |
| [`1.0.0`](https://github.com/Sirivasv/bmssp-js/milestones) | First end-to-end functional BMSSP (issues #40–#45) | ✅ done |
| `1.1.0` | Correctness hardening — fuzz tests, edge cases, tie-breaking, input validation | 🔨 current focus |
| `1.2.0` | Performance & ergonomics — exact Lemma 3.3 asymptotics, path reconstruction, BMSSP-vs-Dijkstra benchmarks | planned |
| `2.0.0` | API generalization — public multi-source/bounded entry point, flexible inputs | planned |

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) and the
[`help wanted` / `good first issue` labels](https://github.com/Sirivasv/bmssp-js/issues).

## Other implementations on GitHub

<https://github.com/search?q=bmssp&type=repositories>

## License

[MPL-2.0](LICENSE)
