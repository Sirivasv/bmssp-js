import { describe, test, expect } from "@jest/globals";
import { BMSSP } from "../src/bmssp.mjs";
import { dijkstra } from "../src/dijkstra.mjs";
import { edgesOf } from "./helpers.mjs";

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

// Seeded random directed graph with an edge out of node 0 guaranteed
function randomEdges(rand, n, m, maxWeight) {
  const edges = [[0, 1 + Math.floor(rand() * (n - 1)), 1]];
  for (let i = 1; i < m; i += 1) {
    const from = Math.floor(rand() * n);
    const to = Math.floor(rand() * n);
    const weight = 1 + Math.floor(rand() * maxWeight);
    edges.push([from, to, weight]);
  }
  return edges;
}

// Run BMSSP and the Dijkstra oracle from the same source and require the
// full distance maps to be identical
function expectMatchesOracle(edges, source) {
  const bmssp = new BMSSP(edges);
  bmssp.calculateShortestPaths(source);
  const oracle = dijkstra(edgesOf(bmssp), bmssp.nodeIDs, source);
  expect(bmssp.shortestPaths.size).toBe(oracle.size);
  for (const [v, d] of oracle) {
    expect(bmssp.shortestPaths.get(v)).toBe(d);
  }
  return bmssp;
}

describe("BMSSP parameter derivation", () => {
  test("clamps k, t and topLevel to >= 1 on tiny graphs", () => {
    const tiny = new BMSSP([[0, 0, 5]]);
    expect(tiny.k).toBeGreaterThanOrEqual(1);
    expect(tiny.t).toBeGreaterThanOrEqual(1);
    expect(tiny.topLevel).toBeGreaterThanOrEqual(1);
  });

  test("matches the paper's formulas once n is large enough", () => {
    // 1024 nodes in a chain: log2(n) = 10, k = ⌊10^(1/3)⌋ = 2,
    // t = ⌊10^(2/3)⌋ = 4, topLevel = ⌈10 / 4⌉ = 3
    const edges = [];
    for (let i = 0; i < 1023; i += 1) edges.push([i, i + 1, 1]);
    const chain = new BMSSP(edges);
    expect(chain.nodeIDs.size).toBe(1024);
    expect(chain.k).toBe(2);
    expect(chain.t).toBe(4);
    expect(chain.topLevel).toBe(3);
  });

  test("the top-level workload guard can never trip below n", () => {
    // k·2^(topLevel·t) >= n guarantees the top call is a successful
    // execution (Lemma 3.1), so every reachable vertex gets completed
    for (const n of [2, 3, 10, 100, 5000, 1 << 20]) {
      const bmssp = new BMSSP([[0, 1, 1]]);
      bmssp.nodeIDs = new Set(Array.from({ length: n }, (_, i) => i));
      bmssp.deriveParameters();
      expect(bmssp.k * 2 ** (bmssp.topLevel * bmssp.t)).toBeGreaterThanOrEqual(
        n,
      );
    }
  });
});

describe("BMSSP end-to-end on hand-built graphs", () => {
  test("computes the README example distances", () => {
    const bmssp = expectMatchesOracle(
      [
        [0, 1, 50],
        [1, 2, 75],
        [0, 2, 25],
      ],
      0,
    );
    expect(bmssp.shortestPaths.get(0)).toBe(0);
    expect(bmssp.shortestPaths.get(1)).toBe(50);
    expect(bmssp.shortestPaths.get(2)).toBe(25);
  });

  test("takes the cheaper multi-hop path over the direct edge", () => {
    const bmssp = expectMatchesOracle(
      [
        [0, 1, 1],
        [1, 2, 1],
        [2, 3, 1],
        [0, 3, 10],
      ],
      0,
    );
    expect(bmssp.shortestPaths.get(3)).toBe(3);
  });

  test("leaves unreachable vertices at Infinity", () => {
    const bmssp = expectMatchesOracle(
      [
        [0, 1, 2],
        [3, 4, 1],
      ],
      0,
    );
    expect(bmssp.shortestPaths.get(3)).toBe(Infinity);
    expect(bmssp.shortestPaths.get(4)).toBe(Infinity);
  });

  test("handles a single-node graph (self-loop)", () => {
    const bmssp = expectMatchesOracle([[0, 0, 5]], 0);
    expect(bmssp.shortestPaths.get(0)).toBe(0);
  });

  test("recomputes cleanly from a different source", () => {
    const edges = [
      [0, 1, 4],
      [1, 2, 3],
      [2, 0, 2],
    ];
    const bmssp = new BMSSP(edges);
    bmssp.calculateShortestPaths(0);
    bmssp.calculateShortestPaths(2);
    const oracle = dijkstra(edgesOf(bmssp), bmssp.nodeIDs, 2);
    for (const [v, d] of oracle) {
      expect(bmssp.shortestPaths.get(v)).toBe(d);
    }
  });
});

describe("BMSSP degenerate ties (Assumption 2.1 violated, #163)", () => {
  test("terminates on zero-weight cycles and clusters", () => {
    // 0, 1, 2 form a zero-weight cluster (all at distance 0): a BaseCase
    // partial execution settles only tied vertices and returns none of
    // them, which without the stall escape hatch would loop forever
    expectMatchesOracle(
      [
        [0, 1, 0],
        [1, 0, 0],
        [1, 2, 0],
        [2, 3, 1],
        [3, 4, 2],
      ],
      0,
    );
  });

  test("terminates when many equal-length paths tie mid-graph", () => {
    // A layered graph where every vertex of a layer sits at the same
    // distance: boundary ties are the norm rather than the exception
    const edges = [];
    for (let layer = 0; layer < 6; layer += 1) {
      for (let i = 0; i < 4; i += 1) {
        for (let j = 0; j < 4; j += 1) {
          edges.push([1 + layer * 4 + i, 1 + (layer + 1) * 4 + j, 1]);
        }
      }
    }
    for (let i = 0; i < 4; i += 1) edges.push([0, 1 + i, 1]);
    expectMatchesOracle(edges, 0);
  });

  test("seeded stress with tiny weights (0-2) keeps matching the oracle", () => {
    const rand = mulberry32(431);
    for (let round = 0; round < 25; round += 1) {
      const n = 20 + Math.floor(rand() * 20);
      const edges = [[0, 1 + Math.floor(rand() * (n - 1)), 1]];
      for (let i = 0; i < n * 4; i += 1) {
        edges.push([
          Math.floor(rand() * n),
          Math.floor(rand() * n),
          Math.floor(rand() * 3),
        ]);
      }
      expectMatchesOracle(edges, 0);
    }
  });
});

describe("BMSSP recursion contract (Lemma 3.1)", () => {
  test("a bounded top call returns a complete set below its boundary", () => {
    const rand = mulberry32(432);
    for (let round = 0; round < 25; round += 1) {
      const edges = randomEdges(rand, 30, 120, 1000);
      const bmssp = new BMSSP(edges);
      const oracle = dijkstra(edgesOf(bmssp), bmssp.nodeIDs, 0);
      const finite = [...oracle.values()]
        .filter((d) => d < Infinity)
        .sort((a, b) => a - b);
      const B = finite[Math.floor(finite.length * 0.6)] + 0.5;

      bmssp.initializeShortestPaths();
      bmssp.shortestPaths.set(0, 0);
      const { bound, vertices } = bmssp.bmssp(bmssp.topLevel, B, new Set([0]));

      // B' <= B, every returned vertex is complete, and U holds exactly
      // the vertices with true distance below B' (all paths go through
      // the single source, so "reachable through S" is just "reachable")
      expect(bound).toBeLessThanOrEqual(B);
      for (const v of vertices) {
        expect(bmssp.shortestPaths.get(v)).toBe(oracle.get(v));
        expect(oracle.get(v)).toBeLessThan(bound);
      }
      for (const [v, d] of oracle) {
        if (d < bound) expect(vertices.has(v)).toBe(true);
      }
      // d̂ never underestimates the true distance anywhere
      for (const [v, d] of bmssp.shortestPaths) {
        expect(d).toBeGreaterThanOrEqual(oracle.get(v));
      }
    }
  });

  test("accepts a composite bound and translates ids across the index boundary (#205)", () => {
    // Non-contiguous ids so dense index != id: the public wrapper must map
    // the bound's id component to its index on the way in and the returned
    // boundKey's index back to an id on the way out.
    const edges = [
      [10, 20, 3],
      [20, 30, 4],
      [30, 40, 5],
      [10, 40, 100],
    ];
    const bmssp = new BMSSP(edges);
    // Canonical key of vertex 30: distance 7 (10->20->30), 2 hops
    bmssp.calculateShortestPaths(10);
    expect(bmssp.shortestPaths.get(30)).toBe(7);
    expect(bmssp.hops.get(30)).toBe(2);

    // A composite bound exactly at vertex 30's key is strict, so 30 and
    // everything farther (40 at distance 12) are excluded
    bmssp.initializeShortestPaths();
    bmssp.shortestPaths.set(10, 0);
    const { bound, boundKey, vertices } = bmssp.bmssp(
      bmssp.topLevel,
      [7, 2, 30],
      new Set([10]),
    );
    expect(vertices).toEqual(new Set([10, 20]));
    // Successful execution echoes the bound back, in id space
    expect(boundKey).toEqual([7, 2, 30]);
    expect(bound).toEqual([7, 2, 30]);
  });

  test("a composite bound whose id is not a graph node passes through (#205)", () => {
    // The 3rd key component only breaks ties at an identical (length, hops);
    // a bound keyed on a non-node id must still bound correctly by length,
    // exercising the index-translation fallbacks at the public boundary
    const bmssp = new BMSSP([
      [0, 1, 3],
      [1, 2, 4],
    ]);
    bmssp.initializeShortestPaths();
    bmssp.shortestPaths.set(0, 0);
    // Length 7 with a large hop budget: every vertex (d = 0, 3, 7) is below it
    const { boundKey, vertices } = bmssp.bmssp(
      bmssp.topLevel,
      [7, 5, 999],
      new Set([0]),
    );
    expect(vertices).toEqual(new Set([0, 1, 2]));
    expect(boundKey).toEqual([7, 5, 999]);
  });

  test("a direct level-0 call projects a partial scalar boundary (#205)", () => {
    // Level 0 delegates to BaseCase; a chain longer than the settle cap k
    // forces a partial execution, so the scalar bound is the separator's
    // length rather than the input B
    const bmssp = new BMSSP([
      [0, 1, 1],
      [1, 2, 1],
      [2, 3, 1],
    ]);
    expect(bmssp.k).toBe(1); // cap k + 1 = 2 settled before stopping
    bmssp.initializeShortestPaths();
    bmssp.shortestPaths.set(0, 0);
    const { bound, vertices } = bmssp.bmssp(0, Infinity, new Set([0]));
    // Settled {0, 1}; B' = d(1) = 1, returned set is the strictly-closer {0}
    expect(bound).toBe(1);
    expect(vertices).toEqual(new Set([0]));
  });

  test("a public call with an unknown source id throws (#205)", () => {
    const bmssp = new BMSSP([[0, 1, 1]]);
    bmssp.initializeShortestPaths();
    bmssp.shortestPaths.set(0, 0);
    expect(() => bmssp.bmssp(bmssp.topLevel, Infinity, new Set([999]))).toThrow(
      "finite distance estimate",
    );
  });

  test("an unbounded top call is a successful execution (B' = B)", () => {
    const rand = mulberry32(433);
    const edges = randomEdges(rand, 40, 160, 1000);
    const bmssp = new BMSSP(edges);
    bmssp.initializeShortestPaths();
    bmssp.shortestPaths.set(0, 0);
    const { bound, vertices } = bmssp.bmssp(
      bmssp.topLevel,
      Infinity,
      new Set([0]),
    );
    const oracle = dijkstra(edgesOf(bmssp), bmssp.nodeIDs, 0);
    expect(bound).toBe(Infinity);
    const reachable = new Set(
      [...oracle].filter(([, d]) => d < Infinity).map(([v]) => v),
    );
    expect(vertices).toEqual(reachable);
  });
});

describe("BMSSP vs Dijkstra oracle (seeded stress)", () => {
  test("full distance maps match on random graphs across sizes", () => {
    const rand = mulberry32(434);
    for (let round = 0; round < 30; round += 1) {
      const n = 10 + Math.floor(rand() * 90);
      const m = n * (2 + Math.floor(rand() * 3));
      const edges = randomEdges(rand, n, m, 1000);
      expectMatchesOracle(edges, 0);
    }
  });

  test("full distance maps match on a larger sparse graph", () => {
    const rand = mulberry32(435);
    const edges = randomEdges(rand, 2000, 6000, 100000);
    expectMatchesOracle(edges, 0);
  });
});
