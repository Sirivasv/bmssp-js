class BMSSP {
  constructor(inputGraph) {
    this.graph = [];
    for (let edge of inputGraph) {
      // Create a deep copy of each edge array
      this.graph.push([...edge]);
    }
  }
}

export { BMSSP };
