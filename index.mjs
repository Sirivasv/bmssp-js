// Public API of the `bmssp` package (ESM-only). Four exports: the BMSSP
// class, the reference `dijkstra`, the opt-in `constantDegreeTransform`, and
// the `Graph` input builder. Algorithm-internal modules (the block list, the
// indexed heap, BaseCase, FindPivots, the tie-break helpers) are deliberately
// NOT re-exported — they are implementation details of the recursion, not
// supported public API.

/**
 * BMSSP — the paper's Algorithm 3 behind a small class API.
 *
 * `new BMSSP(graph)` accepts any of the #172 input shapes: an array of
 * `[from, to, weight]` edges, an adjacency `Map`/object
 * (`{ from: [[to, weight], ...] }`), or a `Graph` builder instance. Node IDs
 * must be finite numbers and weights finite and non-negative; an empty graph
 * is valid and malformed edges throw with the offending index.
 * `calculateShortestPaths(source)` computes canonical distances into the
 * `shortestPaths` Map (`Infinity` for unreachable nodes), and
 * `reconstructPath(target)` returns the canonical shortest path as an
 * array of node IDs. Full JSDoc lives on the class in `src/bmssp.mjs`.
 */
export { BMSSP } from "./src/bmssp.mjs";

/**
 * Graph — a small mutable input builder (#172). Declare vertices (including
 * isolated ones via `addVertex`) and directed weighted edges (`addEdge`),
 * then pass the instance to `new BMSSP(graph)`. Mutators chain
 * (`new Graph().addEdge(0, 1, 50).addVertex(9)`). See `src/graph.mjs`.
 */
export { Graph } from "./src/graph.mjs";

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
