import { dijkstra } from "./dijkstra.mjs";

class BMSSP {
  constructor(inputGraph) {
    // Main graph represented as an array of edges
    this.graph = [];
    // Set to store unique node IDs
    this.nodeIDs = new Set();
    // Map to store shortest paths
    this.shortestPaths = new Map();

    for (let edge of inputGraph) {
      // Create a deep copy of each edge array
      this.graph.push([...edge]);

      // Add node IDs to the set
      this.nodeIDs.add(edge[0]);
      this.nodeIDs.add(edge[1]);
    }

    // Initialize shortest paths map
    this.initializeShortestPaths();
  }

  // Method to initialize the shortest paths map
  initializeShortestPaths() {
    for (let nodeId of this.nodeIDs) {
      this.shortestPaths.set(nodeId, Infinity);
    }
  }

  // Method to calculate shortest paths from startNode using Dijkstra
  calculateShortestPaths(startNode) {
    // To clean the state before calculation
    this.initializeShortestPaths();

    // validate startNode
    if (!this.nodeIDs.has(startNode)) {
      throw new Error("Start node not found in the graph");
    }

    const result = dijkstra(this.graph, this.nodeIDs, startNode);
    result.forEach((distance, nodeId) => {
      this.shortestPaths.set(nodeId, distance);
    });
  }
}

export { BMSSP };
