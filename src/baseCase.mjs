import { MinHeap } from "./heap.mjs";
import {
  compareKeys,
  toBound,
  labelKey,
  relaxEdge,
  RELAX_LOST,
} from "./tieBreak.mjs";

/**
 * BaseCase(B, S) — Algorithm 2 of "Breaking the Sorting Barrier for Directed
 * Single-Source Shortest Paths". The level-0 case of the BMSSP recursion: a
 * mini Dijkstra from the single complete source x in S, bounded above by B,
 * that stops after settling k + 1 vertices.
 *
 * Preconditions (guaranteed by the caller, Algorithm 3):
 * - S is a singleton {x} and x is complete (labels.dist holds its true
 *   distance).
 * - Every incomplete vertex v with d(v) < B has a shortest path through x.
 *
 * Since #205 the engine works on dense vertex indices: S holds indices, the
 * graph is the class's CSR bundle, and the labels are the shared typed
 * arrays (see tieBreak's makeLabels) — updated in place, exactly like the
 * paper's global d̂[·], so improvements made here are visible to the levels
 * above. The heap is ordered by the composite [length, hops, index] keys,
 * which realize the paper's Assumption 2.1 (distinct path lengths): a
 * settled vertex carries its canonical (lexicographically minimal) label,
 * which no later relaxation can improve. The settled filter below only
 * skips canonical re-enqueue signals (exact label equality from the
 * recorded predecessor), which is what keeps zero-weight plateaus quiescent
 * instead of looping.
 *
 * Two outcomes:
 * - Full success (fewer than k + 1 vertices exist under B): every vertex
 *   with key < B is settled and returned, with bound === B.
 * - Partial (the k + 1 cap was hit): boundKey = the largest settled key
 *   B' < B, and exactly the k strictly-closer vertices are returned. Under
 *   the composite order the strictly-closer filter is exact — scalar-length
 *   ties with the boundary vertex are broken by (hops, index), and a
 *   returned vertex may therefore share the boundary's scalar length (the
 *   documented d(v) <= bound caveat of the scalar view).
 *   Every returned vertex is complete either way.
 *
 * @param {number|[number, number, *]} B - Strict upper bound on the keys to
 *   settle: a number (Infinity is allowed) or a composite bound
 * @param {Set<number>|Iterable<number>} S - Singleton set holding the
 *   complete source index x
 * @param {{ dist: Float64Array, hops: Uint32Array, preds: Int32Array }} labels
 *   - Engine label state (d̂[·] and tie-break labels), updated in place
 * @param {{ offsets: Uint32Array, targets: Uint32Array, weights: Float64Array }} csr
 *   - The graph in CSR layout over dense indices
 * @param {number} k - Settle cap parameter, >= 1 (floored); the paper's ⌊log^(1/3) n⌋
 * @returns {{ bound: number|[number, number, *], boundKey: [number, number, *], vertices: Set<number> }}
 *   The boundary B' <= B (same kind as the B passed in), its composite key,
 *   and the set U of vertex indices settled below it
 * @throws {Error} If k is not a number >= 1, S is not a singleton, or the
 *   source has no finite distance estimate
 */
function baseCase(B, S, labels, csr, k) {
  if (typeof k !== "number" || Number.isNaN(k) || k < 1) {
    throw new Error("k must be a number >= 1");
  }
  const cap = Math.floor(k);
  const sources = [...S];
  if (sources.length !== 1) {
    throw new Error("S must contain exactly one source node");
  }
  const [x] = sources;
  if (!Number.isFinite(labels.dist[x])) {
    throw new Error("the source must have a finite distance estimate");
  }
  const boundKey = toBound(B);
  const { offsets, targets, weights } = csr;

  // U0 in the paper: the vertices settled by this call, seeded with x
  const settled = new Set([x]);
  const heap = new MinHeap(compareKeys);
  heap.insert(x, labelKey(x, labels));

  while (!heap.isEmpty() && settled.size < cap + 1) {
    const { key: u } = heap.extractMin();
    settled.add(u);
    for (let e = offsets[u]; e < offsets[u + 1]; e += 1) {
      const v = targets[e];
      // Canonical relaxation, gated by the bound (the paper's `< B`). An
      // exact-equality result means u is v's recorded label-setter (v was
      // labeled by an earlier phase without being completed) and v must be
      // (re-)enqueued — unless this very call already settled it, which is
      // what keeps zero-weight plateaus finite.
      const result = relaxEdge(u, v, weights[e], labels, boundKey);
      if (result === RELAX_LOST || settled.has(v)) continue;
      // Non-lost ⇒ v's stored label IS the candidate; materialize its key
      // only here, on the enqueue path (#168)
      const key = labelKey(v, labels);
      if (heap.has(v)) {
        heap.decreaseKey(v, key);
      } else {
        heap.insert(v, key);
      }
    }
  }

  if (settled.size <= cap) {
    // Exhausted before the cap: everything under B is settled (B' = B)
    return { bound: B, boundKey, vertices: settled };
  }

  // Hit the k + 1 cap: report B' = the largest settled key and return the
  // vertices strictly below it — exactly k of them, keys being distinct
  let boundary = null;
  for (const v of settled) {
    const key = labelKey(v, labels);
    if (boundary === null || compareKeys(key, boundary) > 0) boundary = key;
  }
  const vertices = new Set();
  for (const v of settled) {
    if (compareKeys(labelKey(v, labels), boundary) < 0) vertices.add(v);
  }
  return {
    bound: typeof B === "number" ? boundary[0] : boundary,
    boundKey: boundary,
    vertices,
  };
}

export { baseCase };
