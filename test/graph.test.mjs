import { describe, test, expect } from "@jest/globals";
import { BMSSP, Graph, dijkstra } from "../index.mjs";
import { sparseRandom } from "../benchmarks/generators.mjs";

// #172 — typed / flexible graph inputs. The BMSSP constructor now accepts an
// edge array (unchanged), an adjacency Map/object, or a Graph builder, and
// callers can declare an explicit vertex universe including isolated nodes.
// The correctness contract is unchanged: whatever the input shape, distances
// must equal the Dijkstra oracle over the same logical graph.

const EDGES = [
  [0, 1, 7],
  [0, 2, 9],
  [0, 5, 14],
  [1, 2, 10],
  [1, 3, 15],
  [2, 3, 11],
  [2, 5, 2],
  [3, 4, 6],
  [5, 4, 9],
];

function distancesFromEdges(edges, source) {
  const bmssp = new BMSSP(edges);
  bmssp.calculateShortestPaths(source);
  return new Map(bmssp.shortestPaths);
}

describe("Graph builder", () => {
  test("addEdge / addVertex chain and count declared elements", () => {
    const g = new Graph().addEdge(0, 1, 50).addEdge(1, 2, 75).addVertex(9);
    expect(g.edgeCount).toBe(2);
    expect(g.vertexCount).toBe(4); // 0, 1, 2, 9
    expect(g.hasVertex(9)).toBe(true);
    expect(g.hasVertex(7)).toBe(false);
  });

  test("addVertex is idempotent and addEdge auto-declares endpoints", () => {
    const g = new Graph();
    g.addVertex(3);
    g.addVertex(3);
    g.addEdge(3, 4, 1);
    expect(g.vertexCount).toBe(2); // 3, 4
    expect(g.hasVertex(4)).toBe(true);
  });

  test("toNormalized returns copies decoupled from later mutation", () => {
    const g = new Graph().addEdge(0, 1, 5);
    const snap = g.toNormalized();
    g.addEdge(1, 2, 6);
    g.addVertex(8);
    expect(snap.edges).toEqual([[0, 1, 5]]);
    expect(snap.vertices).toEqual([0, 1]);
    // mutating the snapshot must not reach back into the builder
    snap.edges[0][2] = 999;
    expect(g.toNormalized().edges[0]).toEqual([0, 1, 5]);
  });

  test("validates node ids and weights eagerly at the call site", () => {
    expect(() => new Graph().addVertex("x")).toThrow(/finite number/);
    expect(() => new Graph().addVertex(Infinity)).toThrow(/finite number/);
    expect(() => new Graph().addEdge(0, NaN, 1)).toThrow(/finite numbers/);
    expect(() => new Graph().addEdge(0, 1, -1)).toThrow(/non-negative/);
    expect(() => new Graph().addEdge(0, 1, Infinity)).toThrow(/non-negative/);
  });

  test("BMSSP accepts a Graph and matches the edge-array result", () => {
    const g = new Graph();
    for (const [from, to, weight] of EDGES) g.addEdge(from, to, weight);
    const viaGraph = new BMSSP(g);
    viaGraph.calculateShortestPaths(0);
    expect(new Map(viaGraph.shortestPaths)).toEqual(
      distancesFromEdges(EDGES, 0),
    );
  });
});

describe("adjacency inputs", () => {
  test("adjacency object matches the edge-array result", () => {
    const adjacency = {};
    for (const [from, to, weight] of EDGES) {
      (adjacency[from] ??= []).push([to, weight]);
    }
    const bmssp = new BMSSP(adjacency);
    bmssp.calculateShortestPaths(0);
    expect(new Map(bmssp.shortestPaths)).toEqual(distancesFromEdges(EDGES, 0));
  });

  test("adjacency Map matches the edge-array result", () => {
    const adjacency = new Map();
    for (const [from, to, weight] of EDGES) {
      if (!adjacency.has(from)) adjacency.set(from, []);
      adjacency.get(from).push([to, weight]);
    }
    const bmssp = new BMSSP(adjacency);
    bmssp.calculateShortestPaths(0);
    expect(new Map(bmssp.shortestPaths)).toEqual(distancesFromEdges(EDGES, 0));
  });

  test("object keys are coerced to numeric node ids", () => {
    // Object keys are strings; they must normalize back to the numeric ids
    // the rest of the API uses.
    const bmssp = new BMSSP({ 0: [[1, 4]], 1: [[2, 6]] });
    bmssp.calculateShortestPaths(0);
    expect(bmssp.shortestPaths.get(2)).toBe(10);
    expect([...bmssp.nodeIDs].sort((a, b) => a - b)).toEqual([0, 1, 2]);
  });

  test("a key with an empty neighbor list declares an isolated vertex", () => {
    const bmssp = new BMSSP(
      new Map([
        [0, [[1, 3]]],
        [5, []],
      ]),
    );
    expect(bmssp.nodeIDs.has(5)).toBe(true);
    bmssp.calculateShortestPaths(0);
    expect(bmssp.shortestPaths.get(5)).toBe(Infinity);
  });

  test("a null/absent neighbor value declares an isolated vertex", () => {
    const bmssp = new BMSSP({ 0: [[1, 3]], 5: null });
    expect(bmssp.nodeIDs.has(5)).toBe(true);
    bmssp.calculateShortestPaths(0);
    expect(bmssp.shortestPaths.get(5)).toBe(Infinity);
  });
});

describe("explicit vertex universe", () => {
  test("a declared isolated vertex is unreachable but present", () => {
    const g = new Graph().addEdge(0, 1, 3).addVertex(42);
    const bmssp = new BMSSP(g);
    expect(bmssp.nodeIDs.has(42)).toBe(true);
    bmssp.calculateShortestPaths(0);
    expect(bmssp.shortestPaths.get(42)).toBe(Infinity);
    expect(bmssp.reconstructPath(42)).toEqual([]);
  });

  test("an isolated vertex is a valid source reaching only itself", () => {
    const g = new Graph().addEdge(0, 1, 3).addVertex(42);
    const bmssp = new BMSSP(g);
    bmssp.calculateShortestPaths(42);
    expect(bmssp.shortestPaths.get(42)).toBe(0);
    expect(bmssp.shortestPaths.get(0)).toBe(Infinity);
    expect(bmssp.shortestPaths.get(1)).toBe(Infinity);
  });

  test("declared vertices are validated for finiteness", () => {
    // Graph guards addVertex, but the adjacency object path can smuggle a
    // non-numeric key; the constructor must reject it.
    expect(() => new BMSSP({ abc: [] })).toThrow(/finite numbers/);
  });
});

describe("input validation across shapes", () => {
  test("unrecognized top-level input types throw", () => {
    expect(() => new BMSSP(42)).toThrow(/edge array, an adjacency/);
    expect(() => new BMSSP("nope")).toThrow(/edge array, an adjacency/);
    expect(() => new BMSSP(null)).toThrow(/edge array, an adjacency/);
  });

  test("malformed adjacency entries throw a clear message", () => {
    expect(() => new BMSSP({ 0: [[1]] })).toThrow(/\[to, weight\]/);
    expect(() => new BMSSP({ 0: 5 })).toThrow(/iterable of \[to, weight\]/);
  });

  test("edge-array validation is unchanged (indexed messages)", () => {
    expect(
      () =>
        new BMSSP([
          [0, 1, 5],
          [0, 2],
        ]),
    ).toThrow(/Edge at index 1 must be \[from, to, weight\]/);
    expect(() => new BMSSP([[0, 1, -5]])).toThrow(
      /Edge at index 0 must have a non-negative numeric weight/,
    );
  });

  test("empty graphs remain valid across shapes", () => {
    expect(new BMSSP([]).nodeIDs.size).toBe(0);
    expect(new BMSSP({}).nodeIDs.size).toBe(0);
    expect(new BMSSP(new Map()).nodeIDs.size).toBe(0);
    expect(new BMSSP(new Graph()).nodeIDs.size).toBe(0);
  });
});

describe("cross-shape equivalence on seeded graphs (vs Dijkstra oracle)", () => {
  test("edge array, adjacency map, and Graph agree with the oracle", () => {
    const edges = sparseRandom(2_000, 3, 4242);
    const source = 0;

    const adjacencyMap = new Map();
    const g = new Graph();
    for (const [from, to, weight] of edges) {
      if (!adjacencyMap.has(from)) adjacencyMap.set(from, []);
      adjacencyMap.get(from).push([to, weight]);
      g.addEdge(from, to, weight);
    }

    const fromArray = new BMSSP(edges);
    fromArray.calculateShortestPaths(source);
    const oracle = dijkstra(fromArray.graph, fromArray.nodeIDs, source);

    for (const input of [adjacencyMap, g]) {
      const bmssp = new BMSSP(input);
      bmssp.calculateShortestPaths(source);
      for (const node of bmssp.nodeIDs) {
        expect(bmssp.shortestPaths.get(node)).toBe(oracle.get(node));
      }
    }
  });
});
