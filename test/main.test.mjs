import { describe, test, expect } from "@jest/globals";
import { BMSSP } from "../index.mjs";
import fs from "fs";

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

describe("BMSSP constructor", () => {
  test("initializes the graph correctly", () => {
    const myBMSSP = new BMSSP(roadNetCA);
    expect(myBMSSP.graph).toEqual(roadNetCA);
  });
});

describe("BMSSP nodeIDs", () => {
  test("stores unique node IDs correctly", () => {
    const myBMSSP = new BMSSP(roadNetCA);
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
    const myBMSSP = new BMSSP(roadNetCA);
    const expectedShortestPaths = new Map();
    myBMSSP.nodeIDs.forEach((nodeId) => {
      expectedShortestPaths.set(nodeId, Infinity);
    });
    expect(myBMSSP.shortestPaths).toEqual(expectedShortestPaths);
  });
});

describe("BMSSP initialize calculateShortestPaths", () => {
  test("sets the distance to the start node to 0", () => {
    const myBMSSP = new BMSSP(roadNetCA);
    const startNode = [...myBMSSP.nodeIDs][0];
    myBMSSP.calculateShortestPaths(startNode);
    expect(myBMSSP.shortestPaths.get(startNode)).toBe(0);
  });
});
