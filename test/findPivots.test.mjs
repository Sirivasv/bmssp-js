import { describe, test, expect } from "@jest/globals";
import { findPivots } from "../src/findPivots.mjs";
import { BMSSP } from "../src/bmssp.mjs";
import { dijkstra } from "../src/dijkstra.mjs";

// Small deterministic PRNG so stress-test failures are reproducible
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Build the shared state FindPivots runs against: the class's adjacency map
// and d̂ labels, with every source marked complete at its given distance
function setup(edges, sourceDistances) {
  const bmssp = new BMSSP(edges);
  for (const [source, distance] of Object.entries(sourceDistances)) {
    bmssp.shortestPaths.set(Number(source), distance);
  }
  return bmssp;
}

// Seeded random directed graph with an edge out of node 0 guaranteed.
// Large weight range keeps equal-length paths (ties) rare.
function randomEdges(rand, n, m) {
  const edges = [[0, 1 + Math.floor(rand() * (n - 1)), 1]];
  for (let i = 1; i < m; i += 1) {
    const from = Math.floor(rand() * n);
    const to = Math.floor(rand() * n);
    const weight = 1 + Math.floor(rand() * 1000);
    edges.push([from, to, weight]);
  }
  return edges;
}

describe("findPivots validation", () => {
  test("rejects k that is not a number >= 1", () => {
    const { shortestPaths, adjacency } = setup([[0, 1, 1]], { 0: 0 });
    expect(() =>
      findPivots(Infinity, new Set([0]), shortestPaths, adjacency, 0),
    ).toThrow("k must be a number >= 1");
    expect(() =>
      findPivots(Infinity, new Set([0]), shortestPaths, adjacency, NaN),
    ).toThrow("k must be a number >= 1");
  });

  test("rejects an empty S", () => {
    const { shortestPaths, adjacency } = setup([[0, 1, 1]], { 0: 0 });
    expect(() =>
      findPivots(Infinity, new Set(), shortestPaths, adjacency, 2),
    ).toThrow("S must contain at least one source node");
  });

  test("rejects a source without a finite distance estimate", () => {
    // Node 1 was never completed: its d̂ is still Infinity
    const { shortestPaths, adjacency } = setup([[0, 1, 1]], { 0: 0 });
    expect(() =>
      findPivots(Infinity, new Set([0, 1]), shortestPaths, adjacency, 2),
    ).toThrow("every source must have a finite distance estimate");
  });
});

describe("findPivots early exit (|W| > k·|S|)", () => {
  test("a star blowing past the cap returns every source as a pivot", () => {
    const edges = [
      [0, 1, 1],
      [0, 2, 1],
      [0, 3, 1],
    ];
    const { shortestPaths, adjacency } = setup(edges, { 0: 0 });
    const result = findPivots(
      Infinity,
      new Set([0]),
      shortestPaths,
      adjacency,
      1,
    );
    // Round 1 grows W to {0,1,2,3}: 4 > k·|S| = 1, so P = S
    expect(result.pivots).toEqual(new Set([0]));
    expect(result.W).toEqual(new Set([0, 1, 2, 3]));
    expect(shortestPaths.get(1)).toBe(1);
    expect(shortestPaths.get(2)).toBe(1);
    expect(shortestPaths.get(3)).toBe(1);
  });

  test("multiple sources early-exit together", () => {
    const edges = [
      [0, 1, 1],
      [4, 5, 1],
    ];
    const { shortestPaths, adjacency } = setup(edges, { 0: 0, 4: 0 });
    const result = findPivots(
      Infinity,
      new Set([0, 4]),
      shortestPaths,
      adjacency,
      1,
    );
    // Round 1: W = {0,4,1,5}, 4 > k·|S| = 2, so P = S
    expect(result.pivots).toEqual(new Set([0, 4]));
    expect(result.W).toEqual(new Set([0, 4, 1, 5]));
  });
});

describe("findPivots relaxation semantics", () => {
  test("d̂ is updated even at/above B, but W membership is gated by < B", () => {
    const edges = [[0, 1, 5]];
    const { shortestPaths, adjacency } = setup(edges, { 0: 0 });
    const result = findPivots(3, new Set([0]), shortestPaths, adjacency, 2);
    // The relaxation writes d̂(1) = 5, but 5 >= B keeps 1 out of W
    expect(shortestPaths.get(1)).toBe(5);
    expect(result.W).toEqual(new Set([0]));
    // A 1-vertex tree is below the k = 2 threshold: no pivots at all
    expect(result.pivots).toEqual(new Set());
  });

  test("a zero-weight cycle terminates (its vertices root no tree)", () => {
    const edges = [
      [0, 1, 0],
      [1, 0, 0],
      [1, 2, 1],
    ];
    const { shortestPaths, adjacency } = setup(edges, { 0: 0 });
    const result = findPivots(
      Infinity,
      new Set([0]),
      shortestPaths,
      adjacency,
      5,
    );
    expect(result.W).toEqual(new Set([0, 1, 2]));
    expect(shortestPaths.get(1)).toBe(0);
    expect(shortestPaths.get(2)).toBe(1);
    // 0 and 1 give each other parents (tight cycle), so nothing is a root
    expect(result.pivots).toEqual(new Set());
  });
});

describe("findPivots forest case (pivots root large tight trees)", () => {
  test("a chain exactly k long makes the source a pivot", () => {
    const edges = [
      [0, 1, 1],
      [1, 2, 1],
    ];
    const { shortestPaths, adjacency } = setup(edges, { 0: 0 });
    const result = findPivots(
      Infinity,
      new Set([0]),
      shortestPaths,
      adjacency,
      3,
    );
    // W = {0,1,2} stays within k·|S| = 3; the tree at 0 has 3 >= k vertices
    expect(result.pivots).toEqual(new Set([0]));
    expect(result.W).toEqual(new Set([0, 1, 2]));
  });

  test("sources with small trees are dropped, large ones kept", () => {
    const edges = [
      [0, 1, 1],
      [1, 2, 1],
      [4, 5, 1],
    ];
    const { shortestPaths, adjacency } = setup(edges, { 0: 0, 4: 0 });
    const result = findPivots(
      Infinity,
      new Set([0, 4]),
      shortestPaths,
      adjacency,
      3,
    );
    // Tree at 0 = {0,1,2} (3 >= k) is a pivot; tree at 4 = {4,5} (2 < k) is not
    expect(result.pivots).toEqual(new Set([0]));
    expect(result.W).toEqual(new Set([0, 4, 1, 5, 2]));
  });

  test("equal-length paths (DAG of tight edges) keep tree sizes well-defined", () => {
    const edges = [
      [0, 1, 1],
      [0, 2, 1],
      [1, 3, 1],
      [2, 3, 1],
    ];
    const { shortestPaths, adjacency } = setup(edges, { 0: 0 });
    const result = findPivots(
      Infinity,
      new Set([0]),
      shortestPaths,
      adjacency,
      4,
    );
    // Both 1->3 and 2->3 are tight; 3 gets exactly one parent, so the tree
    // at 0 counts each vertex once: size 4 >= k = 4
    expect(result.pivots).toEqual(new Set([0]));
    expect(result.W).toEqual(new Set([0, 1, 2, 3]));
  });
});

describe("findPivots vs Dijkstra oracle (seeded)", () => {
  test("k = n rounds with B = Infinity complete every reachable vertex", () => {
    const rand = mulberry32(44);
    for (let round = 0; round < 20; round += 1) {
      const edges = randomEdges(rand, 40, 160);
      const bmssp = setup(edges, { 0: 0 });
      const oracle = dijkstra(bmssp.graph, bmssp.nodeIDs, 0);
      const n = bmssp.nodeIDs.size;
      // k = n rounds of Bellman-Ford complete everything, and the early
      // exit (|W| > n·1) can never fire since W has at most n vertices
      const result = findPivots(
        Infinity,
        new Set([0]),
        bmssp.shortestPaths,
        bmssp.adjacency,
        n,
      );
      const reachable = new Set(
        [...oracle].filter(([, d]) => d < Infinity).map(([v]) => v),
      );
      expect(result.W).toEqual(reachable);
      for (const v of result.W) {
        expect(bmssp.shortestPaths.get(v)).toBe(oracle.get(v));
      }
    }
  });

  test("bounded runs keep the Algorithm 1 contract", () => {
    const rand = mulberry32(45);
    for (let round = 0; round < 25; round += 1) {
      const edges = randomEdges(rand, 30, 90);
      const bmssp = setup(edges, { 0: 0 });
      const oracle = dijkstra(bmssp.graph, bmssp.nodeIDs, 0);
      const finite = [...oracle.values()]
        .filter((d) => d < Infinity)
        .sort((a, b) => a - b);
      // A bound somewhere inside the distance distribution, and a small k
      const B = finite[Math.floor(finite.length * 0.6)] + 0.5;
      const k = 1 + Math.floor(rand() * 5);
      const result = findPivots(
        B,
        new Set([0]),
        bmssp.shortestPaths,
        bmssp.adjacency,
        k,
      );

      // Pivots are a subset of S, and |P| <= |W| / k
      for (const p of result.pivots) {
        expect(p).toBe(0);
      }
      expect(result.pivots.size * k).toBeLessThanOrEqual(result.W.size);

      // d̂ never underestimates the true distance anywhere
      for (const [v, d] of bmssp.shortestPaths) {
        expect(d).toBeGreaterThanOrEqual(oracle.get(v));
      }

      // The frontier-shrink contract: every vertex with d(v) < B is either
      // complete in W, or some shortest path to it visits a pivot
      const pivotOracles = new Map(
        [...result.pivots].map((p) => [
          p,
          dijkstra(bmssp.graph, bmssp.nodeIDs, p),
        ]),
      );
      for (const [v, d] of oracle) {
        if (d >= B) continue;
        const completeInW = result.W.has(v) && bmssp.shortestPaths.get(v) === d;
        const throughPivot = [...pivotOracles].some(
          ([p, fromP]) => oracle.get(p) + fromP.get(v) === d,
        );
        expect(completeInW || throughPivot).toBe(true);
      }
    }
  });
});
