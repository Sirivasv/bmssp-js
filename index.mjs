// Public API of the `bmssp` package (ESM-only). Exactly three exports:
// the BMSSP class, the reference `dijkstra`, and the opt-in
// `constantDegreeTransform`. Algorithm-internal modules (the block list,
// the indexed heap, BaseCase, FindPivots, the tie-break helpers) are
// deliberately NOT re-exported — they are implementation details of the
// recursion, not supported public API.

/**
 * BMSSP — the paper's Algorithm 3 behind a small class API.
 *
 * `new BMSSP(graph)` takes an array of `[from, to, weight]` edges with
 * finite numeric node IDs and finite, non-negative weights (an empty array
 * is valid; malformed edges throw with the offending index).
 * `calculateShortestPaths(source)` computes canonical distances into the
 * `shortestPaths` Map (`Infinity` for unreachable nodes), and
 * `reconstructPath(target)` returns the canonical shortest path as an
 * array of node IDs. Full JSDoc lives on the class in `src/bmssp.mjs`.
 */
export { BMSSP } from "./src/bmssp.mjs";

/**
 * Reference Dijkstra implementation — the oracle the BMSSP test suite is
 * validated against, exported for comparison and independent checking.
 *
 * `dijkstra(graph, nodeIDs, source)` returns a `Map` from node ID to
 * shortest distance (`Infinity` if unreachable). See `src/dijkstra.mjs`.
 */
export { dijkstra } from "./src/dijkstra.mjs";

/**
 * Opt-in constant-degree transform — rewrites any graph so every vertex
 * has in-degree and out-degree <= 2 (the paper's preliminary assumption)
 * by splitting each vertex into a zero-weight cycle of port copies. The
 * rewrite is distance-preserving and never required for correctness.
 *
 * `constantDegreeTransform(graph)` returns
 * `{ edges, copiesOf, originalOf, sourceCopy, collapse }`; run BMSSP on
 * `edges` from `sourceCopy(source)` and `collapse()` the resulting
 * distances back onto original node IDs. See `src/constantDegree.mjs`.
 */
export { constantDegreeTransform } from "./src/constantDegree.mjs";
