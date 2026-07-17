import { MinHeap } from "./heap.mjs";
import {
  compareKeys,
  toBound,
  makeTies,
  orderKey,
  relaxEdge,
} from "./tieBreak.mjs";

/**
 * BaseCase(B, S) — Algorithm 2 of "Breaking the Sorting Barrier for Directed
 * Single-Source Shortest Paths". The level-0 case of the BMSSP recursion: a
 * mini Dijkstra from the single complete source x in S, bounded above by B,
 * that stops after settling k + 1 vertices.
 *
 * Preconditions (guaranteed by the caller, Algorithm 3):
 * - S is a singleton {x} and x is complete (dHat holds its true distance).
 * - Every incomplete vertex v with d(v) < B has a shortest path through x.
 *
 * Distance estimates are read from and written into dHat in place — exactly
 * like the paper's global d̂[·] labels, so improvements made here are visible
 * to the levels above. Since #163 the heap is ordered by the composite
 * [length, hops, id] keys of src/tieBreak.mjs, which realize the paper's
 * Assumption 2.1 (distinct path lengths): a settled vertex carries its
 * canonical (lexicographically minimal) label, which no later relaxation can
 * improve. The settled filter below only skips canonical re-enqueue signals
 * (exact label equality from the recorded predecessor), which is what keeps
 * zero-weight plateaus quiescent instead of looping.
 *
 * Two outcomes:
 * - Full success (fewer than k + 1 vertices exist under B): every vertex
 *   with key < B is settled and returned, with bound === B.
 * - Partial (the k + 1 cap was hit): boundKey = the largest settled key
 *   B' < B, and exactly the k strictly-closer vertices are returned. Under
 *   the composite order the strictly-closer filter is exact — scalar-length
 *   ties with the boundary vertex are broken by (hops, id), and a returned
 *   vertex may therefore share the boundary's scalar length (the documented
 *   d(v) <= bound caveat of the scalar view).
 *   Every returned vertex is complete either way.
 *
 * @param {number|[number, number, *]} B - Strict upper bound on the keys to
 *   settle: a number (Infinity is allowed) or a composite bound
 * @param {Set<*>|Iterable<*>} S - Singleton set holding the complete source x
 * @param {Map<*, number>} dHat - Global distance estimates d̂[·], updated in place
 * @param {Map<*, Array<[*, number]>>} adjacency - nodeId -> outgoing [to, weight] edges
 * @param {number} k - Settle cap parameter, >= 1 (floored); the paper's ⌊log^(1/3) n⌋
 * @param {{ hops: Map<*, number>, preds: Map<*, *> }} [ties] - Canonical
 *   tie-break labels updated alongside dHat; fresh throwaway maps by default
 * @returns {{ bound: number|[number, number, *], boundKey: [number, number, *], vertices: Set<*> }}
 *   The boundary B' <= B (same kind as the B passed in), its composite key,
 *   and the set U of vertices settled below it
 * @throws {Error} If k is not a number >= 1, S is not a singleton, or the
 *   source has no finite distance estimate
 */
function baseCase(B, S, dHat, adjacency, k, ties = makeTies()) {
  if (typeof k !== "number" || Number.isNaN(k) || k < 1) {
    throw new Error("k must be a number >= 1");
  }
  const cap = Math.floor(k);
  const sources = [...S];
  if (sources.length !== 1) {
    throw new Error("S must contain exactly one source node");
  }
  const [x] = sources;
  const sourceDistance = dHat.get(x);
  if (typeof sourceDistance !== "number" || !Number.isFinite(sourceDistance)) {
    throw new Error("the source must have a finite distance estimate");
  }
  const boundKey = toBound(B);

  // U0 in the paper: the vertices settled by this call, seeded with x
  const settled = new Set([x]);
  const heap = new MinHeap(compareKeys);
  heap.insert(x, orderKey(x, dHat, ties));

  while (!heap.isEmpty() && settled.size < cap + 1) {
    const { key: u } = heap.extractMin();
    settled.add(u);
    for (const [v, weight] of adjacency.get(u) ?? []) {
      // Canonical relaxation, gated by the bound (the paper's `< B`). An
      // exact-equality result means u is v's recorded label-setter (v was
      // labeled by an earlier phase without being completed) and v must be
      // (re-)enqueued — unless this very call already settled it, which is
      // what keeps zero-weight plateaus finite.
      const relaxed = relaxEdge(u, v, weight, dHat, ties, boundKey);
      if (relaxed === null || settled.has(v)) continue;
      if (heap.has(v)) {
        heap.decreaseKey(v, relaxed.key);
      } else {
        heap.insert(v, relaxed.key);
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
    const key = orderKey(v, dHat, ties);
    if (boundary === null || compareKeys(key, boundary) > 0) boundary = key;
  }
  const vertices = new Set();
  for (const v of settled) {
    if (compareKeys(orderKey(v, dHat, ties), boundary) < 0) vertices.add(v);
  }
  return {
    bound: typeof B === "number" ? boundary[0] : boundary,
    boundKey: boundary,
    vertices,
  };
}

export { baseCase };
