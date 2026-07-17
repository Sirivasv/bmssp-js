import { baseCase } from "./baseCase.mjs";
import { findPivots } from "./findPivots.mjs";
import { BlockList } from "./blockList.mjs";
import {
  compareKeys,
  toBound,
  makeTies,
  orderKey,
  relaxEdge,
} from "./tieBreak.mjs";

class BMSSP {
  constructor(inputGraph) {
    // Main graph represented as an array of edges
    this.graph = [];
    // Set to store unique node IDs
    this.nodeIDs = new Set();
    // Map to store shortest paths
    this.shortestPaths = new Map();
    // Adjacency map: nodeId -> array of [to, weight] outgoing edges.
    // Lets the algorithm fetch a node's edges in O(1) instead of scanning
    // the whole edge list on every lookup.
    this.adjacency = new Map();
    // Canonical tie-break labels (#163): hops = edge count of the canonical
    // shortest path, preds = its predecessor pointer. Updated in lockstep
    // with shortestPaths by relaxEdge; together they realize the paper's
    // Assumption 2.1 (distinct path lengths) via [length, hops, id] keys.
    this.hops = new Map();
    this.preds = new Map();
    this.ties = makeTies(this.hops, this.preds);

    for (let edge of inputGraph) {
      // Create a deep copy of each edge array
      this.graph.push([...edge]);

      // Add node IDs to the set
      this.nodeIDs.add(edge[0]);
      this.nodeIDs.add(edge[1]);
    }

    // Build the adjacency map from the copied edges
    this.buildAdjacency();

    // Initialize shortest paths map
    this.initializeShortestPaths();

    // Derive the paper's k / t parameters and the top recursion level
    this.deriveParameters();
  }

  // Method to (re)build the adjacency map from this.graph.
  // Every node ID gets an entry (an empty array for nodes with no
  // outgoing edges) so callers can rely on .get(node) returning an array.
  buildAdjacency() {
    this.adjacency = new Map();

    // Ensure every known node has an (initially empty) neighbor list
    for (let nodeId of this.nodeIDs) {
      this.adjacency.set(nodeId, []);
    }

    // Group outgoing edges by their source node
    for (let [from, to, weight] of this.graph) {
      this.adjacency.get(from).push([to, weight]);
    }
  }

  // Return the outgoing edges of a node as an array of [to, weight].
  // Unknown nodes return an empty array.
  getEdges(nodeId) {
    return this.adjacency.get(nodeId) ?? [];
  }

  // Method to initialize the shortest paths map (and the #163 tie-break
  // labels that travel with it)
  initializeShortestPaths() {
    for (let nodeId of this.nodeIDs) {
      this.shortestPaths.set(nodeId, Infinity);
    }
    this.hops.clear();
    this.preds.clear();
  }

  /**
   * Derive the paper's parameters from n = |V| and store them on the
   * instance:
   * - k = max(1, ⌊(log₂ n)^(1/3)⌋) — Bellman-Ford rounds in FindPivots and
   *   the BaseCase settle cap,
   * - t = max(1, ⌊(log₂ n)^(2/3)⌋) — branching / level sizing,
   * - topLevel = max(1, ⌈log₂ n / t⌉) — level of the top BMSSP call.
   * Everything is clamped to >= 1 so tiny graphs stay out of degenerate
   * regimes: correctness never depends on the asymptotics.
   */
  deriveParameters() {
    const logn = Math.log2(Math.max(2, this.nodeIDs.size));
    this.k = Math.max(1, Math.floor(logn ** (1 / 3)));
    this.t = Math.max(1, Math.floor(logn ** (2 / 3)));
    this.topLevel = Math.max(1, Math.ceil(logn / this.t));
  }

  /**
   * BMSSP(l, B, S) — Algorithm 3 of "Breaking the Sorting Barrier for
   * Directed Single-Source Shortest Paths": the main bounded multi-source
   * recursion, wiring FindPivots (Algorithm 1), the Lemma 3.3 BlockList and
   * BaseCase (Algorithm 2) together.
   *
   * Preconditions (the top-level call satisfies them trivially):
   * - Every vertex in S is complete (this.shortestPaths holds its true
   *   distance), and every incomplete vertex v with d(v) < B has a shortest
   *   path through some complete vertex of S.
   *
   * Distance estimates live in this.shortestPaths (the paper's d̂[·]) and
   * are relaxed in place at every level, together with the canonical hops
   * and preds labels (#163). All internal ordering uses the composite
   * [length, hops, id] keys of src/tieBreak.mjs, which realize the paper's
   * Assumption 2.1: pull separators are strict, no key ever ties a bound,
   * and the pre-#163 degenerate-tie guards (out-of-scope pivots,
   * boundary-tied batch members, the empty-child stall escape hatch) are
   * unnecessary by construction.
   *
   * Two outcomes (Lemma 3.1, strict under the composite order):
   * - Successful execution: the block list emptied — boundKey === B's key
   *   and vertices holds every v with key(v) < B reachable through S.
   * - Partial execution: the k·2^(l·t) workload guard tripped —
   *   boundKey < B's key and vertices holds exactly the v with
   *   key(v) < boundKey. In the scalar projection a returned vertex may tie
   *   the returned bound's length (never exceed it).
   *   Every returned vertex is complete either way.
   *
   * @param {number} l - Recursion level; 0 delegates to baseCase
   * @param {number|[number, number, *]} B - Strict upper bound on the keys
   *   in scope: a number (Infinity is allowed) or a composite bound
   * @param {Set<*>} S - Non-empty set of complete frontier sources
   * @returns {{ bound: number|[number, number, *], boundKey: [number, number, *], vertices: Set<*> }}
   *   The boundary B' <= B (same kind as the B passed in: scalar callers
   *   get a scalar), its composite key, and the set U of vertices
   *   completed below it
   */
  bmssp(l, B, S) {
    const dHat = this.shortestPaths;
    const ties = this.ties;
    const boundKey = toBound(B);
    const scalarB = typeof B === "number";
    // Project the composite result back to the caller's kind: a successful
    // execution echoes B itself, a partial one reports the separator (whose
    // length is strictly below a scalar B by construction)
    const finish = (finalKey, vertices) => ({
      bound: scalarB
        ? compareKeys(finalKey, boundKey) === 0
          ? B
          : finalKey[0]
        : finalKey,
      boundKey: finalKey,
      vertices,
    });

    if (l === 0) {
      const result = baseCase(boundKey, S, dHat, this.adjacency, this.k, ties);
      return finish(result.boundKey, result.vertices);
    }

    // Shrink the frontier: only the pivots are worth recursing on, and W
    // is a batch of already-completed vertices folded in at the end
    const { pivots, W } = findPivots(
      boundKey,
      S,
      dHat,
      this.adjacency,
      this.k,
      ties,
    );

    // Seed the Lemma 3.3 block list with the pivots. lastBoundKey tracks
    // the paper's Bi': B when P is empty, min key over P before the first
    // pull, then the boundary returned by the latest recursive call.
    // The scope filter is for direct multi-source callers who may pass
    // sources at or above B — internal calls can't produce one, because
    // every pull separator is strict under the composite order.
    const D = new BlockList(2 ** ((l - 1) * this.t), boundKey, compareKeys);
    let lastBoundKey = boundKey;
    for (const x of pivots) {
      const key = orderKey(x, dHat, ties);
      if (compareKeys(key, boundKey) < 0) {
        D.insert(x, key);
        if (compareKeys(key, lastBoundKey) < 0) lastBoundKey = key;
      }
    }

    const U = new Set();
    const workloadCap = this.k * 2 ** (l * this.t);

    while (U.size < workloadCap && !D.isEmpty()) {
      // Bi, Si <- D.Pull(): the next-closest small batch and its separator
      const { keys: Si, bound: BiKey } = D.pull();
      const child = this.bmssp(l - 1, BiKey, Si);
      const BiPrimeKey = child.boundKey;
      const Ui = child.vertices;

      lastBoundKey = BiPrimeKey;
      for (const v of Ui) U.add(v);

      // Relax out of the newly-completed Ui, routing improved neighbors by
      // key band: [Bi, B) re-enters the block list, [Bi', Bi) is staged for
      // a batch prepend (closer than the current batch's floor). An exact
      // canonical equality re-enqueues a vertex that a deeper call labeled
      // without completing (the paper's `≤` relaxation, deterministic here:
      // only the recorded label-setter triggers it); vertices already
      // completed at this level are filtered so re-enqueues stay finite.
      const K = [];
      for (const u of Ui) {
        for (const [v, weight] of this.adjacency.get(u) ?? []) {
          const relaxed = relaxEdge(u, v, weight, dHat, ties);
          if (relaxed === null || U.has(v)) continue;
          const key = relaxed.key;
          if (compareKeys(key, BiKey) >= 0 && compareKeys(key, boundKey) < 0) {
            D.insert(v, key);
          } else if (
            compareKeys(key, BiPrimeKey) >= 0 &&
            compareKeys(key, BiKey) < 0
          ) {
            K.push([v, key]);
          }
        }
      }
      // Batch members the child did not complete (key still in [Bi', Bi))
      // go back in front of everything else
      for (const x of Si) {
        if (U.has(x)) continue;
        const key = orderKey(x, dHat, ties);
        if (compareKeys(key, BiPrimeKey) >= 0 && compareKeys(key, BiKey) < 0) {
          K.push([x, key]);
        }
      }
      if (K.length > 0) D.batchPrepend(K);
    }

    // B' <- min(last Bi', B); fold in the FindPivots batch below it
    const finalKey =
      compareKeys(lastBoundKey, boundKey) < 0 ? lastBoundKey : boundKey;
    for (const x of W) {
      if (compareKeys(orderKey(x, dHat, ties), finalKey) < 0) U.add(x);
    }
    return finish(finalKey, U);
  }

  // Method to calculate shortest paths from startNode via the BMSSP
  // recursion (Algorithm 3). The top-level call BMSSP(topLevel, ∞, {start})
  // is always a successful execution, so it completes every reachable
  // vertex; unreachable ones keep their Infinity estimate. Distances, hop
  // counts and predecessor pointers all end at their canonical values —
  // independent of edge or iteration order (#163).
  calculateShortestPaths(startNode) {
    // To clean the state before calculation
    this.initializeShortestPaths();

    // validate startNode
    if (!this.nodeIDs.has(startNode)) {
      throw new Error("Start node not found in the graph");
    }

    // The source is complete at distance 0 with zero hops and no
    // predecessor; everything else is Infinity
    this.shortestPaths.set(startNode, 0);
    this.hops.set(startNode, 0);
    this.bmssp(this.topLevel, Infinity, new Set([startNode]));
  }
}

export { BMSSP };
