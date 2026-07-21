// Benchmark: comparison counts — the sorting barrier, measured (#170).
//
// The paper's cost model counts comparisons between path lengths, not
// wall-clock time. This mode runs each case once per algorithm and reports
// how many distance comparisons each side performed:
//   - bmssp: every compareKeys call (src/tieBreak.mjs counter) — the heap,
//     the BlockList and the algorithm modules all funnel through it
//   - dijkstra: every numeric distance comparison in the prebuilt-adjacency
//     variant (benchmarks/dijkstra-adj.mjs counter)
//
// Counts are deterministic (seeded graphs), so a single run per side is
// exact. On sparse graphs the bmssp/dijkstra ratio falls with n and crosses
// below 1.0 between n = 200k and n = 1M — the measured form of the paper's
// asymptotic claim (see benchmarks/HEAD-TO-HEAD.md for the 1.0.0 record).

import { BMSSP } from "../src/bmssp.mjs";
import { resetComparisonCount, getComparisonCount } from "../src/tieBreak.mjs";
import {
  dijkstraAdjacency,
  resetDijkstraComparisonCount,
  getDijkstraComparisonCount,
} from "./dijkstra-adj.mjs";
import { sparseRandom, grid } from "./generators.mjs";
import { markdownTable, countMismatches } from "./bench-util.mjs";

// Sized to reproduce the crossover table in a couple of tens of seconds:
// sparse d3 at 50k / 200k / 1M brackets the crossover; the grid shows a
// shape where BMSSP stays behind. (The 1.0.0 record also has sparse 2M at
// 0.91x — left out here to keep the opt-in mode reasonably fast.)
export const COUNT_CASES = [
  {
    name: "sparse d3 n=50k",
    build: () => sparseRandom(50_000, 3, 11),
  },
  {
    name: "sparse d3 n=200k",
    build: () => sparseRandom(200_000, 3, 21),
  },
  {
    name: "sparse d3 n=1M",
    build: () => sparseRandom(1_000_000, 3, 22),
  },
  {
    name: "grid 700x700",
    build: () => grid(700, 23),
  },
];

export function runComparisonCountBenchmark(cases = COUNT_CASES) {
  const rows = [];
  for (const testCase of cases) {
    const graph = testCase.build();
    const bmssp = new BMSSP(graph);
    const source = [...bmssp.nodeIDs][0];

    resetDijkstraComparisonCount();
    const dijkstraDist = dijkstraAdjacency(
      bmssp.adjacency,
      bmssp.nodeIDs,
      source,
    );
    const dijkstraComparisons = getDijkstraComparisonCount();

    resetComparisonCount();
    bmssp.calculateShortestPaths(source);
    const bmsspComparisons = getComparisonCount();

    const mismatches = countMismatches(
      dijkstraDist,
      bmssp.shortestPaths,
      bmssp.nodeIDs,
    );

    rows.push({
      case: testCase.name,
      nodes: bmssp.nodeIDs.size,
      edges: graph.length,
      "dijkstra cmps": dijkstraComparisons.toLocaleString("en-US"),
      "bmssp cmps": bmsspComparisons.toLocaleString("en-US"),
      ratio: `${(bmsspComparisons / dijkstraComparisons).toFixed(2)}x`,
      mismatches,
    });
  }

  return {
    table: markdownTable(
      [
        "case",
        "nodes",
        "edges",
        "dijkstra cmps",
        "bmssp cmps",
        "ratio",
        "mismatches",
      ],
      rows,
    ),
    rows,
  };
}
