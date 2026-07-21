// Constant-degree transform — the paper's Preliminaries (knowledge/01 §
// "Preliminaries / model assumptions"; term in knowledge/07). The
// O(m·log^(2/3) n) bound is argued on a graph whose vertices all have
// in-degree AND out-degree <= 2. This module rewrites any graph into that
// shape while preserving every distance.
//
// OPT-IN, by design. Nothing in the core algorithm calls this: BMSSP is
// correct on the untransformed graph (validated node-by-node against the
// Dijkstra oracle). The transform only realizes the paper's structural
// precondition for callers who want it — it changes constants, never
// correctness (issue #164, milestone 1.1.0).

// How it works: split each vertex into one "port" copy per incident edge
// endpoint and thread those copies onto a zero-weight directed cycle. A cycle
// gives every copy exactly one incoming and one outgoing cycle edge; a copy
// that additionally hosts a single original endpoint therefore reaches
// degree 2 on that one side and stays at 1 on the other — never more. Because
// the cycle costs nothing to traverse, all copies of a vertex are mutually
// reachable at zero added distance, so each copy's shortest distance equals
// the original vertex's: the rewrite is distance-preserving.

/**
 * Rewrite a directed graph so every vertex has in-degree and out-degree <= 2,
 * preserving all shortest-path distances.
 *
 * @param {Array<[number, number, number]>} graph - [from, to, weight] edges,
 *   the same input contract as the BMSSP constructor: an array of exact
 *   three-element arrays with finite numeric node IDs and finite, non-negative
 *   weights. An empty array is valid.
 * @returns {{
 *   edges: Array<[number, number, number]>,
 *   copiesOf: Map<number, number[]>,
 *   originalOf: Map<number, number>,
 *   sourceCopy: (original: number) => number,
 *   collapse: (transformedDistances: Map<number, number>) => Map<number, number>
 * }}
 *   - `edges`: the transformed graph (fresh integer copy IDs from 0).
 *   - `copiesOf`: original node ID -> its copy IDs, in allocation order.
 *   - `originalOf`: copy ID -> the original node ID it belongs to.
 *   - `sourceCopy(original)`: a canonical copy to start a run from (any copy
 *     works — the zero-weight cycle equalizes them); throws for an unknown
 *     node.
 *   - `collapse(distances)`: fold a transformed-graph distance map back onto
 *     the original node IDs (the min over each vertex's copies; all copies
 *     share the same value, so the min is exact).
 */
function constantDegreeTransform(graph) {
  if (!Array.isArray(graph)) {
    throw new Error("Input graph must be an array of edges");
  }

  let nextCopyId = 0;
  // original node ID -> its copy IDs, in allocation order
  const copiesOf = new Map();
  // copy ID -> the original node ID it belongs to
  const originalOf = new Map();
  // per original edge, the out-port copy of `from` and the in-port copy of `to`
  const outCopyForEdge = new Array(graph.length);
  const inCopyForEdge = new Array(graph.length);

  const allocateCopy = (originalId) => {
    const id = nextCopyId;
    nextCopyId += 1;
    originalOf.set(id, originalId);
    let copies = copiesOf.get(originalId);
    if (copies === undefined) {
      copies = [];
      copiesOf.set(originalId, copies);
    }
    copies.push(id);
    return id;
  };

  // One copy per edge endpoint, allocated in edge order so the whole transform
  // is deterministic: the out-port at `from`, the in-port at `to`. Validate
  // exactly like the BMSSP constructor so the transform can front any graph.
  graph.forEach((edge, index) => {
    if (!Array.isArray(edge) || edge.length !== 3) {
      throw new Error(`Edge at index ${index} must be [from, to, weight]`);
    }
    const [from, to, weight] = edge;
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      throw new Error(`Edge at index ${index} must have numeric node IDs`);
    }
    if (!Number.isFinite(weight) || weight < 0) {
      throw new Error(
        `Edge at index ${index} must have a non-negative numeric weight`,
      );
    }
    outCopyForEdge[index] = allocateCopy(from);
    inCopyForEdge[index] = allocateCopy(to);
  });

  const edges = [];

  // Zero-weight directed cycle through each vertex's copies. A vertex with a
  // single incident endpoint has one copy and needs no cycle.
  for (const copies of copiesOf.values()) {
    if (copies.length < 2) continue;
    for (let i = 0; i < copies.length; i += 1) {
      const next = copies[(i + 1) % copies.length];
      edges.push([copies[i], next, 0]);
    }
  }

  // Each original edge connects its own out-copy to its own in-copy, weight
  // unchanged.
  graph.forEach(([, , weight], index) => {
    edges.push([outCopyForEdge[index], inCopyForEdge[index], weight]);
  });

  const sourceCopy = (original) => {
    const copies = copiesOf.get(original);
    if (copies === undefined) {
      throw new Error(`Node ${original} is not in the graph`);
    }
    return copies[0];
  };

  const collapse = (transformedDistances) => {
    const result = new Map();
    for (const [original, copies] of copiesOf) {
      let best = Infinity;
      for (const copy of copies) {
        const d = transformedDistances.get(copy);
        if (d !== undefined && d < best) best = d;
      }
      result.set(original, best);
    }
    return result;
  };

  return { edges, copiesOf, originalOf, sourceCopy, collapse };
}

export { constantDegreeTransform };
