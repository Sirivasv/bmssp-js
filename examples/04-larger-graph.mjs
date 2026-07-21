// Example 4 — a larger, programmatically generated graph.
//
// Builds an N x N grid of nodes wired to their right/down neighbours with
// deterministic pseudo-random weights, then runs BMSSP from a corner and
// cross-checks a few nodes against the Dijkstra oracle. Shows the API on
// something bigger than a hand-drawn example, with a rough timing.

import { BMSSP, dijkstra } from "bmssp";

// Deterministic weight generator so the run is reproducible.
function makeWeight(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return 1 + (s % 100); // 1..100
  };
}

function buildGrid(n) {
  const nextWeight = makeWeight(12345);
  const edges = [];
  const id = (r, c) => r * n + c;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (c + 1 < n) edges.push([id(r, c), id(r, c + 1), nextWeight()]);
      if (r + 1 < n) edges.push([id(r, c), id(r + 1, c), nextWeight()]);
    }
  }
  return edges;
}

export function run() {
  const n = 40; // 1,600 nodes
  const edges = buildGrid(n);

  const graph = new BMSSP(edges);

  const t0 = performance.now();
  graph.calculateShortestPaths(0);
  const ms = performance.now() - t0;

  const corner = n * n - 1; // bottom-right node
  console.log(
    `Grid ${n}x${n}: ${graph.nodeIDs.size} nodes, ${edges.length} edges.`,
  );
  console.log(`BMSSP run: ${ms.toFixed(2)} ms.`);
  console.log(
    `Distance from top-left (0) to bottom-right (${corner}): ${graph.shortestPaths.get(corner)}`,
  );
  console.log(
    `Path length (hops) to bottom-right: ${graph.reconstructPath(corner).length - 1}`,
  );

  // Spot-check against the oracle on a handful of nodes.
  const oracle = dijkstra(graph.graph, graph.nodeIDs, 0);
  const sample = [corner, Math.floor((n * n) / 2), n - 1, n * (n - 1)];
  const allMatch = sample.every(
    (node) => graph.shortestPaths.get(node) === oracle.get(node),
  );
  console.log(
    `\n${allMatch ? "✓ Sampled nodes all match the Dijkstra oracle." : "✗ MISMATCH — this should never happen."}`,
  );
}

import { fileURLToPath } from "node:url";
if (process.argv[1] === fileURLToPath(import.meta.url)) run();
