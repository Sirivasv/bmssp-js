// Shared test helpers for the #212 direct-CSR world.
//
// Since #212 a BMSSP instance no longer exposes `this.graph` (a deep-copied
// edge array) or `this.adjacency` (a Map) — the CSR engine is the single
// source of truth. Tests that need those shapes (mostly to feed the
// `dijkstra` / `dijkstraAdjacency` oracles) rebuild them from the public
// `getEdges()` view, which materializes a node's outgoing edges from the CSR.

/**
 * Rebuild a `[from, to, weight][]` edge array from a BMSSP instance via its
 * public `getEdges()` view — equivalent, as a multiset of edges, to the old
 * public `this.graph`. Feed it to the `dijkstra(edges, nodeIDs, source)` oracle.
 *
 * @param {import("../src/bmssp.mjs").BMSSP} instance
 * @returns {Array<[number, number, number]>}
 */
export function edgesOf(instance) {
  const edges = [];
  for (const from of instance.nodeIDs) {
    for (const [to, weight] of instance.getEdges(from)) {
      edges.push([from, to, weight]);
    }
  }
  return edges;
}

// The Map-shaped equivalent for the benchmark oracle (`dijkstraAdjacency`)
// lives in `benchmarks/bench-util.mjs` as `adjacencyOf`, since that is where
// the benchmark harness (and its test) consumes it.
