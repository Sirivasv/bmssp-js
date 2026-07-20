# Test Suite

Jest tests for the BMSSP (**B**ounded **M**ulti-**S**ource **S**hortest **P**ath)
implementation. The core contract everywhere: **for every node, BMSSP's distance must
equal the Dijkstra oracle's** (`src/dijkstra.mjs`).

## Principles

- **Everything is seeded.** No test uses unseeded randomness; every generated graph comes
  from a fixed seed or a derived one that is printed in the failure message, so any red
  run is reproducible by pinning that seed.
- **No data files.** Graphs are generated on the fly by the seeded builders in
  [`../benchmarks/generators.mjs`](../benchmarks/generators.mjs) (plus a few local
  generators in `fuzz.test.mjs`). The suite runs in a few seconds.

## Files

| File | Covers |
| --- | --- |
| `main.test.mjs` | `BMSSP` class contracts (constructor, `nodeIDs`, adjacency, `shortestPaths`, error handling) + full-map BMSSP-vs-Dijkstra equality on a seeded 10k-node sparse graph |
| `pathReconstruction.test.mjs` | Public `reconstructPath` API: source-to-target paths vs. a Dijkstra oracle, unreachable nodes, source switching, and target validation |
| `bmssp.test.mjs` | Algorithm 3 recursion: parameter derivation, hand-built graphs, degenerate ties, the Lemma 3.1 bounded-call contract, seeded stress |
| `fuzz.test.mjs` | High-volume property/fuzz suite (#161): 8 graph shapes × extreme weight regimes × multi-source bounded calls vs. per-source oracles, plus seeded scale runs (150k-node sparse, 300×300 grid, opt-in 2M) |
| `edgeCases.test.mjs` | Deterministic disconnection fixtures (#162): isolated/sink/self-loop-only sources, single-node and multi-chain components, wrong-direction bridges, tiny-vs-giant components, source switching across components — each vs. a hand-computed map and the oracle |
| `tieBreak.test.mjs` | Deterministic tie-breaking (#163): composite-key order, canonical relaxation, edge-order-permutation invariance (full runs and bounded partial calls), strict Lemma 3.1 via `boundKey`, hops/preds vs. a lexicographic Dijkstra oracle |
| `findPivots.test.mjs` | Algorithm 1 (`FindPivots`) contracts incl. seeded oracle stress |
| `baseCase.test.mjs` | Algorithm 2 (`BaseCase`) bounded mini-Dijkstra contracts |
| `blockList.test.mjs` | Lemma 3.3 block-based partial-sort structure `D` |
| `heap.test.mjs` | Indexed binary min-heap used by `BaseCase` |

## Running

```bash
npm test                                        # full suite + coverage (~3 s)
FUZZ_ROUNDS=25 npm test -- test/fuzz.test.mjs   # multiply every fuzz round count
FUZZ_XL=1 npm test -- test/fuzz.test.mjs        # add the 2M-node scale round (~30 s)
```

## Contributing to tests

1. Seed everything; put the seed in the failure message.
2. Include both positive and negative cases.
3. New graph shapes belong in `benchmarks/generators.mjs` if benchmarks can reuse them,
   or as local generators in `fuzz.test.mjs` if not.
4. Ensure `npm run lint` passes.
