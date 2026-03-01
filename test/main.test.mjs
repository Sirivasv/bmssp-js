import { describe, test, expect } from "@jest/globals";
import { BMSSP, dijkstra } from "../index.mjs";
import fs from "fs";

// Load the roadNet-CA.txt graph and parse it into an array of edges
let roadNetCA = (() => {
  let graph = [];
  const filePath = new URL("./roadNet-CA.txt", import.meta.url).pathname;
  const data = fs.readFileSync(filePath, "utf-8");
  data.split("\n").forEach((line) => {
    if (line.startsWith("#") || line.trim() === "") return;
    const [from, to] = line.trim().split(/\s+/).map(Number);
    if (!isNaN(from) && !isNaN(to)) {
      let min = 1,
        max = 1e8;
      let randomWeight = Math.floor(Math.random() * (max - min + 1)) + min;
      graph.push([from, to, randomWeight]);
    }
  });
  return graph;
})();

// Have an initialized BMSSP instance for tests
const myBMSSP = new BMSSP(roadNetCA);

describe("BMSSP constructor", () => {
  test("initializes the graph correctly", () => {
    expect(myBMSSP.graph).toEqual(roadNetCA);
  });
});

describe("BMSSP nodeIDs", () => {
  test("stores unique node IDs correctly", () => {
    const uniqueNodeIDs = new Set();
    roadNetCA.forEach((edge) => {
      uniqueNodeIDs.add(edge[0]);
      uniqueNodeIDs.add(edge[1]);
    });
    expect(myBMSSP.nodeIDs).toEqual(uniqueNodeIDs);
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
      dijkstra(roadNetCA, myBMSSP.nodeIDs, invalidSource);
    }).toThrow("Source node not found in nodeIDs");
  });
});

describe("BMSSP vs Dijkstra shortest paths", () => {
  test("shortest paths from a fixed source match between BMSSP and Dijkstra", () => {
    const nodeArray = [...myBMSSP.nodeIDs];
    const source = nodeArray[0];

    myBMSSP.calculateShortestPaths(source);
    const dijkstraPaths = dijkstra(roadNetCA, myBMSSP.nodeIDs, source);

    expect(myBMSSP.shortestPaths.size).toBe(dijkstraPaths.size);
    for (const [nodeId, distance] of myBMSSP.shortestPaths) {
      expect(dijkstraPaths.get(nodeId)).toBe(distance);
    }
  });
});
