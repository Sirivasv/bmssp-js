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

> **Honest note:** the paper's win is asymptotic, and this repo optimizes for correctness
> and readability, not raw speed. Measured head-to-head (algorithm time only, graph
> loading excluded — see [benchmarks/HEAD-TO-HEAD.md](benchmarks/HEAD-TO-HEAD.md)):
> Dijkstra still wins on wall-clock at every practical size, though the gap narrows as
> sparse graphs grow (2.5× at 50k nodes → 1.57× at 2M). But in the paper's own metric —
> **comparisons between path lengths** — BMSSP does **fewer comparisons than Dijkstra
> from about n = 1M on sparse graphs** (0.91× at n = 2M), and the advantage grows with
> size: the "sorting barrier" is measurably broken; what remains is JS constant factors.
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
npm test          # Jest suite — every graph seeded, every failure reproducible (~3 s)
npm run lint      # Prettier + ESLint
npm run bench     # seeded micro-benchmarks (see benchmarks/README.md)
```

The measured BMSSP-vs-Dijkstra head-to-head — wall-clock and comparison counts, with
methodology — lives in [benchmarks/HEAD-TO-HEAD.md](benchmarks/HEAD-TO-HEAD.md)
([#170](https://github.com/Sirivasv/bmssp-js/issues/170) tracks harness integration).

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
| `1.1.0` | Correctness hardening — fuzz tests, edge cases, tie-breaking, input validation | 🔨 current focus |
| `1.2.0` | Performance & ergonomics — exact Lemma 3.3 asymptotics, path reconstruction, BMSSP-vs-Dijkstra benchmarks | 🔨 in progress |
| `2.0.0` | API generalization — public multi-source/bounded entry point, flexible inputs | planned |

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
