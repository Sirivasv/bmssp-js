import { describe, test, expect } from "@jest/globals";
import { BMSSP, dijkstra } from "../index.mjs";
import { sparseRandom } from "../benchmarks/generators.mjs";

// #171 — public multi-source / bounded BMSSP entrypoint.
// calculateShortestPathsFrom(sources, { bound }) runs the paper's
// BMSSP(l, B, S) generalization from a public surface: a set of sources with
// initial distances, optionally under a strict bound B. Results land in
// this.shortestPaths, like calculateShortestPaths. Single-source SSSP is the
// special case sources = [start], bound = Infinity.
//
// Ground truth for a multi-source run with initial distances d0[s]:
//   trueDist(v) = min over sources s of (d0[s] + dist_s(v))
// where dist_s is the single-source Dijkstra distance from s.

// Small hand graph with competing paths from two sources.
const HAND = [
  [0, 1, 2],
  [1, 2, 3],
  [2, 3, 1],
  [3, 4, 4],
  [5, 4, 1],
  [5, 3, 6],
  [4, 6, 2],
];

// Multi-source oracle: min over sources of (initial distance + Dijkstra dist).
function multiSourceOracle(graph, nodeIDs, initial) {
  const oracles = new Map();
  for (const s of initial.keys()) {
    oracles.set(s, dijkstra(graph, nodeIDs, s));
  }
  const trueDist = new Map();
  for (const v of nodeIDs) {
    let best = Infinity;
    for (const [s, d0] of initial) {
      best = Math.min(best, d0 + oracles.get(s).get(v));
    }
    trueDist.set(v, best);
  }
  return trueDist;
}

describe("#171 calculateShortestPathsFrom — single-source equivalence", () => {
  test("sources = [s] matches calculateShortestPaths(s) and the oracle", () => {
    const edges = sparseRandom(400, 3, 7101);
    const nodeIDs = new BMSSP(edges).nodeIDs;
    for (const s of [...nodeIDs].slice(0, 5)) {
      const a = new BMSSP(edges);
      a.calculateShortestPaths(s);
      const b = new BMSSP(edges);
      b.calculateShortestPathsFrom([s]);
      const oracle = dijkstra(edges, nodeIDs, s);
      for (const v of nodeIDs) {
        expect(b.shortestPaths.get(v)).toBe(a.shortestPaths.get(v));
        expect(b.shortestPaths.get(v)).toBe(oracle.get(v));
      }
    }
  });

  test("[[s, 0]] pair form equals the bare-id form", () => {
    const g1 = new BMSSP(HAND);
    g1.calculateShortestPathsFrom([0]);
    const g2 = new BMSSP(HAND);
    g2.calculateShortestPathsFrom([[0, 0]]);
    for (const v of g1.nodeIDs) {
      expect(g2.shortestPaths.get(v)).toBe(g1.shortestPaths.get(v));
    }
  });
});

describe("#171 calculateShortestPathsFrom — multi-source semantics", () => {
  test("nearest-of-many (all sources at distance 0) on the hand graph", () => {
    const g = new BMSSP(HAND);
    const initial = new Map([
      [0, 0],
      [5, 0],
    ]);
    g.calculateShortestPathsFrom([0, 5]);
    const trueDist = multiSourceOracle(HAND, g.nodeIDs, initial);
    for (const v of g.nodeIDs) {
      expect(g.shortestPaths.get(v)).toBe(trueDist.get(v));
    }
    // node 4 is reached at 1 via 5->4 (beats 0->1->2->3->4 = 10)
    expect(g.shortestPaths.get(4)).toBe(1);
    // node 6 = 4 -> 6 (2) on top of the nearest 4
    expect(g.shortestPaths.get(6)).toBe(3);
  });

  test("custom initial distances match the multi-source oracle (seeded)", () => {
    const edges = sparseRandom(600, 3, 7202);
    const nodeIDs = new BMSSP(edges).nodeIDs;
    const nodes = [...nodeIDs].sort((a, b) => a - b);
    const initial = new Map([
      [nodes[0], 0],
      [nodes[10], 25],
      [nodes[100], 5],
    ]);
    const g = new BMSSP(edges);
    g.calculateShortestPathsFrom(initial);
    const trueDist = multiSourceOracle(edges, nodeIDs, initial);
    for (const v of nodeIDs) {
      expect(g.shortestPaths.get(v)).toBe(trueDist.get(v));
    }
  });

  test("a repeated source keeps its smallest initial distance", () => {
    const g = new BMSSP(HAND);
    g.calculateShortestPathsFrom([
      [0, 40],
      [0, 5],
      [0, 12],
    ]);
    // effective d0[0] = 5, so d(1) = 5 + 2 = 7
    expect(g.shortestPaths.get(0)).toBe(5);
    expect(g.shortestPaths.get(1)).toBe(7);
  });
});

describe("#171 calculateShortestPathsFrom — bounded runs", () => {
  test("bound B completes exactly the vertices with distance < B (seeded)", () => {
    const edges = sparseRandom(500, 3, 7303);
    const nodeIDs = new BMSSP(edges).nodeIDs;
    const nodes = [...nodeIDs].sort((a, b) => a - b);
    const source = nodes[0];
    const oracle = dijkstra(edges, nodeIDs, source);
    const finite = [...oracle.values()]
      .filter((d) => d < Infinity)
      .sort((a, b) => a - b);
    // Bound between two existing distances so no vertex ties it.
    const B =
      (finite[Math.floor(finite.length * 0.5)] +
        finite[Math.floor(finite.length * 0.5) + 1]) /
      2;

    const g = new BMSSP(edges);
    g.calculateShortestPathsFrom([source], { bound: B });
    for (const v of nodeIDs) {
      const trueD = oracle.get(v);
      if (trueD < B) {
        expect(g.shortestPaths.get(v)).toBe(trueD);
      } else {
        expect(g.shortestPaths.get(v)).toBe(Infinity);
      }
    }
  });

  test("bound = 0 completes nothing (even the source, at distance 0, is not < 0)", () => {
    const g = new BMSSP(HAND);
    g.calculateShortestPathsFrom([0], { bound: 0 });
    for (const v of g.nodeIDs) {
      expect(g.shortestPaths.get(v)).toBe(Infinity);
    }
  });

  test("default bound is Infinity (unbounded)", () => {
    const g = new BMSSP(HAND);
    g.calculateShortestPathsFrom([0]);
    // node 4 reachable from 0 via 0->1->2->3->4 = 10
    expect(g.shortestPaths.get(4)).toBe(10);
  });
});

describe("#171 calculateShortestPathsFrom — input shapes agree", () => {
  test("Map, object, [id,dist] pairs, and bare ids give identical results", () => {
    const initialPairs = [
      [0, 0],
      [5, 3],
    ];
    const asMap = new BMSSP(HAND);
    asMap.calculateShortestPathsFrom(new Map(initialPairs));

    const asObject = new BMSSP(HAND);
    asObject.calculateShortestPathsFrom({ 0: 0, 5: 3 });

    const asPairs = new BMSSP(HAND);
    asPairs.calculateShortestPathsFrom(initialPairs);

    for (const v of asMap.nodeIDs) {
      expect(asObject.shortestPaths.get(v)).toBe(asMap.shortestPaths.get(v));
      expect(asPairs.shortestPaths.get(v)).toBe(asMap.shortestPaths.get(v));
    }

    // Bare-id form (all distance 0) matches a pairs form with explicit zeros.
    const bareIds = new BMSSP(HAND);
    bareIds.calculateShortestPathsFrom([0, 5]);
    const zeros = new BMSSP(HAND);
    zeros.calculateShortestPathsFrom([
      [0, 0],
      [5, 0],
    ]);
    for (const v of bareIds.nodeIDs) {
      expect(bareIds.shortestPaths.get(v)).toBe(zeros.shortestPaths.get(v));
    }
  });
});

describe("#171 calculateShortestPathsFrom — integration", () => {
  test("reconstructPath works after a multi-source run", () => {
    const g = new BMSSP(HAND);
    g.calculateShortestPathsFrom([0, 5]);
    // 4 is reached from source 5 (5->4, dist 1)
    expect(g.reconstructPath(4)).toEqual([5, 4]);
    // 6 hangs off 4
    expect(g.reconstructPath(6)).toEqual([5, 4, 6]);
    // 1 is reached from source 0
    expect(g.reconstructPath(1)).toEqual([0, 1]);
  });

  test("state resets between calls and after calculateShortestPaths", () => {
    const g = new BMSSP(HAND);
    g.calculateShortestPaths(0);
    expect(g.shortestPaths.get(4)).toBe(10);
    // Switch to the other source only.
    g.calculateShortestPathsFrom([5]);
    expect(g.shortestPaths.get(4)).toBe(1);
    // node 1 is unreachable from 5 alone.
    expect(g.shortestPaths.get(1)).toBe(Infinity);
    // Back to single-source via the new entrypoint.
    g.calculateShortestPathsFrom([0]);
    expect(g.shortestPaths.get(4)).toBe(10);
    expect(g.shortestPaths.get(1)).toBe(2);
  });

  test("isolated declared vertex is valid as a source (reaches only itself)", () => {
    const g = new BMSSP(
      new Map([
        [0, [[1, 5]]],
        [9, []],
      ]),
    );
    g.calculateShortestPathsFrom([9]);
    expect(g.shortestPaths.get(9)).toBe(0);
    expect(g.shortestPaths.get(0)).toBe(Infinity);
    expect(g.shortestPaths.get(1)).toBe(Infinity);
  });
});

describe("#171 calculateShortestPathsFrom — validation", () => {
  test("unknown source id throws", () => {
    const g = new BMSSP(HAND);
    expect(() => g.calculateShortestPathsFrom([999])).toThrow(
      /Source 999 not found/,
    );
  });

  test("negative, NaN, and non-finite initial distances throw", () => {
    const g = new BMSSP(HAND);
    expect(() => g.calculateShortestPathsFrom([[0, -1]])).toThrow(
      /non-negative finite/,
    );
    expect(() => g.calculateShortestPathsFrom([[0, NaN]])).toThrow(
      /non-negative finite/,
    );
    expect(() => g.calculateShortestPathsFrom([[0, Infinity]])).toThrow(
      /non-negative finite/,
    );
  });

  test("malformed source pair throws", () => {
    const g = new BMSSP(HAND);
    expect(() => g.calculateShortestPathsFrom([[0, 1, 2]])).toThrow(
      /Each source pair/,
    );
  });

  test("empty source set throws", () => {
    const g = new BMSSP(HAND);
    expect(() => g.calculateShortestPathsFrom([])).toThrow(
      /At least one source/,
    );
    expect(() => g.calculateShortestPathsFrom(new Map())).toThrow(
      /At least one source/,
    );
  });

  test("unrecognized sources shape throws", () => {
    const g = new BMSSP(HAND);
    expect(() => g.calculateShortestPathsFrom(42)).toThrow(/sources must be/);
    expect(() => g.calculateShortestPathsFrom(null)).toThrow(/sources must be/);
  });

  test("negative or NaN bound throws", () => {
    const g = new BMSSP(HAND);
    expect(() => g.calculateShortestPathsFrom([0], { bound: -5 })).toThrow(
      /bound must be/,
    );
    expect(() => g.calculateShortestPathsFrom([0], { bound: NaN })).toThrow(
      /bound must be/,
    );
    expect(() => g.calculateShortestPathsFrom([0], { bound: "10" })).toThrow(
      /bound must be/,
    );
  });

  test("object with a non-numeric key throws (coerces to NaN, unknown source)", () => {
    const g = new BMSSP(HAND);
    expect(() => g.calculateShortestPathsFrom({ notANode: 0 })).toThrow(
      /Source NaN not found/,
    );
  });
});
