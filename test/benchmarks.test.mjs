import { describe, test, expect } from "@jest/globals";
import { BMSSP } from "../src/bmssp.mjs";
import { dijkstra } from "../src/dijkstra.mjs";
import {
  dijkstraAdjacency,
  resetDijkstraComparisonCount,
  getDijkstraComparisonCount,
} from "../benchmarks/dijkstra-adj.mjs";
import { runScenarioBenchmark } from "../benchmarks/scenarios.bench.mjs";
import { runComparisonCountBenchmark } from "../benchmarks/compare-counts.bench.mjs";
import { countMismatches } from "../benchmarks/bench-util.mjs";
import { sparseRandom, chain, star } from "../benchmarks/generators.mjs";

describe("countMismatches (#170): per-run output verification", () => {
  test("identical maps count zero, including Infinity entries", () => {
    const nodeIDs = new Set([0, 1, 2]);
    const a = new Map([
      [0, 0],
      [1, 5],
      [2, Infinity],
    ]);
    const b = new Map(a);
    expect(countMismatches(a, b, nodeIDs)).toBe(0);
  });

  test("counts every differing node, missing entries included", () => {
    const nodeIDs = new Set([0, 1, 2, 3]);
    const expected = new Map([
      [0, 0],
      [1, 5],
      [2, 7],
      [3, Infinity],
    ]);
    const actual = new Map([
      [0, 0],
      [1, 6], // wrong distance
      [2, 7],
      // 3 missing entirely -> undefined !== Infinity
    ]);
    expect(countMismatches(expected, actual, nodeIDs)).toBe(2);
  });
});

describe("dijkstraAdjacency (#170): the fair prebuilt-adjacency baseline", () => {
  test("matches the shipped dijkstra on seeded random graphs", () => {
    for (const seed of [1, 2, 3]) {
      const graph = sparseRandom(300, 3, seed);
      const bmssp = new BMSSP(graph);
      const source = [...bmssp.nodeIDs][0];
      const expected = dijkstra(graph, bmssp.nodeIDs, source);
      const actual = dijkstraAdjacency(bmssp.adjacency, bmssp.nodeIDs, source);
      expect(actual.size).toBe(expected.size);
      for (const [id, d] of expected) {
        expect(actual.get(id)).toBe(d);
      }
    }
  });

  test("reports Infinity for unreachable nodes", () => {
    // 0 -> 1 and an isolated pair 2 -> 3: from 0, nodes 2 and 3 are unreachable
    const graph = [
      [0, 1, 4],
      [2, 3, 1],
    ];
    const bmssp = new BMSSP(graph);
    const dist = dijkstraAdjacency(bmssp.adjacency, bmssp.nodeIDs, 0);
    expect(dist.get(1)).toBe(4);
    expect(dist.get(2)).toBe(Infinity);
    expect(dist.get(3)).toBe(Infinity);
  });

  test("throws when the source is not in nodeIDs", () => {
    const bmssp = new BMSSP([[0, 1, 1]]);
    expect(() => dijkstraAdjacency(bmssp.adjacency, bmssp.nodeIDs, 99)).toThrow(
      "Source node not found",
    );
  });

  test("comparison counter counts and resets", () => {
    const bmssp = new BMSSP(sparseRandom(100, 3, 7));
    resetDijkstraComparisonCount();
    expect(getDijkstraComparisonCount()).toBe(0);
    dijkstraAdjacency(bmssp.adjacency, bmssp.nodeIDs, 0);
    expect(getDijkstraComparisonCount()).toBeGreaterThan(0);
    resetDijkstraComparisonCount();
    expect(getDijkstraComparisonCount()).toBe(0);
  });

  test("counts are deterministic for a fixed graph and source", () => {
    const bmssp = new BMSSP(sparseRandom(200, 3, 9));
    resetDijkstraComparisonCount();
    dijkstraAdjacency(bmssp.adjacency, bmssp.nodeIDs, 0);
    const first = getDijkstraComparisonCount();
    resetDijkstraComparisonCount();
    dijkstraAdjacency(bmssp.adjacency, bmssp.nodeIDs, 0);
    expect(getDijkstraComparisonCount()).toBe(first);
  });
});

// Tiny scenarios keep the harness integration tests fast: the point is the
// report shape and the zero-mismatch verification, not the timings.
const TINY_SCENARIOS = [
  {
    name: "tiny-sparse",
    blurb: "test scenario",
    build: () => sparseRandom(200, 3, 41),
  },
  { name: "tiny-chain", blurb: "test scenario", build: () => chain(50, 42) },
  { name: "tiny-star", blurb: "test scenario", build: () => star(60, 43) },
];

describe("runScenarioBenchmark (#170): head-to-head harness", () => {
  test("reports both algorithm columns with zero mismatches", () => {
    const { table, rows } = runScenarioBenchmark(TINY_SCENARIOS, 1);
    expect(rows).toHaveLength(TINY_SCENARIOS.length);
    for (const row of rows) {
      expect(row.mismatches).toBe(0);
      expect(Number(row["dijkstra ms"])).toBeGreaterThanOrEqual(0);
      expect(Number(row["bmssp ms"])).toBeGreaterThanOrEqual(0);
      expect(row.ratio).toMatch(/x$/);
    }
    for (const header of ["dijkstra ms", "bmssp ms", "ratio", "mismatches"]) {
      expect(table).toContain(header);
    }
  });
});

describe("runComparisonCountBenchmark (#170): sorting-barrier counts", () => {
  test("counts both sides exactly once with zero mismatches", () => {
    const { table, rows } = runComparisonCountBenchmark([
      {
        name: "tiny-sparse",
        build: () => sparseRandom(300, 3, 44),
      },
    ]);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.mismatches).toBe(0);
    // Counts are formatted with thousands separators; strip them to compare
    const dijkstraComparisons = Number(
      row["dijkstra cmps"].replaceAll(",", ""),
    );
    const bmsspComparisons = Number(row["bmssp cmps"].replaceAll(",", ""));
    expect(dijkstraComparisons).toBeGreaterThan(0);
    expect(bmsspComparisons).toBeGreaterThan(0);
    expect(table).toContain("bmssp cmps");
  });
});
