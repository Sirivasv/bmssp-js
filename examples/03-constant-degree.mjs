// Example 3 — the opt-in constant-degree transform.
//
// The paper's O(m·log^(2/3) n) bound assumes every vertex has in-degree and
// out-degree <= 2. That preprocessing is NOT required for correctness here,
// but it is available: `constantDegreeTransform` rewrites any graph into that
// shape by splitting each vertex into a zero-weight cycle of "port" copies.
// The rewrite is distance-preserving, so you run on the transformed graph and
// fold the result back onto your original node IDs.

import { BMSSP, constantDegreeTransform } from "bmssp";

export function run() {
  // Node 0 has out-degree 3 — above the paper's degree-2 assumption.
  const original = [
    [0, 1, 50],
    [0, 2, 25],
    [0, 3, 40],
    [1, 2, 75],
    [2, 3, 10],
  ];

  const t = constantDegreeTransform(original);

  console.log(
    `Original: ${new Set(original.flatMap((e) => [e[0], e[1]])).size} nodes, ${original.length} edges`,
  );
  console.log(
    `Transformed: every vertex now has in/out-degree <= 2 (${t.edges.length} edges after splitting).`,
  );

  const g = new BMSSP(t.edges);
  g.calculateShortestPaths(t.sourceCopy(0)); // start from a copy of node 0

  // `collapse` folds transformed distances back onto original node IDs.
  const distances = t.collapse(g.shortestPaths);

  console.log("\nShortest distances from original node 0:");
  for (const [node, dist] of [...distances].sort((a, b) => a[0] - b[0])) {
    console.log(`  0 -> ${node}: ${dist}`);
  }
}

import { fileURLToPath } from "node:url";
if (process.argv[1] === fileURLToPath(import.meta.url)) run();
