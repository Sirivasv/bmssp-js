import { baseCase } from "./baseCase.mjs";
import { findPivots } from "./findPivots.mjs";
import { BlockList } from "./blockList.mjs";
import { normalizeGraphInput } from "./graph.mjs";
import {
  compareKeys,
  compareKeyParts,
  toBound,
  makeTies,
  makeLabels,
  labelKey,
  relaxEdge,
  NO_PRED,
  RELAX_LOST,
} from "./tieBreak.mjs";

/**
 * BMSSP — the paper's Algorithm 3 behind a small class API.
 *
 * **Supported public API (stable as of 2.0.0 — see `MIGRATION.md`):**
 * - `new BMSSP(input)` — construct from an edge array, an adjacency `Map`/object,
 *   or a {@link Graph} builder (see the constructor).
 * - {@link BMSSP#calculateShortestPaths} — single-source SSSP.
 * - {@link BMSSP#calculateShortestPathsFrom} — multi-source / bounded run (the
 *   ergonomic front door to the paper's `BMSSP(l, B, S)` generalization).
 * - {@link BMSSP#bmssp} — the low-level bounded multi-source primitive (advanced;
 *   composite keys, returns `{ bound, boundKey, vertices }`).
 * - {@link BMSSP#reconstructPath} — canonical path for the latest run.
 * - {@link BMSSP#getEdges} — outgoing-edge lookup, materialized from the CSR.
 * - Public fields: `shortestPaths`, `nodeIDs`, `hops`, `preds` (all
 *   documented in the constructor).
 *
 * **Everything else on this class is `@internal`** — the dense-index engine
 * (`csr`, `labels`, `ids`, `indexOf`, `bmsspIndex`, `syncLabelsIn/Out`,
 * `boundToEngine`, `keyToPublic`, `buildIndex`, …) and the derived parameters
 * (`k`, `t`, `topLevel`, `ties`). It is not part of the public contract and may
 * change in a minor release. The algorithm-internal modules (`BlockList`,
 * `MinHeap`, `baseCase`, `findPivots`, `BoundIndex`, `select`, `tieBreak`) are
 * likewise not re-exported from `index.mjs`.
 *
 * @public
 */
class BMSSP {
  /**
   * @public
   * @param {Array<[number,number,number]>|Map|Object|Graph} inputGraph - Any
   *   #172 input shape: an edge array, an adjacency `Map`/object, or a `Graph`.
   */
  constructor(inputGraph) {
    // #172: accept several input shapes (edge array, adjacency map/object, or
    // a Graph builder) and reduce them to a canonical { edges, vertices }.
    // `vertices` is the EXPLICIT vertex universe — declared nodes, including
    // isolated ones; edge endpoints are folded in below. An edge-array input
    // yields an empty `vertices`, reproducing the pre-#172 "infer from edges"
    // behavior exactly.
    const { edges: inputEdges, vertices: declaredVertices } =
      normalizeGraphInput(inputGraph);

    // Set to store unique node IDs
    this.nodeIDs = new Set();
    // Map to store shortest paths
    this.shortestPaths = new Map();
    // Canonical tie-break labels (#163): hops = edge count of the canonical
    // shortest path, preds = its predecessor pointer. Since #205 these Maps
    // are the PUBLIC mirror of the engine's typed-array labels, refreshed
    // whenever a run finishes; together with shortestPaths they realize the
    // paper's Assumption 2.1 via [length, hops, id] keys.
    this.hops = new Map();
    this.preds = new Map();
    this.ties = makeTies(this.hops, this.preds);

    // Validate the edges and collect the node universe. #212: we no longer keep
    // a deep-copied `this.graph` edge array or a `this.adjacency` Map — the CSR
    // engine (buildIndex) is the single source of truth, built directly from
    // `inputEdges`. Validation stays here so the indexed error messages remain
    // the single source of truth.
    for (let [index, edge] of inputEdges.entries()) {
      if (!Array.isArray(edge) || edge.length !== 3) {
        throw new Error(`Edge at index ${index} must be [from, to, weight]`);
      }

      const [from, to, weight] = edge;
      if (!Number.isFinite(from) || !Number.isFinite(to)) {
        throw new Error(`Edge at index ${index} must have numeric node IDs`);
      }
      if (!Number.isFinite(weight) || weight < 0) {
        throw new Error(
          `Edge at index ${index} must have a non-negative numeric weight`,
        );
      }

      // Add node IDs to the set
      this.nodeIDs.add(from);
      this.nodeIDs.add(to);
    }

    // #172: fold in explicitly declared vertices (isolated nodes included).
    // Same finiteness contract as edge endpoints; buildIndex then gives every
    // declared node an index and an empty CSR range (getEdges returns []).
    for (const id of declaredVertices) {
      if (!Number.isFinite(id)) {
        throw new Error("Declared vertex IDs must be finite numbers");
      }
      this.nodeIDs.add(id);
    }

    // Build the dense-index engine state directly from the validated edges:
    // sorted-id index + CSR + labels. No intermediate edge-array / adjacency-Map
    // copy — this is the #212 direct-CSR construction.
    this.buildIndex(inputEdges);

    // Initialize shortest paths map
    this.initializeShortestPaths();

    // Derive the paper's k / t parameters and the top recursion level
    this.deriveParameters();
  }

  /**
   * Build the dense-index engine state (#205, direct-CSR since #212): assign
   * every node ID a dense index, lay the given edges out in CSR form over
   * those indices, and allocate the typed-array labels.
   *
   * Indices are assigned in ASCENDING NUMERIC ID ORDER. That makes index
   * order equal id order, so the composite-key id tie-break (#163) picks the
   * same canonical labels the id-keyed engine did — and, because the
   * assignment depends only on the node-ID set, results stay invariant
   * under edge-list permutation.
   *
   * @internal
   * @param {Array<[number,number,number]>} edges - The validated input edges;
   *   consumed directly into CSR (no intermediate `this.graph` copy).
   */
  buildIndex(edges) {
    const sorted = [...this.nodeIDs].sort((a, b) => a - b);
    const n = sorted.length;
    const m = edges.length;
    // ids: index -> original node id; indexOf: original node id -> index
    this.ids = Float64Array.from(sorted);
    this.indexOf = new Map();
    for (let i = 0; i < n; i += 1) {
      this.indexOf.set(sorted[i], i);
    }
    // CSR: offsets[u]..offsets[u+1] delimit u's outgoing edges in
    // targets/weights (edge order within a node follows the input edge order;
    // the #163 canonical labels are iteration-order independent anyway)
    const offsets = new Uint32Array(n + 1);
    for (const [from] of edges) {
      offsets[this.indexOf.get(from) + 1] += 1;
    }
    for (let i = 0; i < n; i += 1) {
      offsets[i + 1] += offsets[i];
    }
    const targets = new Uint32Array(m);
    const weights = new Float64Array(m);
    const cursor = offsets.slice(0, n);
    for (const [from, to, weight] of edges) {
      const u = this.indexOf.get(from);
      const e = cursor[u];
      cursor[u] += 1;
      targets[e] = this.indexOf.get(to);
      weights[e] = weight;
    }
    this.csr = { offsets, targets, weights };
    // Engine labels: d̂ / hops / canonical preds over dense indices
    this.labels = makeLabels(n);
  }

  /**
   * Return the outgoing edges of a node as a fresh array of `[to, weight]`
   * pairs, materialized from the CSR (#212 — there is no stored adjacency Map).
   * Unknown nodes return an empty array. Edge order follows the construction
   * input order.
   *
   * @public
   * @param {number} nodeId - A node in the graph
   * @returns {Array<[number, number]>} Outgoing `[to, weight]` edges, `[]` if unknown
   */
  getEdges(nodeId) {
    const u = this.indexOf.get(nodeId);
    if (u === undefined) return [];
    const { offsets, targets, weights } = this.csr;
    const out = [];
    for (let e = offsets[u]; e < offsets[u + 1]; e += 1) {
      out.push([this.ids[targets[e]], weights[e]]);
    }
    return out;
  }

  // Method to initialize the shortest paths map, its #163 tie-break mirror
  // maps, and the #205 engine arrays behind them
  initializeShortestPaths() {
    for (let nodeId of this.nodeIDs) {
      this.shortestPaths.set(nodeId, Infinity);
    }
    this.hops.clear();
    this.preds.clear();
    this.labels.dist.fill(Infinity);
    this.labels.hops.fill(0);
    this.labels.preds.fill(NO_PRED);
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
   *
   * @internal
   */
  deriveParameters() {
    const logn = Math.log2(Math.max(2, this.nodeIDs.size));
    this.k = Math.max(1, Math.floor(logn ** (1 / 3)));
    this.t = Math.max(1, Math.floor(logn ** (2 / 3)));
    this.topLevel = Math.max(1, Math.ceil(logn / this.t));
  }

  // Internal (#205): load the engine arrays from the public Maps. A direct
  // multi-source caller seeds initial state by writing this.shortestPaths
  // (the documented contract), so the wrapper snapshots those distances into
  // the engine. Seeded sources are roots — hop 0, no predecessor — matching
  // both the paper and the pre-#205 behavior (the hops/preds Maps are empty
  // after initializeShortestPaths, so they contributed nothing there either).
  syncLabelsIn() {
    const { dist, hops, preds } = this.labels;
    dist.fill(Infinity);
    hops.fill(0);
    preds.fill(NO_PRED);
    for (const [id, d] of this.shortestPaths) {
      if (Number.isFinite(d)) dist[this.indexOf.get(id)] = d;
    }
  }

  // Internal (#205): mirror the engine arrays back into the public Maps
  // (shortestPaths / hops / preds, keyed by original ids). Unreached
  // vertices keep their Infinity entries; sources keep no preds entry
  // (their stored pred is the NO_PRED sentinel), which reconstructPath
  // relies on to terminate.
  syncLabelsOut() {
    const { dist, hops, preds } = this.labels;
    const ids = this.ids;
    for (let i = 0; i < ids.length; i += 1) {
      if (dist[i] === Infinity) continue;
      const id = ids[i];
      this.shortestPaths.set(id, dist[i]);
      this.hops.set(id, hops[i]);
      if (preds[i] !== NO_PRED) this.preds.set(id, ids[preds[i]]);
    }
  }

  // Internal (#205): translate a caller's bound into the engine's index
  // space. Scalar bounds become the usual [B, -Inf, -Inf] infimum key; a
  // composite bound's id component is mapped to its index (ids not in the
  // graph — including the -Infinity sentinel — pass through unchanged).
  boundToEngine(B) {
    if (typeof B === "number") return toBound(B);
    const idx = this.indexOf.get(B[2]);
    return [B[0], B[1], idx === undefined ? B[2] : idx];
  }

  // Internal (#205): translate an engine key's index component back to the
  // original node id (sentinel components pass through).
  keyToPublic(key) {
    const idx = key[2];
    const isIndex = Number.isInteger(idx) && idx >= 0 && idx < this.ids.length;
    return [key[0], key[1], isIndex ? this.ids[idx] : idx];
  }

  /**
   * BMSSP(l, B, S) — Algorithm 3 of "Breaking the Sorting Barrier for
   * Directed Single-Source Shortest Paths": the main bounded multi-source
   * recursion, wiring FindPivots (Algorithm 1), the Lemma 3.3 BlockList and
   * BaseCase (Algorithm 2) together.
   *
   * Public boundary (#205): S holds original node ids and the returned
   * vertices/boundKey are in id space; initial multi-source state is seeded
   * by writing this.shortestPaths (the pre-#205 contract). Internally the
   * call runs on the dense-index engine — this wrapper snapshots the Maps
   * into the typed arrays, runs bmsspIndex, and mirrors the arrays back.
   *
   * Preconditions (the top-level call satisfies them trivially):
   * - Every vertex in S is complete (this.shortestPaths holds its true
   *   distance), and every incomplete vertex v with d(v) < B has a shortest
   *   path through some complete vertex of S.
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
   * @public
   * @param {number} l - Recursion level; 0 delegates to baseCase
   * @param {number|[number, number, *]} B - Strict upper bound on the keys
   *   in scope: a number (Infinity is allowed) or a composite bound
   * @param {Set<*>} S - Non-empty set of complete frontier sources (ids)
   * @returns {{ bound: number|[number, number, *], boundKey: [number, number, *], vertices: Set<*> }}
   *   The boundary B' <= B (same kind as the B passed in: scalar callers
   *   get a scalar), its composite key, and the set U of vertices
   *   completed below it — all in original-id space
   */
  bmssp(l, B, S) {
    this.syncLabelsIn();
    const boundKey = this.boundToEngine(B);
    const SIdx = new Set();
    for (const id of S) {
      const idx = this.indexOf.get(id);
      // Unknown sources keep their raw id: the engine then reads an
      // undefined label and fails the finite-distance precondition, the
      // same error the id-keyed engine raised
      SIdx.add(idx === undefined ? id : idx);
    }
    const result = this.bmsspIndex(l, boundKey, SIdx);
    this.syncLabelsOut();
    const vertices = new Set();
    for (const idx of result.vertices) {
      vertices.add(this.ids[idx]);
    }
    const finalKey = this.keyToPublic(result.boundKey);
    // Project the composite result back to the caller's kind: a successful
    // execution echoes B itself, a partial one reports the separator (whose
    // length is strictly below a scalar B by construction)
    const bound =
      typeof B === "number"
        ? compareKeys(result.boundKey, boundKey) === 0
          ? B
          : finalKey[0]
        : finalKey;
    return { bound, boundKey: finalKey, vertices };
  }

  // Internal (#205): the actual Algorithm 3 recursion, entirely in dense
  // index space — S/vertices hold indices, keys are [length, hops, index],
  // the graph is CSR and the labels are the shared typed arrays.
  bmsspIndex(l, boundKey, S) {
    const labels = this.labels;

    if (l === 0) {
      const result = baseCase(boundKey, S, labels, this.csr, this.k);
      return { boundKey: result.boundKey, vertices: result.vertices };
    }

    // Shrink the frontier: only the pivots are worth recursing on, and W
    // is a batch of already-completed vertices folded in at the end
    const { pivots, W } = findPivots(boundKey, S, labels, this.csr, this.k);

    // Seed the Lemma 3.3 block list with the pivots. lastBoundKey tracks
    // the paper's Bi': B when P is empty, min key over P before the first
    // pull, then the boundary returned by the latest recursive call.
    // The scope filter is for direct multi-source callers who may pass
    // sources at or above B — internal calls can't produce one, because
    // every pull separator is strict under the composite order.
    const D = new BlockList(2 ** ((l - 1) * this.t), boundKey, compareKeys);
    let lastBoundKey = boundKey;
    for (const x of pivots) {
      const key = labelKey(x, labels);
      if (compareKeys(key, boundKey) < 0) {
        D.insert(x, key);
        if (compareKeys(key, lastBoundKey) < 0) lastBoundKey = key;
      }
    }

    const U = new Set();
    const workloadCap = this.k * 2 ** (l * this.t);
    const { offsets, targets, weights } = this.csr;

    while (U.size < workloadCap && !D.isEmpty()) {
      // Bi, Si <- D.Pull(): the next-closest small batch and its separator
      const { keys: Si, bound: BiKey } = D.pull();
      const child = this.bmsspIndex(l - 1, BiKey, Si);
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
      // A non-lost relaxation leaves v's stored label equal to the
      // candidate, so the band tests compare the unpacked stored components
      // and a key array is built only for the enqueue itself (#168).
      const K = [];
      for (const u of Ui) {
        for (let e = offsets[u]; e < offsets[u + 1]; e += 1) {
          const v = targets[e];
          const result = relaxEdge(u, v, weights[e], labels);
          if (result === RELAX_LOST || U.has(v)) continue;
          const length = labels.dist[v];
          const hopCount = labels.hops[v];
          if (compareKeyParts(length, hopCount, v, BiKey) >= 0) {
            if (compareKeyParts(length, hopCount, v, boundKey) < 0) {
              D.insert(v, [length, hopCount, v]);
            }
          } else if (compareKeyParts(length, hopCount, v, BiPrimeKey) >= 0) {
            K.push([v, [length, hopCount, v]]);
          }
        }
      }
      // Batch members the child did not complete (key still in [Bi', Bi))
      // go back in front of everything else
      for (const x of Si) {
        if (U.has(x)) continue;
        const length = labels.dist[x];
        const hopCount = labels.hops[x];
        if (
          compareKeyParts(length, hopCount, x, BiKey) < 0 &&
          compareKeyParts(length, hopCount, x, BiPrimeKey) >= 0
        ) {
          K.push([x, [length, hopCount, x]]);
        }
      }
      if (K.length > 0) D.batchPrepend(K);
    }

    // B' <- min(last Bi', B); fold in the FindPivots batch below it
    const finalKey =
      compareKeys(lastBoundKey, boundKey) < 0 ? lastBoundKey : boundKey;
    for (const x of W) {
      if (compareKeyParts(labels.dist[x], labels.hops[x], x, finalKey) < 0) {
        U.add(x);
      }
    }
    return { boundKey: finalKey, vertices: U };
  }

  // Method to calculate shortest paths from startNode via the BMSSP
  // recursion (Algorithm 3). The top-level call BMSSP(topLevel, ∞, {start})
  // is always a successful execution, so it completes every reachable
  // vertex; unreachable ones keep their Infinity estimate. Distances, hop
  // counts and predecessor pointers all end at their canonical values —
  // independent of edge or iteration order (#163) — and are mirrored into
  // the public Maps when the run finishes (#205).
  calculateShortestPaths(startNode) {
    // To clean the state before calculation
    this.initializeShortestPaths();

    // validate startNode
    if (!this.nodeIDs.has(startNode)) {
      throw new Error("Start node not found in the graph");
    }

    // The source is complete at distance 0 with zero hops and no
    // predecessor; everything else is Infinity
    const s = this.indexOf.get(startNode);
    this.labels.dist[s] = 0;
    this.bmsspIndex(this.topLevel, toBound(Infinity), new Set([s]));
    this.syncLabelsOut();
  }

  // Internal (#171): reduce the flexible `sources` argument of
  // calculateShortestPathsFrom to a Map<id, initialDistance>. Accepts a
  // Map<id, dist>, a plain object { id: dist } (numeric-string keys coerced
  // like #172's adjacency objects), an array of [id, dist] pairs, or a bare
  // array of ids (each seeded at distance 0). Every id must be a known node
  // and every initial distance a finite non-negative number; a repeated
  // source keeps its smallest initial distance.
  normalizeSources(sources) {
    const out = new Map();
    const add = (id, dist) => {
      if (!this.nodeIDs.has(id)) {
        throw new Error(`Source ${id} not found in the graph`);
      }
      if (!Number.isFinite(dist) || dist < 0) {
        throw new Error(
          `Source ${id} must have a non-negative finite initial distance`,
        );
      }
      const prev = out.get(id);
      out.set(id, prev === undefined ? dist : Math.min(prev, dist));
    };

    if (sources instanceof Map) {
      for (const [id, dist] of sources) add(id, dist);
    } else if (Array.isArray(sources)) {
      for (const entry of sources) {
        if (Array.isArray(entry)) {
          if (entry.length !== 2) {
            throw new Error("Each source pair must be [id, initialDistance]");
          }
          add(entry[0], entry[1]);
        } else {
          add(entry, 0);
        }
      }
    } else if (sources && typeof sources === "object") {
      for (const key of Object.keys(sources)) {
        add(Number(key), sources[key]);
      }
    } else {
      throw new Error(
        "sources must be a Map, object, array of [id, dist] pairs, or array of ids",
      );
    }
    return out;
  }

  /**
   * Multi-source, optionally-bounded shortest paths — the public form of the
   * paper's BMSSP(l, B, S) generalization (§04). Runs from a SET of sources,
   * each with an initial distance, optionally under a strict distance bound B.
   * Single-source SSSP is exactly the special case sources = [start],
   * bound = Infinity — what calculateShortestPaths does.
   *
   * Results land in this.shortestPaths (and the hops/preds mirror), like
   * calculateShortestPaths: every completed vertex holds its distance;
   * vertices not reached — or, in a bounded run, not completed below B — keep
   * Infinity. Read the answer from this.shortestPaths after the call. Under a
   * finite bound only the completed set U is exposed: BMSSP may relax vertices
   * above B without completing them, so those leftover estimates are pruned
   * back to Infinity, leaving exactly the vertices with distance < B.
   *
   * The initial distances are treated as the sources' TRUE (complete)
   * distances — the paper's precondition on S. With the common all-zero
   * seeding this is trivially satisfied (nearest-of-many). Passing custom
   * initial distances where one source's shortest path undercuts another's
   * declared distance violates the precondition; the multi-source ground
   * truth is trueDist(v) = min over sources s of (d0[s] + dist_s(v)).
   *
   * @public
   * @param {Map<number,number>|Object<string,number>|Array<[number,number]>|number[]} sources
   *   The source set. A Map<id, dist>, a plain object { id: dist } (numeric
   *   string keys coerced), an array of [id, dist] pairs, or a bare array of
   *   ids (each seeded at distance 0).
   * @param {object} [options]
   * @param {number} [options.bound=Infinity] - Strict distance upper bound B;
   *   only vertices with distance < B are completed. Infinity runs unbounded.
   * @throws {Error} If sources is empty or an unrecognized shape, a source id
   *   is not in the graph, an initial distance is not a non-negative finite
   *   number, or bound is not a non-negative number / Infinity.
   */
  calculateShortestPathsFrom(sources, { bound = Infinity } = {}) {
    this.initializeShortestPaths();

    const seeded = this.normalizeSources(sources);
    if (seeded.size === 0) {
      throw new Error("At least one source is required");
    }
    if (typeof bound !== "number" || Number.isNaN(bound) || bound < 0) {
      throw new Error("bound must be a non-negative number or Infinity");
    }

    // Seed each source's initial distance into the public estimate; the
    // bmssp() wrapper's syncLabelsIn snapshots these finite distances into the
    // engine as complete roots (hop 0, no predecessor).
    for (const [id, dist] of seeded) {
      this.shortestPaths.set(id, dist);
    }
    const { vertices } = this.bmssp(
      this.topLevel,
      bound,
      new Set(seeded.keys()),
    );

    // Under a finite bound the top-level call is a successful execution whose
    // returned set U is exactly the vertices completed below B. BMSSP relaxes
    // (but does not complete) some vertices at or above B, leaving over-
    // estimates in the mirror; prune everything outside U so the public Maps
    // report only the exact in-bound distances (matching an unbounded run,
    // whose U already equals the reachable set — no pruning needed there).
    if (bound !== Infinity) {
      for (const id of this.nodeIDs) {
        if (!vertices.has(id)) {
          this.shortestPaths.set(id, Infinity);
          this.hops.delete(id);
          this.preds.delete(id);
        }
      }
    }
  }

  /**
   * Reconstruct the canonical shortest path from the most recent source to
   * target. Returns an empty array when target is unreachable or no shortest
   * path run has completed yet.
   *
   * @public
   * @param {number} target - A node in the graph
   * @returns {number[]} Node IDs from the source through target
   * @throws {Error} If target is not in the graph
   */
  reconstructPath(target) {
    if (!this.nodeIDs.has(target)) {
      throw new Error("Target node not found in the graph");
    }
    if (this.shortestPaths.get(target) === Infinity) return [];

    const path = [target];
    let current = target;
    while (this.preds.has(current)) {
      current = this.preds.get(current);
      path.push(current);
    }
    return path.reverse();
  }
}

export { BMSSP };
