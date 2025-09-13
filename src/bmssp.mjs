class BMSSP {
  constructor(inputGraph) {
    // Main graph represented as an array of edges
    this.graph = [];
    // Set to store unique node IDs
    this.nodeIDs = new Set();

    for (let edge of inputGraph) {
      // Create a deep copy of each edge array
      this.graph.push([...edge]);
      // Add node IDs to the set
      this.nodeIDs.add(edge[0]);
      this.nodeIDs.add(edge[1]);
    }
  }
}

export { BMSSP };
