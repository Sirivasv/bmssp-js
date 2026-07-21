// Example 1 — basic shortest paths and path reconstruction.
//
// Standalone: after `npm install bmssp` run `node 01-basic.mjs`.
// The `bmssp` package is ESM-only; graphs are arrays of `[from, to, weight]`
// edges with finite numeric node IDs and finite, non-negative weights.

import { BMSSP } from "bmssp";

export function run() {
  // A tiny weighted digraph. The direct 0->2 edge (25) beats the
  // two-hop 0->1->2 route (50 + 75 = 125).
  const graph = new BMSSP([
    [0, 1, 50],
    [1, 2, 75],
    [0, 2, 25],
    [2, 3, 10],
  ]);

  graph.calculateShortestPaths(0);

  console.log("Shortest distances from node 0:");
  for (const [node, dist] of graph.shortestPaths) {
    console.log(`  0 -> ${node}: ${dist}`);
  }

  console.log("\nReconstructed paths:");
  for (const node of graph.nodeIDs) {
    const path = graph.reconstructPath(node);
    const shown = path.length ? path.join(" -> ") : "(unreachable)";
    console.log(`  to ${node}: ${shown}`);
  }
}

import { fileURLToPath } from "node:url";
if (process.argv[1] === fileURLToPath(import.meta.url)) run();
