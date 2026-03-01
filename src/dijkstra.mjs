/**
 * Simple Dijkstra single-source shortest path.
 * Requires all edge weights to be non-negative; with negative weights it may return incorrect paths.
 * @param {Array<[number, number, number]>} graph - Array of edges [from, to, weight] with non-negative weight
 * @param {Set<number>} nodeIDs - Set of all node IDs (distances for these will be in the result)
 * @param {number} source - Source node ID (must be present in nodeIDs)
 * @throws {Error} If source is not in nodeIDs
 * @returns {Map<number, number>} Map from node ID to shortest distance from source (Infinity if unreachable)
 */
function dijkstra(graph, nodeIDs, source) {
  if (!nodeIDs.has(source)) {
    throw new Error("Source node not found in nodeIDs");
  }
  const dist = new Map();
  for (const id of nodeIDs) {
    dist.set(id, Infinity);
  }
  dist.set(source, 0);

  // Build adjacency list: from -> [{ to, weight }, ...]
  const adj = new Map();
  for (const [from, to, weight] of graph) {
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from).push({ to, weight });
  }

  // Min-heap of [distance, node]; compare by distance
  const heap = [[0, source]];

  function heapPush(d, v) {
    heap.push([d, v]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  }

  function heapPop() {
    if (heap.length === 0) return null;
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
      if (left < n && heap[left][0] < heap[smallest][0]) smallest = left;
      if (right < n && heap[right][0] < heap[smallest][0]) smallest = right;
      if (smallest === i) break;
      [heap[i], heap[smallest]] = [heap[smallest], heap[i]];
      i = smallest;
    }
    return top;
  }

  while (heap.length > 0) {
    const [d, u] = heapPop();
    if (d > dist.get(u)) continue;
    const neighbors = adj.get(u);
    if (!neighbors) continue;
    for (const { to, weight } of neighbors) {
      if (!dist.has(to)) dist.set(to, Infinity);
      const alt = d + weight;
      if (alt < dist.get(to)) {
        dist.set(to, alt);
        heapPush(alt, to);
      }
    }
  }

  return dist;
}

export { dijkstra };
