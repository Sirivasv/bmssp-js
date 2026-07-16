/**
 * FindPivots(B, S) — Algorithm 1 of "Breaking the Sorting Barrier for Directed
 * Single-Source Shortest Paths". Shrinks the frontier S: runs k rounds of
 * Bellman-Ford-style relaxation out of S, collecting every vertex relaxed
 * below B into W, then identifies the pivots — the vertices of S that root a
 * large (>= k vertices) tree in the forest of tight shortest-path edges. Only
 * the pivots need to be carried into the deeper BMSSP recursion.
 *
 * Preconditions (guaranteed by the caller, Algorithm 3):
 * - Every vertex in S is complete (dHat holds its true distance).
 * - Every incomplete vertex v with d(v) < B has a shortest path through some
 *   complete vertex in S.
 *
 * Distance estimates are read from and written into dHat in place — exactly
 * like the paper's global d̂[·] labels, so improvements made here are visible
 * to the levels above. The `<=` relaxation updates d̂ unconditionally; the
 * `< B` test only gates membership in W.
 *
 * Two outcomes:
 * - Early exit (|W| grows past k·|S|): the frontier is already small relative
 *   to W, so every vertex of S is a pivot.
 * - Forest case (k rounds complete with |W| <= k·|S|): pivots are the S-roots
 *   of tight-edge trees with >= k vertices. Equal-length paths can make the
 *   tight-edge graph a DAG (see #163); each vertex is assigned at most one
 *   parent deterministically (first tight edge in W iteration order) so tree
 *   sizes are well-defined. Guarantees |pivots| <= |W| / k either way.
 *
 * @param {number} B - Strict upper bound gating membership in W (Infinity is allowed)
 * @param {Set<*>|Iterable<*>} S - Non-empty set of complete frontier sources
 * @param {Map<*, number>} dHat - Global distance estimates d̂[·], updated in place
 * @param {Map<*, Array<[*, number]>>} adjacency - nodeId -> outgoing [to, weight] edges
 * @param {number} k - Relaxation rounds / tree-size threshold, >= 1 (floored);
 *   the paper's ⌊log^(1/3) n⌋
 * @returns {{ pivots: Set<*>, W: Set<*> }} The pivot subset of S and the set W
 *   of vertices touched below B (W always contains S)
 * @throws {Error} If k is not a number >= 1, S is empty, or any source has no
 *   finite distance estimate
 */
function findPivots(B, S, dHat, adjacency, k) {
  if (typeof k !== "number" || Number.isNaN(k) || k < 1) {
    throw new Error("k must be a number >= 1");
  }
  const rounds = Math.floor(k);
  const sources = [...S];
  if (sources.length === 0) {
    throw new Error("S must contain at least one source node");
  }
  for (const x of sources) {
    const distance = dHat.get(x);
    if (typeof distance !== "number" || !Number.isFinite(distance)) {
      throw new Error("every source must have a finite distance estimate");
    }
  }

  // W accumulates everything relaxed below B; layer is the paper's W_{i-1}
  const W = new Set(sources);
  let layer = new Set(sources);

  for (let i = 1; i <= rounds; i += 1) {
    const nextLayer = new Set();
    for (const u of layer) {
      for (const [v, weight] of adjacency.get(u) ?? []) {
        const candidate = dHat.get(u) + weight;
        // Paper relaxation: <= always updates d̂; < B gates the W membership
        if (candidate <= (dHat.get(v) ?? Infinity)) {
          dHat.set(v, candidate);
          if (candidate < B) nextLayer.add(v);
        }
      }
    }
    for (const v of nextLayer) W.add(v);
    layer = nextLayer;
    if (W.size > rounds * sources.length) {
      // Frontier already small relative to W: every source is a pivot
      return { pivots: new Set(sources), W };
    }
  }

  // Forest F of tight edges inside W. Each vertex takes at most one parent,
  // chosen deterministically, so tree sizes stay well-defined even when ties
  // make F a DAG. Vertices on tight cycles (zero-weight cycles) all end up
  // with parents, so they belong to no root's tree.
  const children = new Map();
  const hasParent = new Set();
  for (const u of W) {
    const du = dHat.get(u);
    for (const [v, weight] of adjacency.get(u) ?? []) {
      if (v === u || !W.has(v) || hasParent.has(v)) continue;
      if (dHat.get(v) === du + weight) {
        hasParent.add(v);
        if (!children.has(u)) children.set(u, []);
        children.get(u).push(v);
      }
    }
  }

  // Pivots: sources that root a tight-edge tree with >= k vertices
  const pivots = new Set();
  for (const x of sources) {
    if (hasParent.has(x)) continue;
    let size = 0;
    const stack = [x];
    while (stack.length > 0) {
      const u = stack.pop();
      size += 1;
      for (const child of children.get(u) ?? []) stack.push(child);
    }
    if (size >= rounds) pivots.add(x);
  }
  return { pivots, W };
}

export { findPivots };
