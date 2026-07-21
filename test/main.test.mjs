import { describe, test, expect } from "@jest/globals";
import { BMSSP, dijkstra } from "../index.mjs";
import { sparseRandom } from "../benchmarks/generators.mjs";

// Seeded medium-size sparse graph (m = O(n) — the regime the paper targets).
// It replaces the old 87 MB roadNet-CA.txt fixture: the same full-map
// BMSSP-vs-Dijkstra contract, but reproducible (fixed seed instead of
// unseeded random weights) and orders of magnitude faster. Even at this size
// the recursion already runs at topLevel = 3, the same depth a 2M-node graph
// reaches; larger seeded scale runs live in test/fuzz.test.mjs.
const mediumSparse = sparseRandom(10_000, 3, 1601);

// Have an initialized BMSSP instance for tests
const myBMSSP = new BMSSP(mediumSparse);

describe("BMSSP constructor", () => {
  test("initializes the graph correctly", () => {
    expect(myBMSSP.graph).toEqual(mediumSparse);
  });

  test("rejects an unrecognized input graph type", () => {
    // #172: arrays, adjacency maps/objects, and Graph builders are accepted;
    // a bare string is none of those.
    expect(() => new BMSSP("not an edge array")).toThrow(
      "Input graph must be an edge array, an adjacency map/object, or a Graph instance",
    );
  });

  test("rejects malformed edges", () => {
    expect(() => new BMSSP([[0, 1]])).toThrow(
      "Edge at index 0 must be [from, to, weight]",
    );
  });

  test("rejects non-numeric node IDs", () => {
    expect(() => new BMSSP([["0", 1, 5]])).toThrow(
      "Edge at index 0 must have numeric node IDs",
    );
  });

  test("rejects negative weights", () => {
    expect(() => new BMSSP([[0, 1, -1]])).toThrow(
      "Edge at index 0 must have a non-negative numeric weight",
    );
  });
});

describe("BMSSP nodeIDs", () => {
  test("stores unique node IDs correctly", () => {
    const uniqueNodeIDs = new Set();
    mediumSparse.forEach((edge) => {
      uniqueNodeIDs.add(edge[0]);
      uniqueNodeIDs.add(edge[1]);
    });
    expect(myBMSSP.nodeIDs).toEqual(uniqueNodeIDs);
  });
});

describe("BMSSP adjacency map", () => {
  test("groups outgoing edges by source node", () => {
    const small = new BMSSP([
      [0, 1, 50],
      [1, 2, 75],
      [0, 2, 25],
    ]);
    expect(small.adjacency.get(0)).toEqual([
      [1, 50],
      [2, 25],
    ]);
    expect(small.adjacency.get(1)).toEqual([[2, 75]]);
  });

  test("gives sink nodes an empty edge array", () => {
    const small = new BMSSP([
      [0, 1, 50],
      [1, 2, 75],
      [0, 2, 25],
    ]);
    // node 2 has no outgoing edges but is still a known node
    expect(small.adjacency.has(2)).toBe(true);
    expect(small.adjacency.get(2)).toEqual([]);
  });

  test("has one entry per unique node ID", () => {
    expect(myBMSSP.adjacency.size).toBe(myBMSSP.nodeIDs.size);
  });

  test("preserves the total number of edges across all adjacency lists", () => {
    let edgeCount = 0;
    for (const edges of myBMSSP.adjacency.values()) {
      edgeCount += edges.length;
    }
    expect(edgeCount).toBe(mediumSparse.length);
  });

  test("getEdges returns a node's edges and [] for unknown nodes", () => {
    const small = new BMSSP([
      [0, 1, 50],
      [0, 2, 25],
    ]);
    expect(small.getEdges(0)).toEqual([
      [1, 50],
      [2, 25],
    ]);
    expect(small.getEdges(999)).toEqual([]);
  });
});

describe("BMSSP shortestPaths", () => {
  test("initializes shortest paths with Infinity", () => {
    const expectedShortestPaths = new Map();
    myBMSSP.nodeIDs.forEach((nodeId) => {
      expectedShortestPaths.set(nodeId, Infinity);
    });
    expect(myBMSSP.shortestPaths).toEqual(expectedShortestPaths);
  });
});

describe("BMSSP initialize calculateShortestPaths", () => {
  test("sets the distance to the start node to 0", () => {
    const startNode = [...myBMSSP.nodeIDs][0];
    myBMSSP.calculateShortestPaths(startNode);
    expect(myBMSSP.shortestPaths.get(startNode)).toBe(0);
  });
  test("throws an error if the start node is not in the graph", () => {
    const invalidStartNode = -1; // Assuming -1 is not a valid node ID in the graph
    expect(() => {
      myBMSSP.calculateShortestPaths(invalidStartNode);
    }).toThrow("Start node not found in the graph");
  });
});

describe("dijkstra source validation", () => {
  test("throws an error if the source node is not in nodeIDs", () => {
    const invalidSource = -1; // Assuming -1 is not a valid node ID in the graph
    expect(() => {
      dijkstra(mediumSparse, myBMSSP.nodeIDs, invalidSource);
    }).toThrow("Source node not found in nodeIDs");
  });
});

describe("BMSSP vs Dijkstra shortest paths", () => {
  test("shortest paths from a fixed source match between BMSSP and Dijkstra", () => {
    const nodeArray = [...myBMSSP.nodeIDs];
    const source = nodeArray[0];

    myBMSSP.calculateShortestPaths(source);
    const dijkstraPaths = dijkstra(mediumSparse, myBMSSP.nodeIDs, source);

    expect(myBMSSP.shortestPaths.size).toBe(dijkstraPaths.size);
    for (const [nodeId, distance] of myBMSSP.shortestPaths) {
      expect(dijkstraPaths.get(nodeId)).toBe(distance);
    }
  });
});
