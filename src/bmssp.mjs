import { dijkstra } from "./dijkstra.mjs";

class BMSSP {
  constructor(inputGraph) {
    // Main graph represented as an array of edges
    this.graph = [];
    // Set to store unique node IDs
    this.nodeIDs = new Set();
    // Map to store shortest paths
    this.shortestPaths = new Map();
    // Adjacency map: nodeId -> array of [to, weight] outgoing edges.
    // Lets the algorithm fetch a node's edges in O(1) instead of scanning
    // the whole edge list on every lookup.
    this.adjacency = new Map();

    for (let edge of inputGraph) {
      // Create a deep copy of each edge array
      this.graph.push([...edge]);

      // Add node IDs to the set
      this.nodeIDs.add(edge[0]);
      this.nodeIDs.add(edge[1]);
    }

    // Build the adjacency map from the copied edges
    this.buildAdjacency();

    // Initialize shortest paths map
    this.initializeShortestPaths();
  }

  // Method to (re)build the adjacency map from this.graph.
  // Every node ID gets an entry (an empty array for nodes with no
  // outgoing edges) so callers can rely on .get(node) returning an array.
  buildAdjacency() {
    this.adjacency = new Map();

    // Ensure every known node has an (initially empty) neighbor list
    for (let nodeId of this.nodeIDs) {
      this.adjacency.set(nodeId, []);
    }

    // Group outgoing edges by their source node
    for (let [from, to, weight] of this.graph) {
      this.adjacency.get(from).push([to, weight]);
    }
  }

  // Return the outgoing edges of a node as an array of [to, weight].
  // Unknown nodes return an empty array.
  getEdges(nodeId) {
    return this.adjacency.get(nodeId) ?? [];
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
