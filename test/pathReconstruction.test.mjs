import { describe, test, expect } from "@jest/globals";
import { BMSSP } from "../index.mjs";

function dijkstraPaths(graph, nodeIDs, source) {
  const adjacency = new Map([...nodeIDs].map((node) => [node, []]));
  for (const [from, to, weight] of graph) {
    adjacency.get(from).push([to, weight]);
  }

  const distances = new Map([...nodeIDs].map((node) => [node, Infinity]));
  const paths = new Map([[source, [source]]]);
  const visited = new Set();
  distances.set(source, 0);

  for (;;) {
    let current = null;
    for (const node of nodeIDs) {
      if (
        !visited.has(node) &&
        distances.get(node) < Infinity &&
        (current === null || distances.get(node) < distances.get(current))
      ) {
        current = node;
      }
    }
    if (current === null) break;
    visited.add(current);

    for (const [next, weight] of adjacency.get(current)) {
      const candidate = distances.get(current) + weight;
      if (candidate < distances.get(next)) {
        distances.set(next, candidate);
        paths.set(next, [...paths.get(current), next]);
      }
    }
  }

  return paths;
}

const graph = [
  [0, 1, 7],
  [0, 2, 2],
  [2, 1, 1],
  [1, 3, 1],
  [2, 3, 9],
  [4, 5, 1],
];

describe("BMSSP reconstructPath", () => {
  test("matches Dijkstra-derived paths for reachable and unreachable targets", () => {
    const bmssp = new BMSSP(graph);
    bmssp.calculateShortestPaths(0);
    const expected = dijkstraPaths(graph, bmssp.nodeIDs, 0);

    for (const target of bmssp.nodeIDs) {
      expect(bmssp.reconstructPath(target)).toEqual(expected.get(target) ?? []);
    }
  });

  test("uses the source from the most recent shortest-path run", () => {
    const bmssp = new BMSSP(graph);
    expect(bmssp.reconstructPath(5)).toEqual([]);

    bmssp.calculateShortestPaths(4);
    expect(bmssp.reconstructPath(5)).toEqual([4, 5]);
    expect(bmssp.reconstructPath(0)).toEqual([]);
  });

  test("rejects a target outside the graph", () => {
    const bmssp = new BMSSP(graph);
    expect(() => bmssp.reconstructPath(99)).toThrow(
      "Target node not found in the graph",
    );
  });
});
