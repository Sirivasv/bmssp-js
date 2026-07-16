import { MinHeap } from "./heap.mjs";

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
 * to the levels above.
 *
 * Two outcomes:
 * - Full success (fewer than k + 1 vertices exist under B): every vertex
 *   with d(v) < B is settled and returned, with bound === B.
 * - Partial (the k + 1 cap was hit): bound = the largest settled distance
 *   B' <= B, and only the strictly-closer vertices (d̂ < B') are returned.
 *   Every returned vertex is complete either way.
 *
 * @param {number} B - Strict upper bound on the distances to settle (Infinity is allowed)
 * @param {Set<*>|Iterable<*>} S - Singleton set holding the complete source x
 * @param {Map<*, number>} dHat - Global distance estimates d̂[·], updated in place
 * @param {Map<*, Array<[*, number]>>} adjacency - nodeId -> outgoing [to, weight] edges
 * @param {number} k - Settle cap parameter, >= 1 (floored); the paper's ⌊log^(1/3) n⌋
 * @returns {{ bound: number, vertices: Set<*> }} The boundary B' <= B and the
 *   set U of vertices settled below it
 * @throws {Error} If k is not a number >= 1, S is not a singleton, or the
 *   source has no finite distance estimate
 */
function baseCase(B, S, dHat, adjacency, k) {
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

  // U0 in the paper: the vertices settled by this call, seeded with x
  const settled = new Set([x]);
  const heap = new MinHeap();
  heap.insert(x, sourceDistance);

  while (!heap.isEmpty() && settled.size < cap + 1) {
    const { key: u, value: du } = heap.extractMin();
    settled.add(u);
    for (const [v, weight] of adjacency.get(u) ?? []) {
      const candidate = du + weight;
      // Paper relaxation: d̂[u] + w(u,v) <= d̂[v], and below the bound B
      if (candidate <= (dHat.get(v) ?? Infinity) && candidate < B) {
        dHat.set(v, candidate);
        // With non-negative weights a vertex settled in this call cannot
        // strictly improve, so an equal-sum relaxation (which the <= allows,
        // e.g. via a zero-weight cycle) must not re-enter the heap.
        if (settled.has(v)) continue;
        if (heap.has(v)) {
          heap.decreaseKey(v, candidate);
        } else {
          heap.insert(v, candidate);
        }
      }
    }
  }

  if (settled.size <= cap) {
    // Exhausted before the cap: everything under B is settled (B' = B)
    return { bound: B, vertices: settled };
  }

  // Hit the k + 1 cap: report B' = the largest settled distance and return
  // only the vertices strictly below it
  let boundary = -Infinity;
  for (const v of settled) {
    const distance = dHat.get(v);
    if (distance > boundary) boundary = distance;
  }
  const vertices = new Set();
  for (const v of settled) {
    if (dHat.get(v) < boundary) vertices.add(v);
  }
  return { bound: boundary, vertices };
}

export { baseCase };
