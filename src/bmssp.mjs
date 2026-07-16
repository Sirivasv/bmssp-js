import { baseCase } from "./baseCase.mjs";
import { findPivots } from "./findPivots.mjs";
import { BlockList } from "./blockList.mjs";

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

  // Method to initialize the shortest paths map
  initializeShortestPaths() {
    for (let nodeId of this.nodeIDs) {
      this.shortestPaths.set(nodeId, Infinity);
    }
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
   * are relaxed in place at every level.
   *
   * Two outcomes (Lemma 3.1):
   * - Successful execution: the block list emptied — bound === B and
   *   vertices holds every v with d(v) < B reachable through S.
   * - Partial execution: the k·2^(l·t) workload guard tripped — bound < B
   *   and vertices holds exactly the v with d(v) < bound.
   *   Every returned vertex is complete either way.
   *
   * @param {number} l - Recursion level; 0 delegates to baseCase
   * @param {number} B - Strict upper bound on the distances in scope (Infinity is allowed)
   * @param {Set<*>} S - Non-empty set of complete frontier sources
   * @returns {{ bound: number, vertices: Set<*> }} The boundary B' <= B and
   *   the set U of vertices completed below it
   */
  bmssp(l, B, S) {
    const dHat = this.shortestPaths;
    if (l === 0) {
      return baseCase(B, S, dHat, this.adjacency, this.k);
    }

    // Shrink the frontier: only the pivots are worth recursing on, and W
    // is a batch of already-completed vertices folded in at the end
    const { pivots, W } = findPivots(B, S, dHat, this.adjacency, this.k);

    // Seed the Lemma 3.3 block list with the pivots. lastBound tracks the
    // paper's Bi': B when P is empty, min d̂ over P before the first pull,
    // then the boundary returned by the latest recursive call.
    // A pivot with d̂ >= B is out of scope at this level (only possible
    // when equal path lengths violate Assumption 2.1 and a pull returned
    // a key tied with its separator): skip it — the ancestor whose band
    // covers its distance is responsible for it.
    const D = new BlockList(2 ** ((l - 1) * this.t), B);
    let lastBound = B;
    for (const x of pivots) {
      const dx = dHat.get(x);
      if (dx < B) {
        D.insert(x, dx);
        if (dx < lastBound) lastBound = dx;
      }
    }

    const U = new Set();
    const workloadCap = this.k * 2 ** (l * this.t);

    while (U.size < workloadCap && !D.isEmpty()) {
      // Bi, Si <- D.Pull(): the next-closest small batch and its separator
      const { keys: Si, bound: Bi } = D.pull();
      let { bound: BiPrime, vertices: Ui } = this.bmssp(l - 1, Bi, Si);

      if (Ui.size === 0) {
        // Degenerate tie stall: the child settled only vertices tied
        // exactly at its boundary (possible only through zero-weight
        // paths, which violate the paper's Assumption 2.1 — see #163),
        // so its strict d̂ < B' filter returned nothing and this batch
        // would be re-pulled forever. Escape hatch: settle everything
        // below Bi reachable through the batch with an uncapped bounded
        // Dijkstra per member — correct, just not sublinear.
        Ui = new Set();
        for (const x of Si) {
          const { vertices } = baseCase(
            Bi,
            new Set([x]),
            dHat,
            this.adjacency,
            Math.max(1, this.nodeIDs.size),
          );
          for (const v of vertices) Ui.add(v);
        }
        BiPrime = Bi;
      }

      lastBound = BiPrime;
      for (const v of Ui) U.add(v);

      // Relax out of the newly-completed Ui, routing improved neighbors
      // by distance band: [Bi, B) re-enters the block list, [Bi', Bi) is
      // staged for a batch prepend (closer than the current batch's floor)
      const K = [];
      for (const u of Ui) {
        const du = dHat.get(u);
        for (const [v, weight] of this.adjacency.get(u) ?? []) {
          const candidate = du + weight;
          // Paper relaxation: d̂[u] + w(u,v) <= d̂[v] always updates d̂
          if (candidate <= (dHat.get(v) ?? Infinity)) {
            dHat.set(v, candidate);
            // A vertex already completed at this level cannot strictly
            // improve (non-negative weights), so an equal-sum relaxation
            // — which the <= allows, e.g. via a zero-weight cycle — must
            // not be re-queued (mirrors the baseCase settled guard)
            if (U.has(v)) continue;
            if (candidate >= Bi && candidate < B) {
              D.insert(v, candidate);
            } else if (candidate >= BiPrime && candidate < Bi) {
              K.push([v, candidate]);
            }
          }
        }
      }
      // Batch members the child did not complete (d̂ still in [Bi', Bi))
      // go back in front of everything else. A member tied exactly at the
      // separator (d̂ == Bi < B, an Assumption 2.1 violation) is still in
      // scope at this level and re-enters through a regular insert.
      for (const x of Si) {
        if (U.has(x)) continue;
        const dx = dHat.get(x);
        if (dx >= BiPrime && dx < Bi) {
          K.push([x, dx]);
        } else if (dx === Bi && Bi < B) {
          D.insert(x, dx);
        }
      }
      if (K.length > 0) D.batchPrepend(K);
    }

    // B' <- min(last Bi', B); fold in the FindPivots batch below it
    const bound = Math.min(lastBound, B);
    for (const x of W) {
      if (dHat.get(x) < bound) U.add(x);
    }
    return { bound, vertices: U };
  }

  // Method to calculate shortest paths from startNode via the BMSSP
  // recursion (Algorithm 3). The top-level call BMSSP(topLevel, ∞, {start})
  // is always a successful execution, so it completes every reachable
  // vertex; unreachable ones keep their Infinity estimate.
  calculateShortestPaths(startNode) {
    // To clean the state before calculation
    this.initializeShortestPaths();

    // validate startNode
    if (!this.nodeIDs.has(startNode)) {
      throw new Error("Start node not found in the graph");
    }

    // The source is complete at distance 0; everything else is Infinity
    this.shortestPaths.set(startNode, 0);
    this.bmssp(this.topLevel, Infinity, new Set([startNode]));
  }
}

export { BMSSP };
