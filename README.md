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

The project is built piece by piece against the paper, with every building block shipped,
tested, and released individually. Current focus: milestone
[`1.0.0` — first end-to-end functional BMSSP](https://github.com/Sirivasv/bmssp-js/milestones).

| Building block (paper) | Where | Status |
| --- | --- | --- |
| Reference Dijkstra oracle (ground truth for tests) | `src/dijkstra.mjs` | ✅ done |
| O(1) adjacency map for edge relaxation ([#45](https://github.com/Sirivasv/bmssp-js/issues/45)) | `BMSSP` constructor | ✅ done |
| Lemma 3.3 block-based partial-sort structure `D` ([#42](https://github.com/Sirivasv/bmssp-js/issues/42)) | `src/blockList.mjs` | ✅ done |
| Indexed binary min-heap ([#41](https://github.com/Sirivasv/bmssp-js/issues/41)) | `src/heap.mjs` | ✅ done |
| `BaseCase(B, S)` — Algorithm 2, bounded mini-Dijkstra ([#40](https://github.com/Sirivasv/bmssp-js/issues/40)) | `src/baseCase.mjs` | ✅ done |
| `FindPivots(B, S)` — Algorithm 1, frontier shrinking ([#44](https://github.com/Sirivasv/bmssp-js/issues/44)) | `src/findPivots.mjs` | ✅ done |
| `BMSSP(l, B, S)` — Algorithm 3, the main recursion ([#43](https://github.com/Sirivasv/bmssp-js/issues/43)) | — | 🔨 next up — the last piece |

> **Honest note:** until [#43](https://github.com/Sirivasv/bmssp-js/issues/43) lands,
> `calculateShortestPaths()` computes distances with the reference Dijkstra implementation.
> The shipped BMSSP building blocks (block list, heap, base case, pivot finding) are fully
> tested but not yet wired into the public entry point.

## How it works (in two ideas)

1. **Shrink the frontier with pivots.** Instead of keeping every frontier vertex in a
   priority queue like Dijkstra, run `k` rounds of Bellman-Ford-style relaxation and recurse
   only on the "pivots" — roots of large shortest-path trees. Only ~1/k of the frontier
   needs the expensive treatment.
2. **Partial sorting instead of a heap.** A block-based structure keeps batches of vertices
   ordered *between* blocks but unsorted *within* them — enough to repeatedly pull the next
   closest batch without paying the Θ(log n)-per-vertex "sorting barrier."

The asymptotic win is theoretical (the crossover point is astronomically large); this repo
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

The test suite's core contract: for every node, BMSSP's distances must equal the Dijkstra
oracle's — including on `test/roadNet-CA.txt`, a real road network from SNAP.

## Roadmap

| Milestone | Theme |
| --- | --- |
| [`1.0.0`](https://github.com/Sirivasv/bmssp-js/milestones) | First end-to-end functional BMSSP (issues #40–#45) |
| `1.1.0` | Correctness hardening — fuzz tests, edge cases, tie-breaking, input validation |
| `1.2.0` | Performance & ergonomics — exact Lemma 3.3 asymptotics, path reconstruction, BMSSP-vs-Dijkstra benchmarks |
| `2.0.0` | API generalization — public multi-source/bounded entry point, flexible inputs |

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) and the
[`help wanted` / `good first issue` labels](https://github.com/Sirivasv/bmssp-js/issues).

## Other implementations on GitHub

<https://github.com/search?q=bmssp&type=repositories>

## License

[MPL-2.0](LICENSE)
