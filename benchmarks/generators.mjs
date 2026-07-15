// Deterministic graph generators for benchmarking.
//
// Every generator returns an array of [from, to, weight] edges with numeric
// node IDs in [0, n) and positive integer weights, matching the input format
// the BMSSP class and the dijkstra oracle expect.
//
// A small seeded PRNG keeps runs reproducible so benchmark numbers are
// comparable across machines and commits.

// Mulberry32 — tiny, fast, deterministic PRNG. Good enough for benchmarks.
export function makeRng(seed = 0x9e3779b9) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MAX_WEIGHT = 1e8;

function weight(rng) {
  return Math.floor(rng() * MAX_WEIGHT) + 1;
}

// Sparse random directed graph: each node gets `degree` random out-edges.
// This is the "road-like" regime (m = O(n)) where BMSSP's asymptotics apply.
export function sparseRandom(n, degree = 3, seed = 1) {
  const rng = makeRng(seed);
  const edges = [];
  for (let u = 0; u < n; u++) {
    for (let d = 0; d < degree; d++) {
      let v = Math.floor(rng() * n);
      if (v === u) v = (v + 1) % n;
      edges.push([u, v, weight(rng)]);
    }
  }
  return edges;
}

// Dense random directed graph: m ≈ n * avgDegree with a high average degree.
// The regime where Dijkstra's O(m + n log n) is dominated by m and the
// sorting term is comparatively cheap.
export function denseRandom(n, avgDegree = 32, seed = 2) {
  const rng = makeRng(seed);
  const edges = [];
  const deg = Math.min(avgDegree, n - 1);
  for (let u = 0; u < n; u++) {
    for (let d = 0; d < deg; d++) {
      let v = Math.floor(rng() * n);
      if (v === u) v = (v + 1) % n;
      edges.push([u, v, weight(rng)]);
    }
  }
  return edges;
}

// 2D grid lattice (4-neighborhood), directed both ways. side*side nodes.
// Uniform low degree with large diameter — typical of spatial/mesh problems.
export function grid(side, seed = 3) {
  const rng = makeRng(seed);
  const edges = [];
  const id = (x, y) => y * side + x;
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      if (x + 1 < side) {
        edges.push([id(x, y), id(x + 1, y), weight(rng)]);
        edges.push([id(x + 1, y), id(x, y), weight(rng)]);
      }
      if (y + 1 < side) {
        edges.push([id(x, y), id(x, y + 1), weight(rng)]);
        edges.push([id(x, y + 1), id(x, y), weight(rng)]);
      }
    }
  }
  return edges;
}

// Simple chain 0 -> 1 -> ... -> n-1. Maximum depth, minimum branching:
// the pathological "long path" case for any frontier-based method.
export function chain(n, seed = 4) {
  const rng = makeRng(seed);
  const edges = [];
  for (let u = 0; u + 1 < n; u++) {
    edges.push([u, u + 1, weight(rng)]);
  }
  return edges;
}

// Star: one hub (node 0) with edges to and from every other node.
// Extreme skew — one node holds n-1 edges, the rest hold O(1).
export function star(n, seed = 5) {
  const rng = makeRng(seed);
  const edges = [];
  for (let u = 1; u < n; u++) {
    edges.push([0, u, weight(rng)]);
    edges.push([u, 0, weight(rng)]);
  }
  return edges;
}

// Registry of named scenarios sized to run in a few seconds each.
export const SCENARIOS = [
  {
    name: "sparse-random",
    blurb: "m = O(n), degree 3 — the road-network regime",
    build: () => sparseRandom(50_000, 3, 11),
  },
  {
    name: "dense-random",
    blurb: "avg degree 32 — edge-relaxation-bound",
    build: () => denseRandom(8_000, 32, 12),
  },
  {
    name: "grid-4nbr",
    blurb: "200x200 lattice — large diameter, low degree",
    build: () => grid(200, 13),
  },
  {
    name: "chain",
    blurb: "single long path — worst-case depth",
    build: () => chain(50_000, 14),
  },
  {
    name: "star",
    blurb: "one hub, n-1 spokes — extreme degree skew",
    build: () => star(50_000, 15),
  },
];
