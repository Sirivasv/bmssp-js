// Benchmark: graph-shape scenarios.
//
// For each scenario we measure:
//   - construct: building the BMSSP instance (includes the #45 adjacency map)
//   - dijkstra: one full single-source shortest-path run from node 0
//
// This is the Dijkstra baseline column of the head-to-head. The real BMSSP
// recursion landed in 1.0.0 (#43); adding an algorithm-only bmssp column (and
// an optional comparison-count mode) is tracked in #170. Measured results so
// far: benchmarks/HEAD-TO-HEAD.md.

import { BMSSP } from "../src/bmssp.mjs";
import { dijkstra } from "../src/dijkstra.mjs";
import { SCENARIOS } from "./generators.mjs";
import { timeMany, markdownTable, fmt } from "./bench-util.mjs";

export function runScenarioBenchmark() {
  const rows = [];
  for (const scenario of SCENARIOS) {
    const graph = scenario.build();

    const construct = timeMany(() => new BMSSP(graph), { iters: 3, warmup: 1 });

    const bmssp = new BMSSP(graph);
    const source = [...bmssp.nodeIDs][0];
    const dij = timeMany(() => dijkstra(graph, bmssp.nodeIDs, source), {
      iters: 3,
      warmup: 1,
    });

    rows.push({
      scenario: scenario.name,
      nodes: bmssp.nodeIDs.size,
      edges: graph.length,
      "construct ms": fmt(construct.median),
      "dijkstra ms": fmt(dij.median),
      notes: scenario.blurb,
    });
  }

  return {
    table: markdownTable(
      ["scenario", "nodes", "edges", "construct ms", "dijkstra ms", "notes"],
      rows,
    ),
    rows,
  };
}
