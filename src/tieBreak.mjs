/**
 * Deterministic tie-breaking for equal-length paths (#163) — the code-level
 * stand-in for the paper's Assumption 2.1 ("all paths have distinct
 * lengths", "Breaking the Sorting Barrier for Directed Single-Source
 * Shortest Paths").
 *
 * Every path is ranked by a composite key `[length, hops, id]`, compared
 * lexicographically:
 *
 * - `length` — the ordinary path length (sum of weights). Always dominates,
 *   so plain distances are unaffected.
 * - `hops`   — the number of edges on the path (the paper's "#vertices"
 *   tie-break component). A zero-weight edge leaves `length` unchanged but
 *   always increments `hops`, so extending a path strictly increases its
 *   key: tight (zero-weight) cycles cannot tie with themselves and an
 *   equal-sum re-relaxation can never loop.
 * - `id`     — a final disambiguator standing in for the paper's full
 *   "vertex sequence" (O(1) to compare instead of O(path)): inside
 *   relaxation it is the candidate predecessor's id (picking the canonical
 *   parent among equal-(length, hops) alternatives), while for frontier
 *   ordering it is the vertex's own id (making the order on vertices a
 *   strict total order).
 *
 * With distinct vertex ids no two frontier keys are ever equal, which is
 * exactly what Assumption 2.1 grants the paper: every BlockList pull
 * separator is strict, no vertex ties with a bound, and Lemma 3.1 holds in
 * its strict form — the guards that #40/#43/#161 had to add for degenerate
 * ties become dead code.
 *
 * Scalar bounds stay expressible: `toBound(B)` maps the number B to
 * `[B, -Infinity, -Infinity]`, the infimum of every real key of length B,
 * so "key < toBound(B)" is exactly the public "distance strictly below B"
 * contract.
 *
 * The canonical labels live in three maps updated together by `relaxEdge`:
 * d̂ (the class's `shortestPaths`), plus `hops` and `preds` bundled as a
 * `ties` object. Missing entries default to hops 0 (an externally seeded
 * source is a hop-0 root) and "no predecessor" (which never loses a tie).
 */

// Sentinel predecessor for sources: compares below every real id, so a
// source's own label never loses an equal-(length, hops) comparison.
const NO_PRED = -Infinity;

// Running count of compareKeys calls — the paper's cost metric ("comparisons
// between path lengths"). Every BMSSP-side comparison funnels through
// compareKeys (the heap and BlockList receive it as their comparator, and
// baseCase/findPivots/bmssp call it directly), so this one counter covers the
// whole algorithm. The benchmark harness (#170) reads it to measure the
// sorting barrier; one unconditional increment keeps the hot path branch-free.
let comparisonCount = 0;

/** Reset the compareKeys call counter to zero (benchmark instrumentation). */
function resetComparisonCount() {
  comparisonCount = 0;
}

/**
 * Number of compareKeys calls since the last reset (benchmark
 * instrumentation).
 * @returns {number}
 */
function getComparisonCount() {
  return comparisonCount;
}

/**
 * Lexicographic comparison of two composite keys.
 * @param {[number, number, *]} a - [length, hops, id]
 * @param {[number, number, *]} b - [length, hops, id]
 * @returns {number} Negative when a < b, positive when a > b, 0 when equal
 */
function compareKeys(a, b) {
  comparisonCount += 1;
  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
  if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1;
  if (a[2] !== b[2]) return a[2] < b[2] ? -1 : 1;
  return 0;
}

/**
 * Lexicographic comparison of an UNPACKED key (length, hops, id) against a
 * packed one — identical order to compareKeys without materializing the
 * left-hand array (#168: the hot relax/routing loops call this instead of
 * allocating a throwaway key per test). Counts as one comparison.
 * @param {number} length - Left key's length component
 * @param {number} hops - Left key's hops component
 * @param {*} id - Left key's id component
 * @param {[number, number, *]} key - Right key, packed
 * @returns {number} Negative when (length, hops, id) < key, positive when
 *   greater, 0 when equal
 */
function compareKeyParts(length, hops, id, key) {
  comparisonCount += 1;
  if (length !== key[0]) return length < key[0] ? -1 : 1;
  if (hops !== key[1]) return hops < key[1] ? -1 : 1;
  if (id !== key[2]) return id < key[2] ? -1 : 1;
  return 0;
}

/**
 * Normalize a bound to a composite key. A scalar B becomes the infimum of
 * all keys of length B, preserving the strict "distance < B" contract;
 * a composite bound (an array) passes through unchanged.
 * @param {number|[number, number, *]} B
 * @returns {[number, number, *]}
 */
function toBound(B) {
  return typeof B === "number" ? [B, -Infinity, -Infinity] : B;
}

/**
 * Bundle (or create) the tie-break label maps that accompany d̂.
 * @param {Map<*, number>} [hops] - Canonical path edge counts
 * @param {Map<*, *>} [preds] - Canonical predecessor of each vertex
 * @returns {{ hops: Map<*, number>, preds: Map<*, *> }}
 */
function makeTies(hops = new Map(), preds = new Map()) {
  return { hops, preds };
}

/**
 * The frontier-ordering key of a vertex under its current labels.
 * @param {*} v - Vertex id
 * @param {Map<*, number>} dHat - Distance estimates d̂[·]
 * @param {{ hops: Map<*, number> }} ties - Tie-break labels
 * @returns {[number, number, *]} [d̂[v], hops[v], v]
 */
function orderKey(v, dHat, ties) {
  return [dHat.get(v) ?? Infinity, ties.hops.get(v) ?? 0, v];
}

/**
 * Attempt the canonical relaxation of edge (u, v). The candidate path
 * (canonical path to u, then this edge) has path key
 * [d̂[u] + w, hops[u] + 1, u]; it wins iff it is strictly smaller than v's
 * current path key [d̂[v], hops[v], preds[v]] — so d̂, hops and preds move
 * together and the chosen predecessor is deterministic regardless of edge
 * or iteration order. Improvements strictly decrease v's path key, which is
 * bounded below, so chains of relaxations always terminate (no zero-weight
 * cycle can loop).
 *
 * The exact-equality case — the candidate IS v's current canonical label —
 * is reported separately as `improved: false`. It is the paper's `≤`
 * re-relaxation made canonical: when a caller completes u and relaxes its
 * edges, an equal result on (u, v) means u is v's recorded label-setter and
 * v may need to be re-enqueued at this level (it was labeled by a deeper
 * call that did not complete it). Only the one canonical predecessor
 * triggers this, so re-enqueues are deterministic and never duplicated by
 * tied alternative parents; callers filter already-completed vertices to
 * keep the re-enqueue finite, exactly like the paper.
 *
 * Allocation-free since #168: the result is one of the three RELAX_* codes,
 * and a caller that needs v's (possibly updated) order key materializes it
 * with orderKey(v, dHat, ties) — only on the rare paths that enqueue v,
 * instead of on every attempt.
 *
 * @param {*} u - Edge tail (its labels are read)
 * @param {*} v - Edge head (its labels may be updated)
 * @param {number} weight - Edge weight, >= 0
 * @param {Map<*, number>} dHat - Distance estimates d̂[·], updated in place
 * @param {{ hops: Map<*, number>, preds: Map<*, *> }} ties - Updated in place
 * @param {[number, number, *]} [bound] - Optional gate: skip (no d̂ update)
 *   unless the resulting order key would be strictly below this bound
 * @returns {number} RELAX_IMPROVED when the labels were updated,
 *   RELAX_EQUAL when the candidate exactly matches v's canonical label
 *   (the re-enqueue signal), RELAX_LOST when the candidate loses or the
 *   bound gates it (labels untouched)
 */
function relaxEdge(u, v, weight, dHat, ties, bound) {
  const length = dHat.get(u) + weight;
  const hopCount = (ties.hops.get(u) ?? 0) + 1;
  if (bound !== undefined && compareKeyParts(length, hopCount, v, bound) >= 0) {
    return RELAX_LOST;
  }
  // Candidate path key [length, hopCount, u] vs. v's current path key
  // [d̂[v], hops[v], preds[v] ?? NO_PRED] — compareKeys inlined on the
  // unpacked components (one counted comparison, no arrays)
  comparisonCount += 1;
  let cmp;
  const currentLength = dHat.get(v) ?? Infinity;
  if (length !== currentLength) {
    cmp = length < currentLength ? -1 : 1;
  } else {
    const currentHops = ties.hops.get(v) ?? 0;
    if (hopCount !== currentHops) {
      cmp = hopCount < currentHops ? -1 : 1;
    } else {
      const currentPred = ties.preds.has(v) ? ties.preds.get(v) : NO_PRED;
      cmp = u !== currentPred ? (u < currentPred ? -1 : 1) : 0;
    }
  }
  if (cmp > 0) return RELAX_LOST;
  if (cmp === 0) return RELAX_EQUAL;
  dHat.set(v, length);
  ties.hops.set(v, hopCount);
  ties.preds.set(v, u);
  return RELAX_IMPROVED;
}

// relaxEdge result codes (#168): distinct, and only RELAX_LOST is falsy-like
// in comparisons — callers must compare against the constants, not truthiness
const RELAX_LOST = -1;
const RELAX_EQUAL = 0;
const RELAX_IMPROVED = 1;

export {
  compareKeys,
  compareKeyParts,
  toBound,
  makeTies,
  orderKey,
  relaxEdge,
  NO_PRED,
  RELAX_LOST,
  RELAX_EQUAL,
  RELAX_IMPROVED,
  resetComparisonCount,
  getComparisonCount,
};
