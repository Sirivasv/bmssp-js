import { describe, test, expect } from "@jest/globals";
import { BMSSP, dijkstra, constantDegreeTransform } from "../index.mjs";
import {
  sparseRandom,
  denseRandom,
  grid,
  chain,
  star,
} from "../benchmarks/generators.mjs";

// Constant-degree transform (#164): rewrite any graph to in/out-degree <= 2 by
// splitting each vertex into a zero-weight cycle of port copies, preserving
// every distance. The transform is opt-in — correctness of BMSSP does NOT
// depend on it — so these tests prove two things: the degree bound holds, and
// distances survive the rewrite, checked against the Dijkstra oracle on the
// original graph (the contract the issue asks for).

// In- and out-degree of every node in an edge array.
function degrees(edges) {
  const out = new Map();
  const inc = new Map();
  const bump = (map, id) => map.set(id, (map.get(id) ?? 0) + 1);
  const seen = (id) => {
    if (!out.has(id)) out.set(id, 0);
    if (!inc.has(id)) inc.set(id, 0);
  };
  for (const [from, to] of edges) {
    seen(from);
    seen(to);
    bump(out, from);
    bump(inc, to);
  }
  return { out, inc };
}

function expectDegreeBounded(edges) {
  const { out, inc } = degrees(edges);
  for (const d of out.values()) expect(d).toBeLessThanOrEqual(2);
  for (const d of inc.values()) expect(d).toBeLessThanOrEqual(2);
}

// Distances on the transformed graph, folded back onto original node IDs,
// must equal distances on the original graph — via the Dijkstra oracle.
// runner(edges, nodeIDs, source) returns a Map<nodeId, distance>.
function expectDistancePreserving(graph, runner) {
  const original = new BMSSP(graph);
  const t = constantDegreeTransform(graph);
  const transformed = new BMSSP(t.edges);

  for (const source of original.nodeIDs) {
    const expected = dijkstra(graph, original.nodeIDs, source);
    const rawTransformed = runner(
      t.edges,
      transformed.nodeIDs,
      t.sourceCopy(source),
    );
    const collapsed = t.collapse(rawTransformed);

    expect(collapsed.size).toBe(expected.size);
    for (const [node, distance] of expected) {
      expect(collapsed.get(node)).toBe(distance);
    }
  }
}

describe("constantDegreeTransform: degree bound", () => {
  test("brings a high-degree hub down to in/out-degree <= 2", () => {
    // Node 0 starts with out-degree 3 and in-degree 1.
    const { edges } = constantDegreeTransform([
      [0, 1, 5],
      [0, 2, 6],
      [0, 3, 7],
      [4, 0, 8],
    ]);
    expectDegreeBounded(edges);
  });

  test("caps degree on every seeded benchmark shape, including the star hub", () => {
    for (const graph of [
      sparseRandom(400, 3, 71),
      denseRandom(120, 16, 72),
      grid(12, 73),
      chain(300, 74),
      star(300, 75), // hub node 0 has degree ~2*(n-1) before the transform
    ]) {
      const { edges } = constantDegreeTransform(graph);
      expectDegreeBounded(edges);
    }
  });

  test("gives each vertex exactly one copy per incident edge endpoint", () => {
    // Node 0: two out-endpoints + one in-endpoint = 3 copies.
    const { copiesOf, originalOf } = constantDegreeTransform([
      [0, 1, 1],
      [0, 2, 1],
      [3, 0, 1],
    ]);
    expect(copiesOf.get(0).length).toBe(3);
    expect(copiesOf.get(1).length).toBe(1);
    expect(copiesOf.get(2).length).toBe(1);
    expect(copiesOf.get(3).length).toBe(1);
    // originalOf is the exact inverse of copiesOf.
    for (const [original, copies] of copiesOf) {
      for (const copy of copies) expect(originalOf.get(copy)).toBe(original);
    }
  });

  test("cycle edges are zero-weight; a single-copy vertex needs no cycle", () => {
    const { edges, copiesOf } = constantDegreeTransform([
      [0, 1, 4],
      [0, 2, 9],
    ]);
    // Node 0 has two copies -> a 2-cycle of zero-weight edges; nodes 1 and 2
    // are single copies with no cycle. So exactly two zero-weight edges.
    const zeroWeightEdges = edges.filter(([, , w]) => w === 0);
    expect(zeroWeightEdges.length).toBe(2);
    const [a, b] = copiesOf.get(0);
    expect(zeroWeightEdges).toEqual(
      expect.arrayContaining([
        [a, b, 0],
        [b, a, 0],
      ]),
    );
    expect(copiesOf.get(1).length).toBe(1);
  });
});

describe("constantDegreeTransform: distance preservation (Dijkstra oracle)", () => {
  test("a hand graph with a competing multi-hop path", () => {
    const graph = [
      [0, 1, 50],
      [1, 2, 75],
      [0, 2, 25],
    ];
    const t = constantDegreeTransform(graph);
    const transformed = new BMSSP(t.edges);
    const raw = dijkstra(t.edges, transformed.nodeIDs, t.sourceCopy(0));
    const collapsed = t.collapse(raw);
    expect(collapsed.get(0)).toBe(0);
    expect(collapsed.get(1)).toBe(50);
    expect(collapsed.get(2)).toBe(25);
  });

  test("preserves distances across every seeded benchmark shape", () => {
    for (const graph of [
      sparseRandom(300, 3, 81),
      denseRandom(90, 12, 82),
      grid(10, 83),
      chain(200, 84),
      star(200, 85),
    ]) {
      expectDistancePreserving(graph, dijkstra);
    }
  });

  test("handles self-loops and zero-weight original edges", () => {
    expectDistancePreserving(
      [
        [0, 0, 3], // self-loop
        [0, 1, 0], // zero-weight edge
        [1, 2, 5],
        [2, 1, 0],
      ],
      dijkstra,
    );
  });
});

describe("constantDegreeTransform: BMSSP runs on the transformed graph", () => {
  test("BMSSP on the transform matches the oracle on the original", () => {
    // Ties the transform to the real algorithm, not just the oracle.
    const runBMSSP = (edges, _nodeIDs, source) => {
      const bmssp = new BMSSP(edges);
      bmssp.calculateShortestPaths(source);
      return bmssp.shortestPaths;
    };
    for (const graph of [
      sparseRandom(250, 3, 91),
      grid(9, 92),
      star(150, 93),
    ]) {
      expectDistancePreserving(graph, runBMSSP);
    }
  });
});

describe("constantDegreeTransform: determinism and edge cases", () => {
  test("collapsed distances are invariant under edge-list permutation", () => {
    const graph = sparseRandom(200, 3, 101);
    const shuffled = [...graph].reverse();

    const base = new BMSSP(graph);
    const source = [...base.nodeIDs][0];

    const collapse = (g) => {
      const t = constantDegreeTransform(g);
      const transformed = new BMSSP(t.edges);
      const raw = dijkstra(t.edges, transformed.nodeIDs, t.sourceCopy(source));
      return t.collapse(raw);
    };

    const a = collapse(graph);
    const b = collapse(shuffled);
    expect(a.size).toBe(b.size);
    for (const [node, distance] of a) {
      expect(b.get(node)).toBe(distance);
    }
  });

  test("an empty graph transforms to an empty graph", () => {
    const t = constantDegreeTransform([]);
    expect(t.edges).toEqual([]);
    expect(t.copiesOf.size).toBe(0);
    expect(t.collapse(new Map()).size).toBe(0);
    expect(() => t.sourceCopy(0)).toThrow("Node 0 is not in the graph");
  });

  test("rejects malformed input like the BMSSP constructor", () => {
    expect(() => constantDegreeTransform("nope")).toThrow(
      "Input graph must be an array of edges",
    );
    expect(() => constantDegreeTransform([[0, 1]])).toThrow(
      "Edge at index 0 must be [from, to, weight]",
    );
    expect(() => constantDegreeTransform([["0", 1, 5]])).toThrow(
      "Edge at index 0 must have numeric node IDs",
    );
    expect(() => constantDegreeTransform([[0, 1, -1]])).toThrow(
      "Edge at index 0 must have a non-negative numeric weight",
    );
  });
});
