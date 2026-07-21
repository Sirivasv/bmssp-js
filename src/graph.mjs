// #172 — typed / flexible graph inputs.
//
// A small builder (`Graph`) plus a normalizer (`normalizeGraphInput`) that
// lets the BMSSP constructor accept several input shapes and reduce them to
// one canonical internal form: `{ edges: [[from, to, weight], ...],
// vertices: [id, ...] }`.
//
// `vertices` carries the EXPLICIT vertex universe — every node the caller
// declared, including isolated ones with no incident edges. Edge endpoints
// are still folded in by the BMSSP constructor, so an empty `vertices`
// (the plain edge-list form) reproduces the pre-#172 "infer nodes from
// edges" behavior exactly.
//
// Node-ID semantics are unchanged from earlier versions: IDs are finite
// numbers. Value validation (finite IDs, finite non-negative weights) with
// the "Edge at index N" messages stays in the BMSSP constructor so there is
// a single source of truth; the pieces here validate only what they must to
// build a well-formed normalized shape (and the builder validates eagerly at
// the call site for a friendlier failure).

/**
 * A tiny mutable graph builder. Declare vertices (including isolated ones)
 * and directed weighted edges, then hand the instance straight to
 * `new BMSSP(graph)`.
 *
 * All mutators return `this`, so calls chain:
 * `new Graph().addEdge(0, 1, 50).addEdge(1, 2, 75).addVertex(9)`.
 *
 * Node IDs must be finite numbers and weights finite and non-negative — the
 * same contract the edge-array form has always enforced.
 */
class Graph {
  constructor() {
    // Declared vertex universe (numbers). addEdge folds in its endpoints too.
    this._vertices = new Set();
    // Declared directed edges as [from, to, weight] triples.
    this._edges = [];
  }

  /**
   * Declare a vertex. Safe to call for a node that already exists (idempotent)
   * and the only way to introduce an isolated vertex (one with no edges).
   * @param {number} id finite node ID
   * @returns {Graph} this
   */
  addVertex(id) {
    if (!Number.isFinite(id)) {
      throw new Error("Graph.addVertex: node id must be a finite number");
    }
    this._vertices.add(id);
    return this;
  }

  /**
   * Add a directed edge `from -> to` of the given weight. Both endpoints are
   * declared automatically.
   * @param {number} from finite source node ID
   * @param {number} to finite target node ID
   * @param {number} weight finite, non-negative edge weight
   * @returns {Graph} this
   */
  addEdge(from, to, weight) {
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      throw new Error("Graph.addEdge: node ids must be finite numbers");
    }
    if (!Number.isFinite(weight) || weight < 0) {
      throw new Error(
        "Graph.addEdge: weight must be a finite, non-negative number",
      );
    }
    this._vertices.add(from);
    this._vertices.add(to);
    this._edges.push([from, to, weight]);
    return this;
  }

  /** @param {number} id @returns {boolean} whether the vertex is declared */
  hasVertex(id) {
    return this._vertices.has(id);
  }

  /** @returns {number} number of declared vertices */
  get vertexCount() {
    return this._vertices.size;
  }

  /** @returns {number} number of declared edges */
  get edgeCount() {
    return this._edges.length;
  }

  /**
   * The canonical normalized form the BMSSP constructor consumes. Returns
   * fresh copies so later mutation of this builder cannot affect a graph
   * already constructed from it.
   * @returns {{ edges: number[][], vertices: number[] }}
   */
  toNormalized() {
    return {
      edges: this._edges.map((edge) => [...edge]),
      vertices: [...this._vertices],
    };
  }
}

function isIterable(value) {
  return value != null && typeof value[Symbol.iterator] === "function";
}

/**
 * Reduce an adjacency form to `{ edges, vertices }`. Each entry maps a source
 * node to an iterable of `[to, weight]` pairs; the source is always declared
 * (so a node with an empty/absent neighbor list becomes an isolated vertex).
 * When `coerceKeys` is set (plain-object form, whose keys are strings), the
 * source key is converted to a number — finiteness is then checked by the
 * BMSSP constructor's vertex validation.
 */
function adjacencyToNormalized(entries, coerceKeys) {
  const edges = [];
  const vertices = [];
  for (const [rawFrom, neighbors] of entries) {
    const from = coerceKeys ? Number(rawFrom) : rawFrom;
    vertices.push(from);
    if (neighbors == null) continue;
    if (!isIterable(neighbors)) {
      throw new Error(
        `Adjacency list for node ${rawFrom} must be an iterable of [to, weight]`,
      );
    }
    for (const pair of neighbors) {
      if (!Array.isArray(pair) || pair.length !== 2) {
        throw new Error(
          `Adjacency entry for node ${rawFrom} must be [to, weight]`,
        );
      }
      edges.push([from, pair[0], pair[1]]);
    }
  }
  return { edges, vertices };
}

/**
 * Normalize any accepted graph input into `{ edges, vertices }`:
 * - a `Graph` builder instance,
 * - an edge array `[[from, to, weight], ...]` (vertices inferred from edges),
 * - an adjacency `Map<from, Iterable<[to, weight]>>`, or
 * - a plain adjacency object `{ from: [[to, weight], ...] }` (numeric-string
 *   keys, coerced to numbers).
 *
 * Only structural checks live here; per-edge value validation stays in the
 * BMSSP constructor so its "Edge at index N" messages remain the single
 * source of truth.
 * @param {*} input
 * @returns {{ edges: number[][], vertices: number[] }}
 */
function normalizeGraphInput(input) {
  if (input instanceof Graph) {
    return input.toNormalized();
  }
  if (Array.isArray(input)) {
    return { edges: input, vertices: [] };
  }
  if (input instanceof Map) {
    return adjacencyToNormalized(input.entries(), false);
  }
  if (input !== null && typeof input === "object") {
    return adjacencyToNormalized(Object.entries(input), true);
  }
  throw new Error(
    "Input graph must be an edge array, an adjacency map/object, or a Graph instance",
  );
}

export { Graph, normalizeGraphInput };
