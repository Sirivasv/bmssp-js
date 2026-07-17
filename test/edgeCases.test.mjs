import { describe, test, expect } from "@jest/globals";
import { BMSSP } from "../src/bmssp.mjs";
import { dijkstra } from "../src/dijkstra.mjs";

// Deterministic edge-case fixtures for disconnected graphs and unreachable
// nodes (#162). Every graph is hand-built and every expected distance map is
// hand-verifiable; the randomized side of this coverage (disconnected
// forests across shapes and sources) lives in fuzz.test.mjs (#161).

// Run BMSSP from source, then require the full distance map to equal both
// the hand-computed expectation and the Dijkstra oracle — including the
// Infinity entries for unreachable vertices.
function expectDistances(edges, source, expected) {
  const bmssp = new BMSSP(edges);
  bmssp.calculateShortestPaths(source);

  const oracle = dijkstra(bmssp.graph, bmssp.nodeIDs, source);
  expect(bmssp.shortestPaths.size).toBe(oracle.size);
  for (const [v, d] of oracle) {
    expect(bmssp.shortestPaths.get(v)).toBe(d);
  }

  expect(bmssp.shortestPaths.size).toBe(expected.size);
  for (const [v, d] of expected) {
    expect(bmssp.shortestPaths.get(v)).toBe(d);
  }
  return bmssp;
}

describe("Edge cases (#162): isolated and sink sources", () => {
  test("a source whose only edge is a self-loop reaches nothing else", () => {
    const bmssp = expectDistances(
      [
        [0, 0, 7],
        [1, 2, 3],
      ],
      0,
      new Map([
        [0, 0],
        [1, Infinity],
        [2, Infinity],
      ]),
    );
    // The self-loop is the node's only outgoing edge
    expect(bmssp.getEdges(0)).toEqual([[0, 7]]);
  });

  test("a sink source (no outgoing edges) reaches only itself", () => {
    // Node 1 only ever appears as an edge target
    const bmssp = expectDistances(
      [
        [0, 1, 5],
        [2, 1, 4],
      ],
      1,
      new Map([
        [0, Infinity],
        [1, 0],
        [2, Infinity],
      ]),
    );
    // The adjacency map still knows the sink — with an empty edge list
    expect(bmssp.getEdges(1)).toEqual([]);
    expect(bmssp.adjacency.has(1)).toBe(true);
  });

  test("an empty graph rejects every start node", () => {
    const bmssp = new BMSSP([]);
    expect(bmssp.nodeIDs.size).toBe(0);
    expect(() => {
      bmssp.calculateShortestPaths(0);
    }).toThrow("Start node not found in the graph");
  });
});

describe("Edge cases (#162): many components, one source", () => {
  test("single-node components (self-loops) stay isolated from each other", () => {
    const edges = [];
    for (let node = 0; node < 5; node += 1) edges.push([node, node, 1]);
    const expected = new Map([
      [0, Infinity],
      [1, Infinity],
      [2, 0],
      [3, Infinity],
      [4, Infinity],
    ]);
    expectDistances(edges, 2, expected);
  });

  test("ten 3-node chain components: only the source's chain gets finite distances", () => {
    // Component c holds nodes 3c -> 3c+1 -> 3c+2 with weights c+1, c+2
    const edges = [];
    for (let c = 0; c < 10; c += 1) {
      edges.push([3 * c, 3 * c + 1, c + 1]);
      edges.push([3 * c + 1, 3 * c + 2, c + 2]);
    }
    const expected = new Map();
    for (let node = 0; node < 30; node += 1) expected.set(node, Infinity);
    // Source 9 heads component c = 3: distances 0, 4, 4 + 5
    expected.set(9, 0);
    expected.set(10, 4);
    expected.set(11, 9);
    expectDistances(edges, 9, expected);
  });

  test("an edge pointing INTO the source's component leaves its origin unreachable", () => {
    // 5 -> 0 bridges the components in the wrong direction for source 0
    expectDistances(
      [
        [0, 1, 2],
        [5, 0, 1],
        [5, 6, 1],
      ],
      0,
      new Map([
        [0, 0],
        [1, 2],
        [5, Infinity],
        [6, Infinity],
      ]),
    );
  });
});

describe("Edge cases (#162): tiny component beside a giant one", () => {
  // One 2-node component {0, 1} and a 100-node chain 100 -> 101 -> ... -> 199
  function twoIslands() {
    const edges = [[0, 1, 3]];
    for (let i = 0; i < 99; i += 1) edges.push([100 + i, 101 + i, 1]);
    return edges;
  }

  test("source in the tiny component: the giant chain stays at Infinity", () => {
    const expected = new Map([
      [0, 0],
      [1, 3],
    ]);
    for (let i = 0; i < 100; i += 1) expected.set(100 + i, Infinity);
    expectDistances(twoIslands(), 0, expected);
  });

  test("source in the giant chain: prefix-sum distances, tiny component at Infinity", () => {
    const expected = new Map([
      [0, Infinity],
      [1, Infinity],
    ]);
    for (let i = 0; i < 100; i += 1) expected.set(100 + i, i);
    const bmssp = expectDistances(twoIslands(), 100, expected);
    // The chain's last node is a sink the adjacency map handles cleanly
    expect(bmssp.getEdges(199)).toEqual([]);
  });
});

describe("Edge cases (#162): re-running across components of one instance", () => {
  test("switching the source between components resets all state cleanly", () => {
    // Component A: 0 -> 1 -> 2; component B: 10 -> 11
    const bmssp = new BMSSP([
      [0, 1, 1],
      [1, 2, 1],
      [10, 11, 7],
    ]);
    const fromA = new Map([
      [0, 0],
      [1, 1],
      [2, 2],
      [10, Infinity],
      [11, Infinity],
    ]);
    const fromB = new Map([
      [0, Infinity],
      [1, Infinity],
      [2, Infinity],
      [10, 0],
      [11, 7],
    ]);
    // A -> B -> A again: no distance may leak from the previous run
    for (const expected of [fromA, fromB, fromA]) {
      const source = expected.get(0) === 0 ? 0 : 10;
      bmssp.calculateShortestPaths(source);
      expect(bmssp.shortestPaths.size).toBe(expected.size);
      for (const [v, d] of expected) {
        expect(bmssp.shortestPaths.get(v)).toBe(d);
      }
    }
  });
});
