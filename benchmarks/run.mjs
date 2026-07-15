// Entry point: run every benchmark and print a markdown report to stdout.
//
//   node benchmarks/run.mjs            # human-readable report
//   node benchmarks/run.mjs > RESULTS.md
//
// All benchmarks are deterministic (seeded generators), so re-running on the
// same machine yields stable numbers.

import { runAdjacencyBenchmark } from "./adjacency.bench.mjs";
import { runScenarioBenchmark } from "./scenarios.bench.mjs";

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
out.push(section("Graph-shape scenarios (Dijkstra baseline)"));
out.push(scen.table);

const report = out.join("\n");
console.log(report);
