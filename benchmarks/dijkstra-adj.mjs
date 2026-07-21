// Algorithm-only Dijkstra over a prebuilt adjacency map — the fair baseline
// for the BMSSP head-to-head (#170).
//
// The shipped `dijkstra()` builds its own adjacency list inside the call;
// that is graph loading, not algorithm work. This variant consumes the same
// `adjacency` Map a BMSSP instance already holds (`from -> [[to, weight]]`),
// so the timed window contains only the heap traversal on both sides —
// matching the methodology of benchmarks/HEAD-TO-HEAD.md.
//
// Every comparison between two distance values (heap sifts, the stale-pop
// check, edge relaxations) bumps a module-level counter, mirroring the
// unconditional compareKeys counter on the BMSSP side (src/tieBreak.mjs).

let comparisonCount = 0;

/** Reset the distance-comparison counter to zero. */
export function resetDijkstraComparisonCount() {
  comparisonCount = 0;
}

/**
 * Number of distance comparisons since the last reset.
 * @returns {number}
 */
export function getDijkstraComparisonCount() {
  return comparisonCount;
}

/**
 * Single-source shortest paths over a prebuilt adjacency map.
 * @param {Map<number, Array<[number, number]>>} adjacency - from -> [[to, weight]]
 * @param {Set<number>} nodeIDs - All node IDs (each gets a distance)
 * @param {number} source - Source node ID (must be in nodeIDs)
 * @returns {Map<number, number>} node ID -> shortest distance (Infinity if unreachable)
 */
export function dijkstraAdjacency(adjacency, nodeIDs, source) {
  if (!nodeIDs.has(source)) {
    throw new Error("Source node not found in nodeIDs");
  }
  const dist = new Map();
  for (const id of nodeIDs) {
    dist.set(id, Infinity);
  }
  dist.set(source, 0);

  const heap = [[0, source]];

  function heapPush(d, v) {
    heap.push([d, v]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      comparisonCount += 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  }

  function heapPop() {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length === 0) return top;
    heap[0] = last;
    let i = 0;
    const n = heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n) {
        comparisonCount += 1;
        if (heap[left][0] < heap[smallest][0]) smallest = left;
      }
      if (right < n) {
        comparisonCount += 1;
        if (heap[right][0] < heap[smallest][0]) smallest = right;
      }
      if (smallest === i) break;
      [heap[i], heap[smallest]] = [heap[smallest], heap[i]];
      i = smallest;
    }
    return top;
  }

  while (heap.length > 0) {
    const [d, u] = heapPop();
    comparisonCount += 1;
    if (d > dist.get(u)) continue;
    const neighbors = adjacency.get(u);
    if (!neighbors) continue;
    for (const [to, weight] of neighbors) {
      const alt = d + weight;
      comparisonCount += 1;
      if (alt < dist.get(to)) {
        dist.set(to, alt);
        heapPush(alt, to);
      }
    }
  }

  return dist;
}
