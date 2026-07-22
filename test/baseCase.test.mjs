import { describe, test, expect } from "@jest/globals";
import { baseCase } from "../src/baseCase.mjs";
import { BMSSP } from "../src/bmssp.mjs";
import { dijkstra } from "../src/dijkstra.mjs";
import { compareKeys, labelKey } from "../src/tieBreak.mjs";
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

// Build the engine state BaseCase runs against (#205): a BMSSP instance
// provides the CSR + typed-array labels; the source is marked complete at
// distance 0 directly in the engine arrays
function setup(edges, source) {
  const g = new BMSSP(edges);
  g.labels.dist[g.indexOf.get(source)] = 0;
  return g;
}

// id <-> index helpers: baseCase speaks dense indices since #205
const idx = (g, v) => g.indexOf.get(v);
const idxSet = (g, vs) => new Set(vs.map((v) => g.indexOf.get(v)));
const idsOf = (g, indices) => new Set([...indices].map((i) => g.ids[i]));
const distOf = (g, v) => g.labels.dist[g.indexOf.get(v)];

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
    const g = setup([[0, 1, 1]], 0);
    expect(() =>
      baseCase(Infinity, idxSet(g, [0]), g.labels, g.csr, 0),
    ).toThrow("k must be a number >= 1");
    expect(() =>
      baseCase(Infinity, idxSet(g, [0]), g.labels, g.csr, NaN),
    ).toThrow("k must be a number >= 1");
  });

  test("rejects an S that is not a singleton", () => {
    const g = setup([[0, 1, 1]], 0);
    expect(() => baseCase(Infinity, new Set(), g.labels, g.csr, 2)).toThrow(
      "S must contain exactly one source node",
    );
    expect(() =>
      baseCase(Infinity, idxSet(g, [0, 1]), g.labels, g.csr, 2),
    ).toThrow("S must contain exactly one source node");
  });

  test("rejects a source without a finite distance estimate", () => {
    // No setup(): every d̂ stays Infinity, so the source is not complete
    const g = new BMSSP([[0, 1, 1]]);
    expect(() =>
      baseCase(Infinity, idxSet(g, [0]), g.labels, g.csr, 2),
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
    const g = setup(edges, 0);
    const result = baseCase(Infinity, idxSet(g, [0]), g.labels, g.csr, 10);
    expect(result.bound).toBe(Infinity);
    expect(idsOf(g, result.vertices)).toEqual(new Set([0, 1, 2, 3]));
    expect(distOf(g, 0)).toBe(0);
    expect(distOf(g, 1)).toBe(2);
    expect(distOf(g, 2)).toBe(3);
    expect(distOf(g, 3)).toBe(4);
    // Node 4 is not reachable from 0 and must stay untouched
    expect(distOf(g, 4)).toBe(Infinity);
  });

  test("a finite B keeps distances >= B out of the result and out of d̂", () => {
    const g = setup(edges, 0);
    const result = baseCase(4, idxSet(g, [0]), g.labels, g.csr, 10);
    // d(3) = 4 is not < B, so 3 is neither settled nor even relaxed
    expect(result.bound).toBe(4);
    expect(idsOf(g, result.vertices)).toEqual(new Set([0, 1, 2]));
    expect(distOf(g, 3)).toBe(Infinity);
  });

  test("a source with no outgoing edges succeeds with just itself", () => {
    const g = setup(edges, 3);
    const result = baseCase(Infinity, idxSet(g, [3]), g.labels, g.csr, 5);
    expect(result.bound).toBe(Infinity);
    expect(idsOf(g, result.vertices)).toEqual(new Set([3]));
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
    const g = setup(edges, 0);
    const result = baseCase(Infinity, idxSet(g, [0]), g.labels, g.csr, 2);
    // Settled = {0, 1, 2} (k + 1 = 3 vertices), so B' = d̂(2) = 2
    expect(result.bound).toBe(2);
    expect(idsOf(g, result.vertices)).toEqual(new Set([0, 1]));
    expect(distOf(g, 0)).toBe(0);
    expect(distOf(g, 1)).toBe(1);
    expect(distOf(g, 2)).toBe(2);
  });

  test("boundary ties are broken deterministically by the composite order (#163)", () => {
    const edges = [
      [0, 1, 5],
      [0, 2, 5],
      [0, 3, 5],
    ];
    // Node ids 0..3 are contiguous, so dense indices coincide with ids and
    // the boundary key below is in both spaces at once
    const g = setup(edges, 0);
    const result = baseCase(Infinity, idxSet(g, [0]), g.labels, g.csr, 2);
    // Settled = {0} plus the two smallest-keyed distance-5 leaves (1, 2);
    // the boundary is leaf 2's key [5, 1, 2] and the strictly-closer filter
    // keeps leaf 1 — under scalar ties, smaller ids settle first. (Before
    // #163 every tied leaf was excluded and only the source came back.)
    expect(result.bound).toBe(5);
    expect(result.boundKey).toEqual([5, 1, 2]);
    expect(idsOf(g, result.vertices)).toEqual(new Set([0, 1]));
  });

  test("the k + 1 cap still respects the bound B", () => {
    const edges = [
      [0, 1, 1],
      [1, 2, 1],
      [2, 3, 1],
    ];
    const g = setup(edges, 0);
    const result = baseCase(2, idxSet(g, [0]), g.labels, g.csr, 1);
    // k + 1 = 2 settled: {0, 1}; B' = d̂(1) = 1 < B = 2
    expect(result.bound).toBe(1);
    expect(idsOf(g, result.vertices)).toEqual(new Set([0]));
    expect(distOf(g, 3)).toBe(Infinity);
  });
});

describe("baseCase equal-sum relaxations", () => {
  test("a zero-weight cycle terminates and settles correctly", () => {
    const edges = [
      [0, 1, 0],
      [1, 0, 0],
      [1, 2, 1],
    ];
    const g = setup(edges, 0);
    const result = baseCase(Infinity, idxSet(g, [0]), g.labels, g.csr, 10);
    expect(result.bound).toBe(Infinity);
    expect(idsOf(g, result.vertices)).toEqual(new Set([0, 1, 2]));
    expect(distOf(g, 1)).toBe(0);
    expect(distOf(g, 2)).toBe(1);
  });

  test("two equal-length paths to the same vertex settle it once", () => {
    const edges = [
      [0, 1, 1],
      [0, 2, 1],
      [1, 3, 1],
      [2, 3, 1],
    ];
    const g = setup(edges, 0);
    const result = baseCase(Infinity, idxSet(g, [0]), g.labels, g.csr, 10);
    expect(idsOf(g, result.vertices)).toEqual(new Set([0, 1, 2, 3]));
    expect(distOf(g, 3)).toBe(2);
  });
});

describe("baseCase vs Dijkstra oracle (seeded)", () => {
  test("full success on random graphs matches the reachable set exactly", () => {
    const rand = mulberry32(40);
    for (let round = 0; round < 20; round += 1) {
      const edges = randomEdges(rand, 40, 160);
      const g = setup(edges, 0);
      const oracle = dijkstra(edgesOf(g), g.nodeIDs, 0);
      const result = baseCase(
        Infinity,
        idxSet(g, [0]),
        g.labels,
        g.csr,
        g.nodeIDs.size,
      );
      expect(result.bound).toBe(Infinity);
      const reachable = new Set(
        [...oracle].filter(([, d]) => d < Infinity).map(([v]) => v),
      );
      expect(idsOf(g, result.vertices)).toEqual(reachable);
      for (const v of idsOf(g, result.vertices)) {
        expect(distOf(g, v)).toBe(oracle.get(v));
      }
    }
  });

  test("bounded, capped runs keep the Algorithm 2 contract", () => {
    const rand = mulberry32(41);
    for (let round = 0; round < 30; round += 1) {
      const edges = randomEdges(rand, 50, 200);
      const g = setup(edges, 0);
      const oracle = dijkstra(edgesOf(g), g.nodeIDs, 0);
      const finite = [...oracle.values()]
        .filter((d) => d < Infinity)
        .sort((a, b) => a - b);
      // A bound somewhere inside the distance distribution, and a small cap
      const B = finite[Math.floor(finite.length * 0.6)] + 0.5;
      const k = 1 + Math.floor(rand() * 8);
      const result = baseCase(B, idxSet(g, [0]), g.labels, g.csr, k);
      // B' never exceeds B, and B' = B means full success under the bound
      expect(result.bound).toBeLessThanOrEqual(B);
      // Every returned vertex is complete (d̂ = true distance) and strictly
      // below B' in the composite order (#163) — in the scalar view a
      // returned vertex may tie the boundary's length, never exceed it
      for (const i of result.vertices) {
        const v = g.ids[i];
        expect(distOf(g, v)).toBe(oracle.get(v));
        expect(oracle.get(v)).toBeLessThanOrEqual(result.bound);
        expect(
          compareKeys(labelKey(i, g.labels), result.boundKey),
        ).toBeLessThan(0);
      }
      // Completeness: everything with a true distance below B' is returned
      for (const [v, d] of oracle) {
        if (d < result.bound) {
          expect(result.vertices.has(idx(g, v))).toBe(true);
        }
      }
      // d̂ never underestimates the true distance anywhere
      for (const v of g.nodeIDs) {
        expect(distOf(g, v)).toBeGreaterThanOrEqual(oracle.get(v));
      }
    }
  });
});
