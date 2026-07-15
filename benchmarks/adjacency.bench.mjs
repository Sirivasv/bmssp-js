// Benchmark: why issue #45 (the adjacency map) matters.
//
// Before #45, finding a node's outgoing edges meant scanning the whole edge
// array — O(m) per lookup. With the adjacency map it is a single O(1) Map.get
// returning the node's edge list. This benchmark quantifies the gap by doing
// K random per-node edge lookups both ways.

import { BMSSP } from "../src/bmssp.mjs";
import { sparseRandom, makeRng } from "./generators.mjs";
import { timeMany, markdownTable, fmt } from "./bench-util.mjs";

// Linear-scan lookup: what a naive implementation without #45 would do.
function scanEdges(graph, node) {
  const out = [];
  for (let i = 0; i < graph.length; i++) {
    if (graph[i][0] === node) out.push(graph[i]);
  }
  return out;
}

export function runAdjacencyBenchmark({
  n = 20_000,
  degree = 4,
  lookups = 5_000,
} = {}) {
  const graph = sparseRandom(n, degree, 7);
  const bmssp = new BMSSP(graph);
  const nodes = [...bmssp.nodeIDs];
  const rng = makeRng(99);

  // Precompute the same random lookup sequence for both methods.
  const queries = [];
  for (let i = 0; i < lookups; i++) {
    queries.push(nodes[Math.floor(rng() * nodes.length)]);
  }

  let scanSink = 0;
  const scan = timeMany(
    () => {
      for (const q of queries) scanSink += scanEdges(graph, q).length;
    },
    { iters: 5, warmup: 1 },
  );

  let mapSink = 0;
  const map = timeMany(
    () => {
      for (const q of queries) mapSink += bmssp.getEdges(q).length;
    },
    { iters: 5, warmup: 1 },
  );

  // Guard against the JIT eliminating the loops as dead code.
  if (scanSink !== mapSink) {
    throw new Error(`lookup mismatch: scan=${scanSink} map=${mapSink}`);
  }

  const rows = [
    {
      method: "linear scan (pre-#45)",
      "median ms": fmt(scan.median),
      "per lookup µs": fmt((scan.median / lookups) * 1000),
    },
    {
      method: "adjacency map (#45)",
      "median ms": fmt(map.median),
      "per lookup µs": fmt((map.median / lookups) * 1000),
    },
  ];

  const speedup = scan.median / map.median;
  return {
    params: { n, degree, edges: graph.length, lookups },
    table: markdownTable(["method", "median ms", "per lookup µs"], rows),
    speedup,
  };
}
