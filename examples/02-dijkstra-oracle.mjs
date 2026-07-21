// Example 2 — validate BMSSP against the exported Dijkstra oracle.
//
// The package also exports a reference `dijkstra`, the ground truth the
// BMSSP test suite is checked against. Its signature is
// `dijkstra(edges, nodeIDs, source)` and it returns a Map of distances.
// Here we run both on the same graph and confirm every node matches.

import { BMSSP, dijkstra } from "bmssp";

export function run() {
  const edges = [
    [0, 1, 7],
    [0, 2, 9],
    [0, 5, 14],
    [1, 2, 10],
    [1, 3, 15],
    [2, 3, 11],
    [2, 5, 2],
    [3, 4, 6],
    [5, 4, 9],
  ];
  const source = 0;

  const graph = new BMSSP(edges);
  graph.calculateShortestPaths(source);

  // The oracle takes the raw edge list and the node-ID set (both exposed
  // on the BMSSP instance) plus the source.
  const oracle = dijkstra(graph.graph, graph.nodeIDs, source);

  console.log("node │ BMSSP │ Dijkstra │ match");
  console.log("─────┼───────┼──────────┼──────");
  let allMatch = true;
  for (const node of [...graph.nodeIDs].sort((a, b) => a - b)) {
    const b = graph.shortestPaths.get(node);
    const d = oracle.get(node);
    const ok = b === d;
    allMatch &&= ok;
    console.log(
      `${String(node).padStart(4)} │ ${String(b).padStart(5)} │ ${String(d).padStart(8)} │ ${ok ? "✓" : "✗"}`,
    );
  }

  console.log(
    `\n${allMatch ? "✓ BMSSP matches the Dijkstra oracle on every node." : "✗ MISMATCH — this should never happen."}`,
  );
}

import { fileURLToPath } from "node:url";
if (process.argv[1] === fileURLToPath(import.meta.url)) run();
