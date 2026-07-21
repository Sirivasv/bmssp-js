// Benchmark: graph-shape scenarios — the BMSSP-vs-Dijkstra head-to-head (#170).
//
// For each scenario we measure, algorithm time only (graph generation and
// adjacency construction sit outside every timed window):
//   - construct: building the BMSSP instance (includes the #45 adjacency map)
//   - dijkstra: one full run of the prebuilt-adjacency Dijkstra variant
//     (benchmarks/dijkstra-adj.mjs) — the fair baseline
//   - bmssp: one full BMSSP.calculateShortestPaths() run
//
// Both algorithms run from the same source over the same adjacency Map, and
// their outputs are verified identical every run (the `mismatches` column
// must read 0). Methodology and the measured 1.0.0 numbers:
// benchmarks/HEAD-TO-HEAD.md.

import { BMSSP } from "../src/bmssp.mjs";
import { dijkstraAdjacency } from "./dijkstra-adj.mjs";
import { SCENARIOS } from "./generators.mjs";
import {
  timeMany,
  markdownTable,
  fmt,
  countMismatches,
} from "./bench-util.mjs";

export function runScenarioBenchmark(scenarios = SCENARIOS, iters = 3) {
  const rows = [];
  for (const scenario of scenarios) {
    const graph = scenario.build();

    const construct = timeMany(() => new BMSSP(graph), { iters, warmup: 1 });

    const bmssp = new BMSSP(graph);
    const source = [...bmssp.nodeIDs][0];

    const dij = timeMany(
      () => dijkstraAdjacency(bmssp.adjacency, bmssp.nodeIDs, source),
      { iters, warmup: 1 },
    );
    const alg = timeMany(() => bmssp.calculateShortestPaths(source), {
      iters,
      warmup: 1,
    });

    // Verify: fresh run on each side, distances must agree node-by-node.
    const dijkstraDist = dijkstraAdjacency(
      bmssp.adjacency,
      bmssp.nodeIDs,
      source,
    );
    bmssp.calculateShortestPaths(source);
    const mismatches = countMismatches(
      dijkstraDist,
      bmssp.shortestPaths,
      bmssp.nodeIDs,
    );

    rows.push({
      scenario: scenario.name,
      nodes: bmssp.nodeIDs.size,
      edges: graph.length,
      "construct ms": fmt(construct.median),
      "dijkstra ms": fmt(dij.median),
      "bmssp ms": fmt(alg.median),
      ratio: `${(alg.median / dij.median).toFixed(2)}x`,
      mismatches,
      notes: scenario.blurb,
    });
  }

  return {
    table: markdownTable(
      [
        "scenario",
        "nodes",
        "edges",
        "construct ms",
        "dijkstra ms",
        "bmssp ms",
        "ratio",
        "mismatches",
        "notes",
      ],
      rows,
    ),
    rows,
  };
}
