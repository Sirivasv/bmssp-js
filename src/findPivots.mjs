import {
  compareKeyParts,
  toBound,
  relaxEdge,
  RELAX_LOST,
} from "./tieBreak.mjs";

/**
 * FindPivots(B, S) — Algorithm 1 of "Breaking the Sorting Barrier for Directed
 * Single-Source Shortest Paths". Shrinks the frontier S: runs k rounds of
 * Bellman-Ford-style relaxation out of S, collecting every vertex relaxed
 * below B into W, then identifies the pivots — the vertices of S that root a
 * large (>= k vertices) tree in the forest of tight shortest-path edges. Only
 * the pivots need to be carried into the deeper BMSSP recursion.
 *
 * Preconditions (guaranteed by the caller, Algorithm 3):
 * - Every vertex in S is complete (labels.dist holds its true distance).
 * - Every incomplete vertex v with d(v) < B has a shortest path through some
 *   complete vertex in S.
 *
 * Since #205 the engine works on dense vertex indices: S holds indices, the
 * graph is the class's CSR bundle, and the labels are the shared typed
 * arrays (see tieBreak's makeLabels) — updated in place, exactly like the
 * paper's global d̂[·], so improvements made here are visible to the levels
 * above. Relaxation is canonical (#163): dist, hops and preds move together
 * under the composite [length, hops, index] order, and an exact-equality
 * result re-admits a vertex to W through its one canonical label-setter (the
 * paper's `≤` made deterministic). The `< B` test only gates membership in
 * W; label updates are not gated.
 *
 * The paper's tight-edge forest falls out of the canonical labels: each
 * vertex of W \ S hangs off its recorded canonical predecessor, which is
 * always itself in W. Equal-length paths cannot make this a DAG (one pred
 * per vertex) and tight zero-weight cycles cannot occur (a zero-weight edge
 * strictly increases the hops component), so parent chains always terminate
 * in S — the two #44-era tie ambiguities are gone by construction. Members
 * of S are roots by definition and never count toward another source's tree.
 *
 * Two outcomes:
 * - Early exit (|W| grows past k·|S|): the frontier is already small relative
 *   to W, so every vertex of S is a pivot.
 * - Forest case (k rounds complete with |W| <= k·|S|): pivots are the S-roots
 *   of canonical-predecessor trees with >= k vertices.
 *   Guarantees |pivots| <= |W| / k either way.
 *
 * @param {number|[number, number, *]} B - Strict upper bound gating membership
 *   in W: a number (Infinity is allowed) or a composite bound
 * @param {Set<number>|Iterable<number>} S - Non-empty set of complete frontier
 *   source indices
 * @param {{ dist: Float64Array, hops: Uint32Array, preds: Int32Array }} labels
 *   - Engine label state (d̂[·] and tie-break labels), updated in place
 * @param {{ offsets: Uint32Array, targets: Uint32Array, weights: Float64Array }} csr
 *   - The graph in CSR layout over dense indices
 * @param {number} k - Relaxation rounds / tree-size threshold, >= 1 (floored);
 *   the paper's ⌊log^(1/3) n⌋
 * @returns {{ pivots: Set<number>, W: Set<number> }} The pivot subset of S and
 *   the set W of vertex indices touched below B (W always contains S)
 * @throws {Error} If k is not a number >= 1, S is empty, or any source has no
 *   finite distance estimate
 */
function findPivots(B, S, labels, csr, k) {
  if (typeof k !== "number" || Number.isNaN(k) || k < 1) {
    throw new Error("k must be a number >= 1");
  }
  const rounds = Math.floor(k);
  const sources = [...S];
  if (sources.length === 0) {
    throw new Error("S must contain at least one source node");
  }
  for (const x of sources) {
    if (!Number.isFinite(labels.dist[x])) {
      throw new Error("every source must have a finite distance estimate");
    }
  }
  const boundKey = toBound(B);
  const { offsets, targets, weights } = csr;

  // W accumulates everything relaxed below B; layer is the paper's W_{i-1}
  const sourceSet = new Set(sources);
  const W = new Set(sources);
  let layer = new Set(sources);

  for (let i = 1; i <= rounds; i += 1) {
    const nextLayer = new Set();
    for (const u of layer) {
      for (let e = offsets[u]; e < offsets[u + 1]; e += 1) {
        const v = targets[e];
        // Canonical relaxation: label updates are not gated by B (paper),
        // and both improvements and exact canonical equality admit v to the
        // next layer when its key is below B. Non-lost ⇒ v's stored label
        // is the candidate, so the W gate compares the unpacked stored
        // components — no key allocation (#168).
        const result = relaxEdge(u, v, weights[e], labels);
        if (
          result !== RELAX_LOST &&
          compareKeyParts(labels.dist[v], labels.hops[v], v, boundKey) < 0
        ) {
          nextLayer.add(v);
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

  // Forest of canonical predecessors inside W: every vertex of W \ S was
  // (re-)labeled through some layer member during this call, so its
  // recorded pred is in W and parent chains end in S
  const children = new Map();
  for (const v of W) {
    if (sourceSet.has(v)) continue;
    const parent = labels.preds[v];
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(v);
  }

  // Pivots: sources that root a canonical tree with >= k vertices
  const pivots = new Set();
  for (const x of sources) {
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
