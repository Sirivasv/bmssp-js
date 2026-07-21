// Example 5 — flexible graph inputs (#172).
//
// Standalone: after `npm install bmssp` run `node 05-flexible-inputs.mjs`.
// The BMSSP constructor accepts four input shapes, all equivalent: an edge
// array, an adjacency `Map`, a plain adjacency object, and the `Graph`
// builder. The builder is also the only way to declare an ISOLATED vertex
// (one with no incident edges), which a bare edge list can't express.

import { BMSSP, Graph } from "bmssp";

export function run() {
  // The same logical graph, four ways.
  const edgeArray = [
    [0, 1, 7],
    [0, 2, 9],
    [1, 2, 10],
    [2, 3, 11],
  ];

  const asMap = new Map([
    [
      0,
      [
        [1, 7],
        [2, 9],
      ],
    ],
    [1, [[2, 10]]],
    [2, [[3, 11]]],
  ]);

  // Plain-object keys are strings in JS, so they are coerced to numbers.
  const asObject = {
    0: [
      [1, 7],
      [2, 9],
    ],
    1: [[2, 10]],
    2: [[3, 11]],
  };

  const asBuilder = new Graph()
    .addEdge(0, 1, 7)
    .addEdge(0, 2, 9)
    .addEdge(1, 2, 10)
    .addEdge(2, 3, 11);

  console.log(
    "Distances from node 0 — identical across all four input shapes:",
  );
  for (const [label, input] of [
    ["edge array", edgeArray],
    ["adjacency Map", asMap],
    ["adjacency object", asObject],
    ["Graph builder", asBuilder],
  ]) {
    const g = new BMSSP(input);
    g.calculateShortestPaths(0);
    const row = [...g.nodeIDs]
      .sort((a, b) => a - b)
      .map((n) => `${n}:${g.shortestPaths.get(n)}`)
      .join("  ");
    console.log(`  ${label.padEnd(18)} ${row}`);
  }

  // Isolated vertex: declared via addVertex, present but unreachable.
  const withIsolated = new Graph().addEdge(0, 1, 7).addVertex(42);
  const g = new BMSSP(withIsolated);
  g.calculateShortestPaths(0);
  console.log(
    `\nIsolated vertex 42 is present but unreachable: ` +
      `${g.shortestPaths.get(42)}`,
  );
}

import { fileURLToPath } from "node:url";
if (process.argv[1] === fileURLToPath(import.meta.url)) run();
