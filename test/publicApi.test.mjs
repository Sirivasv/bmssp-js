import { describe, test, expect } from "@jest/globals";
import * as api from "../index.mjs";
import { BMSSP, Graph, dijkstra, constantDegreeTransform } from "../index.mjs";

// #173 — public API surface, locked for 2.0.0. This is the CONTRACT test: it
// pins exactly which names `index.mjs` exports and which members make up the
// supported public surface of each. The internal/public boundary is
// documented (JSDoc @public/@internal + docs/index.html + MIGRATION.md); this
// test gives it teeth — adding, removing, or renaming a public export or a
// supported method here fails CI, so the surface can't drift by accident.
//
// Algorithm internals (BlockList, MinHeap, baseCase, findPivots, BoundIndex,
// select, tieBreak, and the BMSSP dense-index engine members) are deliberately
// NOT asserted as public — they may change in a minor release.

describe("#173 index.mjs exports exactly the supported surface", () => {
  test("exports precisely { BMSSP, Graph, constantDegreeTransform, dijkstra }", () => {
    expect(Object.keys(api).sort()).toEqual([
      "BMSSP",
      "Graph",
      "constantDegreeTransform",
      "dijkstra",
    ]);
  });

  test("each export has the expected kind", () => {
    expect(typeof BMSSP).toBe("function"); // class
    expect(typeof Graph).toBe("function"); // class
    expect(typeof dijkstra).toBe("function");
    expect(typeof constantDegreeTransform).toBe("function");
  });
});

describe("#173 BMSSP supported public methods and fields", () => {
  const PUBLIC_METHODS = [
    "calculateShortestPaths",
    "calculateShortestPathsFrom",
    "bmssp",
    "reconstructPath",
    "getEdges",
  ];
  const PUBLIC_FIELDS = ["shortestPaths", "nodeIDs", "hops", "preds"];
  // #212 removed these public fields (breaking, 3.0.0): the CSR engine is the
  // single source of truth and the edge view is served on demand by getEdges().
  const REMOVED_FIELDS = ["adjacency", "graph"];

  test("every documented public method exists on the prototype", () => {
    for (const name of PUBLIC_METHODS) {
      expect(typeof BMSSP.prototype[name]).toBe("function");
    }
  });

  test("every documented public field is present on an instance", () => {
    const g = new BMSSP([[0, 1, 5]]);
    for (const name of PUBLIC_FIELDS) {
      expect(g[name]).toBeDefined();
    }
    expect(g.shortestPaths instanceof Map).toBe(true);
    expect(g.nodeIDs instanceof Set).toBe(true);
    expect(g.hops instanceof Map).toBe(true);
    expect(g.preds instanceof Map).toBe(true);
  });

  test("the #212-removed public fields are gone (breaking, 3.0.0)", () => {
    const g = new BMSSP([[0, 1, 5]]);
    for (const name of REMOVED_FIELDS) {
      expect(g[name]).toBeUndefined();
    }
  });

  test("the documented public methods behave as specified end-to-end", () => {
    const g = new BMSSP([
      [0, 1, 5],
      [1, 2, 3],
    ]);
    g.calculateShortestPaths(0);
    expect(g.shortestPaths.get(2)).toBe(8);
    expect(g.reconstructPath(2)).toEqual([0, 1, 2]);
    expect(g.getEdges(0)).toEqual([[1, 5]]);

    g.calculateShortestPathsFrom([2], { bound: Infinity });
    expect(g.shortestPaths.get(2)).toBe(0);

    // The advanced primitive returns the composite-key result object.
    g.initializeShortestPaths?.();
    g.shortestPaths.set(0, 0);
    const result = g.bmssp(g.topLevel, Infinity, new Set([0]));
    expect(result).toHaveProperty("bound");
    expect(result).toHaveProperty("boundKey");
    expect(result.vertices instanceof Set).toBe(true);
  });
});

describe("#173 Graph builder public surface", () => {
  const PUBLIC = ["addVertex", "addEdge", "hasVertex", "toNormalized"];

  test("builder exposes its documented methods", () => {
    for (const name of PUBLIC) {
      expect(typeof Graph.prototype[name]).toBe("function");
    }
  });

  test("mutators chain and produce a normalized shape", () => {
    const g = new Graph().addEdge(0, 1, 50).addVertex(9);
    expect(g).toBeInstanceOf(Graph);
    const { edges, vertices } = g.toNormalized();
    expect(edges).toEqual([[0, 1, 50]]);
    expect(vertices).toContain(9);
  });
});

describe("#173 constantDegreeTransform return shape is locked", () => {
  test("returns { edges, copiesOf, originalOf, sourceCopy, collapse }", () => {
    const t = constantDegreeTransform([
      [0, 1, 5],
      [0, 2, 3],
    ]);
    expect(Object.keys(t).sort()).toEqual([
      "collapse",
      "copiesOf",
      "edges",
      "originalOf",
      "sourceCopy",
    ]);
    expect(Array.isArray(t.edges)).toBe(true);
    expect(t.copiesOf instanceof Map).toBe(true);
    expect(t.originalOf instanceof Map).toBe(true);
    expect(typeof t.sourceCopy).toBe("function");
    expect(typeof t.collapse).toBe("function");
  });
});

describe("#173 dijkstra oracle signature is locked", () => {
  test("dijkstra(graph, nodeIDs, source) → Map<id, distance>", () => {
    const graph = [
      [0, 1, 5],
      [1, 2, 3],
    ];
    const nodeIDs = new Set([0, 1, 2]);
    const dist = dijkstra(graph, nodeIDs, 0);
    expect(dist instanceof Map).toBe(true);
    expect(dist.get(2)).toBe(8);
  });
});
