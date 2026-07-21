// Entry point: run every benchmark and print a markdown report to stdout.
//
//   node benchmarks/run.mjs            # human-readable report
//   node benchmarks/run.mjs --counts   # also run the comparison-count mode
//   node benchmarks/run.mjs > RESULTS.md
//
// All benchmarks are deterministic (seeded generators), so re-running on the
// same machine yields stable numbers; the --counts tables are exact and
// machine-independent.

import { runAdjacencyBenchmark } from "./adjacency.bench.mjs";
import { runScenarioBenchmark } from "./scenarios.bench.mjs";
import { runComparisonCountBenchmark } from "./compare-counts.bench.mjs";

const withCounts = process.argv.includes("--counts");

function section(title) {
  return `\n## ${title}\n`;
}

const out = [];
out.push("# bmssp-js benchmark run");
out.push(
  `\n_Generated ${new Date().toISOString()} · node ${process.version} · ${process.platform}/${process.arch}_`,
);

const adj = runAdjacencyBenchmark();
out.push(section("Adjacency map vs linear scan (#45)"));
out.push(
  `Graph: ${adj.params.n} nodes, ${adj.params.edges} edges · ${adj.params.lookups} random per-node edge lookups.\n`,
);
out.push(adj.table);
out.push(
  `\n**Speedup: ${adj.speedup.toFixed(1)}x** faster per-node lookups with the map.`,
);

const scen = runScenarioBenchmark();
out.push(section("Graph-shape scenarios — BMSSP vs Dijkstra (#170)"));
out.push(
  "Algorithm time only: both sides consume the same prebuilt adjacency Map;" +
    " `mismatches` must read 0 (outputs verified node-by-node every run).\n",
);
out.push(scen.table);

if (withCounts) {
  const counts = runComparisonCountBenchmark();
  out.push(section("Comparison counts — the sorting barrier, measured (#170)"));
  out.push(
    "Comparisons between path lengths (the paper's cost metric), one exact" +
      " run per side. On sparse graphs the ratio falls with n and is" +
      " already below 1.0 at n = 50k (since #167's selection-based" +
      " BlockList; it was ~n = 1M before).\n",
  );
  out.push(counts.table);
}

const report = out.join("\n");
console.log(report);
