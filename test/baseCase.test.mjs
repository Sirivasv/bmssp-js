import { describe, test, expect } from "@jest/globals";
import { baseCase } from "../src/baseCase.mjs";
import { BMSSP } from "../src/bmssp.mjs";
import { dijkstra } from "../src/dijkstra.mjs";
import { compareKeys, makeTies, orderKey } from "../src/tieBreak.mjs";

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

// Build the shared state BaseCase runs against: the class's adjacency map
// and d̂ labels, with the source marked complete at distance 0
function setup(edges, source) {
  const bmssp = new BMSSP(edges);
  bmssp.shortestPaths.set(source, 0);
  return bmssp;
}

// Seeded random directed graph with an edge out of node 0 guaranteed
function randomEdges(rand, n, m) {
  const edges = [[0, 1 + Math.floor(rand() * (n - 1)), 1]];
  for (let i = 1; i < m; i += 1) {
    const from = Math.floor(rand() * n);
    const to = Math.floor(rand() * n);
    const weight = 1 + Math.floor(rand() * 20);
    edges.push([from, to, weight]);
  }
  return edges;
}

describe("baseCase validation", () => {
  test("rejects k that is not a number >= 1", () => {
    const { shortestPaths, adjacency } = setup([[0, 1, 1]], 0);
    expect(() =>
      baseCase(Infinity, new Set([0]), shortestPaths, adjacency, 0),
    ).toThrow("k must be a number >= 1");
    expect(() =>
      baseCase(Infinity, new Set([0]), shortestPaths, adjacency, NaN),
    ).toThrow("k must be a number >= 1");
  });

  test("rejects an S that is not a singleton", () => {
    const { shortestPaths, adjacency } = setup([[0, 1, 1]], 0);
    expect(() =>
      baseCase(Infinity, new Set(), shortestPaths, adjacency, 2),
    ).toThrow("S must contain exactly one source node");
    expect(() =>
      baseCase(Infinity, new Set([0, 1]), shortestPaths, adjacency, 2),
    ).toThrow("S must contain exactly one source node");
  });

  test("rejects a source without a finite distance estimate", () => {
    // No setup(): every d̂ stays Infinity, so the source is not complete
    const bmssp = new BMSSP([[0, 1, 1]]);
    expect(() =>
      baseCase(Infinity, new Set([0]), bmssp.shortestPaths, bmssp.adjacency, 2),
    ).toThrow("the source must have a finite distance estimate");
  });
});

describe("baseCase full success (fewer than k + 1 vertices under B)", () => {
  const edges = [
    [0, 1, 2],
    [0, 2, 5],
    [1, 2, 1],
    [2, 3, 1],
    [4, 0, 1],
  ];

  test("with B = Infinity settles every reachable vertex exactly", () => {
    const { shortestPaths, adjacency } = setup(edges, 0);
    const result = baseCase(
      Infinity,
      new Set([0]),
      shortestPaths,
      adjacency,
      10,
    );
    expect(result.bound).toBe(Infinity);
    expect(result.vertices).toEqual(new Set([0, 1, 2, 3]));
    expect(shortestPaths.get(0)).toBe(0);
    expect(shortestPaths.get(1)).toBe(2);
    expect(shortestPaths.get(2)).toBe(3);
    expect(shortestPaths.get(3)).toBe(4);
    // Node 4 is not reachable from 0 and must stay untouched
    expect(shortestPaths.get(4)).toBe(Infinity);
  });

  test("a finite B keeps distances >= B out of the result and out of d̂", () => {
    const { shortestPaths, adjacency } = setup(edges, 0);
    const result = baseCase(4, new Set([0]), shortestPaths, adjacency, 10);
    // d(3) = 4 is not < B, so 3 is neither settled nor even relaxed
    expect(result.bound).toBe(4);
    expect(result.vertices).toEqual(new Set([0, 1, 2]));
    expect(shortestPaths.get(3)).toBe(Infinity);
  });

  test("a source with no outgoing edges succeeds with just itself", () => {
    const { shortestPaths, adjacency } = setup(edges, 3);
    const result = baseCase(
      Infinity,
      new Set([3]),
      shortestPaths,
      adjacency,
      5,
    );
    expect(result.bound).toBe(Infinity);
    expect(result.vertices).toEqual(new Set([3]));
  });
});

describe("baseCase partial (the k + 1 cap is hit)", () => {
  test("on a chain it reports B' = max settled distance, returns closer ones", () => {
    const edges = [
      [0, 1, 1],
      [1, 2, 1],
      [2, 3, 1],
      [3, 4, 1],
    ];
    const { shortestPaths, adjacency } = setup(edges, 0);
    const result = baseCase(
      Infinity,
      new Set([0]),
      shortestPaths,
      adjacency,
      2,
    );
    // Settled = {0, 1, 2} (k + 1 = 3 vertices), so B' = d̂(2) = 2
    expect(result.bound).toBe(2);
    expect(result.vertices).toEqual(new Set([0, 1]));
    expect(shortestPaths.get(0)).toBe(0);
    expect(shortestPaths.get(1)).toBe(1);
    expect(shortestPaths.get(2)).toBe(2);
  });

  test("boundary ties are broken deterministically by the composite order (#163)", () => {
    const edges = [
      [0, 1, 5],
      [0, 2, 5],
      [0, 3, 5],
    ];
    const { shortestPaths, adjacency } = setup(edges, 0);
    const result = baseCase(
      Infinity,
      new Set([0]),
      shortestPaths,
      adjacency,
      2,
    );
    // Settled = {0} plus the two smallest-keyed distance-5 leaves (1, 2);
    // the boundary is leaf 2's key [5, 1, 2] and the strictly-closer filter
    // keeps leaf 1 — under scalar ties, smaller ids settle first. (Before
    // #163 every tied leaf was excluded and only the source came back.)
    expect(result.bound).toBe(5);
    expect(result.boundKey).toEqual([5, 1, 2]);
    expect(result.vertices).toEqual(new Set([0, 1]));
  });

  test("the k + 1 cap still respects the bound B", () => {
    const edges = [
      [0, 1, 1],
      [1, 2, 1],
      [2, 3, 1],
    ];
    const { shortestPaths, adjacency } = setup(edges, 0);
    const result = baseCase(2, new Set([0]), shortestPaths, adjacency, 1);
    // k + 1 = 2 settled: {0, 1}; B' = d̂(1) = 1 < B = 2
    expect(result.bound).toBe(1);
    expect(result.vertices).toEqual(new Set([0]));
    expect(shortestPaths.get(3)).toBe(Infinity);
  });
});

describe("baseCase equal-sum relaxations", () => {
  test("a zero-weight cycle terminates and settles correctly", () => {
    const edges = [
      [0, 1, 0],
      [1, 0, 0],
      [1, 2, 1],
    ];
    const { shortestPaths, adjacency } = setup(edges, 0);
    const result = baseCase(
      Infinity,
      new Set([0]),
      shortestPaths,
      adjacency,
      10,
    );
    expect(result.bound).toBe(Infinity);
    expect(result.vertices).toEqual(new Set([0, 1, 2]));
    expect(shortestPaths.get(1)).toBe(0);
    expect(shortestPaths.get(2)).toBe(1);
  });

  test("two equal-length paths to the same vertex settle it once", () => {
    const edges = [
      [0, 1, 1],
      [0, 2, 1],
      [1, 3, 1],
      [2, 3, 1],
    ];
    const { shortestPaths, adjacency } = setup(edges, 0);
    const result = baseCase(
      Infinity,
      new Set([0]),
      shortestPaths,
      adjacency,
      10,
    );
    expect(result.vertices).toEqual(new Set([0, 1, 2, 3]));
    expect(shortestPaths.get(3)).toBe(2);
  });
});

describe("baseCase vs Dijkstra oracle (seeded)", () => {
  test("full success on random graphs matches the reachable set exactly", () => {
    const rand = mulberry32(40);
    for (let round = 0; round < 20; round += 1) {
      const edges = randomEdges(rand, 40, 160);
      const bmssp = setup(edges, 0);
      const oracle = dijkstra(bmssp.graph, bmssp.nodeIDs, 0);
      const result = baseCase(
        Infinity,
        new Set([0]),
        bmssp.shortestPaths,
        bmssp.adjacency,
        bmssp.nodeIDs.size,
      );
      expect(result.bound).toBe(Infinity);
      const reachable = new Set(
        [...oracle].filter(([, d]) => d < Infinity).map(([v]) => v),
      );
      expect(result.vertices).toEqual(reachable);
      for (const v of result.vertices) {
        expect(bmssp.shortestPaths.get(v)).toBe(oracle.get(v));
      }
    }
  });

  test("bounded, capped runs keep the Algorithm 2 contract", () => {
    const rand = mulberry32(41);
    for (let round = 0; round < 30; round += 1) {
      const edges = randomEdges(rand, 50, 200);
      const bmssp = setup(edges, 0);
      const oracle = dijkstra(bmssp.graph, bmssp.nodeIDs, 0);
      const finite = [...oracle.values()]
        .filter((d) => d < Infinity)
        .sort((a, b) => a - b);
      // A bound somewhere inside the distance distribution, and a small cap
      const B = finite[Math.floor(finite.length * 0.6)] + 0.5;
      const k = 1 + Math.floor(rand() * 8);
      const ties = makeTies();
      const result = baseCase(
        B,
        new Set([0]),
        bmssp.shortestPaths,
        bmssp.adjacency,
        k,
        ties,
      );
      // B' never exceeds B, and B' = B means full success under the bound
      expect(result.bound).toBeLessThanOrEqual(B);
      // Every returned vertex is complete (d̂ = true distance) and strictly
      // below B' in the composite order (#163) — in the scalar view a
      // returned vertex may tie the boundary's length, never exceed it
      for (const v of result.vertices) {
        expect(bmssp.shortestPaths.get(v)).toBe(oracle.get(v));
        expect(oracle.get(v)).toBeLessThanOrEqual(result.bound);
        expect(
          compareKeys(orderKey(v, bmssp.shortestPaths, ties), result.boundKey),
        ).toBeLessThan(0);
      }
      // Completeness: everything with a true distance below B' is returned
      for (const [v, d] of oracle) {
        if (d < result.bound) {
          expect(result.vertices.has(v)).toBe(true);
        }
      }
      // d̂ never underestimates the true distance anywhere
      for (const [v, d] of bmssp.shortestPaths) {
        expect(d).toBeGreaterThanOrEqual(oracle.get(v));
      }
    }
  });
});
