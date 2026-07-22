import { describe, test, expect } from "@jest/globals";
import { BMSSP } from "../src/bmssp.mjs";
import { dijkstra } from "../src/dijkstra.mjs";
import {
  makeRng,
  sparseRandom,
  denseRandom,
  grid,
  chain,
  star,
} from "../benchmarks/generators.mjs";
import { edgesOf } from "./helpers.mjs";

// High-volume property/fuzz suite (#161): seeded random graphs across many
// shapes and weight regimes, always validated against the Dijkstra oracle.
//
// Every check is labeled with the round's seed (plus shape/size/source), so a
// red run is reproducible by pinning that seed in a focused test.
//
// FUZZ_ROUNDS multiplies every round count (default 1) for high-volume runs:
//   FUZZ_ROUNDS=25 npm test -- test/fuzz.test.mjs
// FUZZ_XL=1 additionally runs the 2M-node seeded scale round (~30 s):
//   FUZZ_XL=1 npm test -- test/fuzz.test.mjs

const ROUNDS = Math.max(1, Math.floor(Number(process.env.FUZZ_ROUNDS) || 1));
const FUZZ_TIMEOUT = 120_000;

function pickInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

function pickSeed(rng) {
  return Math.floor(rng() * 0x7fffffff);
}

// Random DAG: every edge is oriented from the lower id to the higher one,
// so no cycles exist and long dependency chains are common.
function randomDag(rng, n, m) {
  const edges = [];
  for (let i = 0; i < m; i += 1) {
    const a = Math.floor(rng() * n);
    const b = Math.floor(rng() * n);
    if (a === b) continue;
    edges.push([Math.min(a, b), Math.max(a, b), 1 + Math.floor(rng() * 1e6)]);
  }
  if (edges.length === 0) edges.push([0, 1, 1]);
  return edges;
}

// Fully random multigraph: self-loops and duplicate edges allowed.
function uniformRandom(rng, n, m) {
  const edges = [];
  for (let i = 0; i < m; i += 1) {
    edges.push([
      Math.floor(rng() * n),
      Math.floor(rng() * n),
      1 + Math.floor(rng() * 1e6),
    ]);
  }
  return edges;
}

// Several small components with no edges between them: most of the graph is
// unreachable from any single source and must stay at Infinity.
function disconnectedForest(rng, components) {
  const edges = [];
  let base = 0;
  for (let c = 0; c < components; c += 1) {
    const size = pickInt(rng, 2, 12);
    for (let u = 0; u < size; u += 1) {
      const outDegree = pickInt(rng, 1, 2);
      for (let d = 0; d < outDegree; d += 1) {
        edges.push([
          base + u,
          base + Math.floor(rng() * size),
          1 + Math.floor(rng() * 1e6),
        ]);
      }
    }
    base += size;
  }
  return edges;
}

// Keep the topology of `edges` but replace every weight via `regime(rng)`.
function reweight(edges, rng, regime) {
  return edges.map(([from, to]) => [from, to, regime(rng)]);
}

// Deterministically pick an existing node id as the source.
function pickSource(rng, nodeIDs) {
  const nodes = [...nodeIDs].sort((a, b) => a - b);
  return nodes[Math.floor(rng() * nodes.length)];
}

// Run BMSSP end-to-end and require the full distance map to equal the
// Dijkstra oracle's. Returns the number of nodes compared. `Object.is`
// distinguishes nothing extra here (weights are chosen so every sum is an
// exact float64); it simply makes the intent — bit-exact equality — explicit.
function checkFullMapAgainstOracle(edges, source, label) {
  const bmssp = new BMSSP(edges);
  bmssp.calculateShortestPaths(source);
  const oracle = dijkstra(edgesOf(bmssp), bmssp.nodeIDs, source);
  if (bmssp.shortestPaths.size !== oracle.size) {
    throw new Error(
      `${label}: map size mismatch: BMSSP ${bmssp.shortestPaths.size}, ` +
        `Dijkstra ${oracle.size}`,
    );
  }
  for (const [v, d] of oracle) {
    const got = bmssp.shortestPaths.get(v);
    if (!Object.is(got, d)) {
      throw new Error(
        `${label}: distance mismatch at node ${v}: BMSSP ${got}, Dijkstra ${d}`,
      );
    }
  }
  return oracle.size;
}

describe("fuzz: full-map oracle equality across graph shapes", () => {
  // Star sizes stay modest on purpose: high fanout is a known performance
  // (not correctness) pathology — see #182.
  const SHAPES = [
    [
      "sparse-random",
      (rng) => sparseRandom(pickInt(rng, 20, 200), 3, pickSeed(rng)),
    ],
    [
      "dense-random",
      (rng) => denseRandom(pickInt(rng, 20, 100), 12, pickSeed(rng)),
    ],
    ["grid", (rng) => grid(pickInt(rng, 3, 14), pickSeed(rng))],
    ["chain", (rng) => chain(pickInt(rng, 10, 400), pickSeed(rng))],
    ["star", (rng) => star(pickInt(rng, 10, 300), pickSeed(rng))],
    [
      "dag",
      (rng) => randomDag(rng, pickInt(rng, 20, 200), pickInt(rng, 40, 600)),
    ],
    [
      "disconnected-forest",
      (rng) => disconnectedForest(rng, pickInt(rng, 2, 6)),
    ],
    [
      "uniform-random",
      (rng) => uniformRandom(rng, pickInt(rng, 10, 150), pickInt(rng, 20, 500)),
    ],
  ];

  for (const [shape, build] of SHAPES) {
    test(
      `${shape}: random sizes and sources keep matching the oracle`,
      () => {
        let compared = 0;
        for (let round = 0; round < 25 * ROUNDS; round += 1) {
          const seed = 161_000 + round;
          const rng = makeRng(seed);
          const edges = build(rng);
          // Two independent sources per graph exercise re-initialization
          const bmssp = new BMSSP(edges);
          for (let s = 0; s < 2; s += 1) {
            const source = pickSource(rng, bmssp.nodeIDs);
            const label = `${shape} seed=${seed} n=${bmssp.nodeIDs.size} source=${source}`;
            compared += checkFullMapAgainstOracle(edges, source, label);
          }
        }
        expect(compared).toBeGreaterThan(0);
      },
      FUZZ_TIMEOUT,
    );
  }

  test(
    "larger instances: sparse, grid and DAG in the thousands of nodes",
    () => {
      let compared = 0;
      compared += checkFullMapAgainstOracle(
        sparseRandom(3000, 3, 1611),
        0,
        "large sparse seed=1611",
      );
      compared += checkFullMapAgainstOracle(
        grid(45, 1612),
        0,
        "large grid seed=1612",
      );
      const rng = makeRng(1613);
      compared += checkFullMapAgainstOracle(
        randomDag(rng, 2500, 7500),
        0,
        "large dag seed=1613",
      );
      expect(compared).toBeGreaterThan(0);
    },
    FUZZ_TIMEOUT,
  );
});

describe("fuzz: extreme weight regimes", () => {
  // All regimes produce weights whose path sums are exact in float64
  // (integers below 2^53, or dyadic rationals — multiples of 1/256 — with
  // small magnitude), so oracle equality can stay bit-exact even for floats.
  const REGIMES = [
    ["all-zero", () => 0],
    ["zero-or-huge", (rng) => (rng() < 0.5 ? 0 : 1e12)],
    ["tiny-int", (rng) => Math.floor(rng() * 3)],
    ["dyadic-float", (rng) => Math.floor(rng() * (1 << 20)) / 256],
  ];

  // Sizes stay small: zero-weight clusters route BMSSP through its stall
  // escape hatch, which is deliberately not sublinear.
  const SMALL_SHAPES = [
    [
      "sparse-random",
      (rng) => sparseRandom(pickInt(rng, 10, 50), 3, pickSeed(rng)),
    ],
    ["grid", (rng) => grid(pickInt(rng, 3, 7), pickSeed(rng))],
    [
      "uniform-random",
      (rng) => uniformRandom(rng, pickInt(rng, 8, 40), pickInt(rng, 16, 160)),
    ],
  ];

  for (const [regime, weightOf] of REGIMES) {
    test(
      `${regime}: every shape keeps matching the oracle`,
      () => {
        let compared = 0;
        for (const [shape, build] of SMALL_SHAPES) {
          for (let round = 0; round < 15 * ROUNDS; round += 1) {
            const seed = 162_000 + round;
            const rng = makeRng(seed);
            const edges = reweight(build(rng), rng, weightOf);
            const bmssp = new BMSSP(edges);
            const source = pickSource(rng, bmssp.nodeIDs);
            const label = `${regime}/${shape} seed=${seed} n=${bmssp.nodeIDs.size} source=${source}`;
            compared += checkFullMapAgainstOracle(edges, source, label);
          }
        }
        expect(compared).toBeGreaterThan(0);
      },
      FUZZ_TIMEOUT,
    );
  }
});

describe("fuzz: seeded scale runs", () => {
  // These replace the old roadNet-CA.txt fixture (a real 2M-node road
  // network with unseeded random weights): same sparse m = O(n) regime, but
  // reproducible and generated on the fly. Recursion depth is NOT what scale
  // buys here — topLevel is 3 from n = 10k all the way to 2M (the 3 → 4 step
  // sits near n = 4M, see #182) — the value is volume: block-list churn,
  // memory pressure, and millions of oracle-checked distances.
  test(
    "sparse n = 150k matches the oracle at topLevel 3",
    () => {
      const edges = sparseRandom(150_000, 3, 1651);
      expect(new BMSSP(edges).topLevel).toBe(3);
      checkFullMapAgainstOracle(edges, 0, "scale sparse seed=1651");
    },
    FUZZ_TIMEOUT,
  );

  test(
    "grid 300×300 (n = 90k) matches the oracle",
    () => {
      checkFullMapAgainstOracle(grid(300, 1652), 0, "scale grid seed=1652");
    },
    FUZZ_TIMEOUT,
  );

  // Opt-in XL round: the old road-network scale, seeded. ~30 s, so it stays
  // out of the default `npm test` (and CI) budget.
  (process.env.FUZZ_XL ? test : test.skip)(
    "XL: sparse n = 2M matches the oracle",
    () => {
      const edges = sparseRandom(2_000_000, 3, 1653);
      checkFullMapAgainstOracle(edges, 0, "xl sparse seed=1653");
    },
    600_000,
  );
});

describe("fuzz: multi-source bounded bmssp() against per-source oracles", () => {
  // Ground truth for a multi-source call with initial distances d0[s]:
  // trueDist(v) = min over sources s of (d0[s] + dist_s(v)), i.e. shortest
  // paths from a virtual super-source. Sources are made complete by fixing
  // d̂[s] up to trueDist(s) (one source may undercut another), which is
  // exactly the precondition Lemma 3.1 assumes.
  function buildMultiSourceCase(seed) {
    const rng = makeRng(seed);
    const n = pickInt(rng, 20, 150);
    const shapePick = rng();
    let edges;
    if (shapePick < 0.34) edges = sparseRandom(n, 3, pickSeed(rng));
    else if (shapePick < 0.67) edges = randomDag(rng, n, n * 3);
    else edges = uniformRandom(rng, n, n * 3);
    // A quarter of the rounds use tie-heavy tiny weights (0-2)
    if (rng() < 0.25) {
      edges = reweight(edges, rng, () => Math.floor(rng() * 3));
    }

    const bmssp = new BMSSP(edges);
    const nodes = [...bmssp.nodeIDs].sort((a, b) => a - b);
    const sourceCount = pickInt(rng, 1, Math.min(4, nodes.length));
    const initial = new Map();
    while (initial.size < sourceCount) {
      const scale = rng() < 0.5 ? 1000 : 1e7;
      initial.set(
        nodes[Math.floor(rng() * nodes.length)],
        Math.floor(rng() * scale),
      );
    }

    const oracles = new Map();
    for (const s of initial.keys()) {
      oracles.set(s, dijkstra(edgesOf(bmssp), bmssp.nodeIDs, s));
    }
    const trueDist = new Map();
    for (const v of nodes) {
      let best = Infinity;
      for (const [s, d0] of initial) {
        best = Math.min(best, d0 + oracles.get(s).get(v));
      }
      trueDist.set(v, best);
    }

    bmssp.initializeShortestPaths();
    for (const s of initial.keys()) {
      bmssp.shortestPaths.set(s, trueDist.get(s));
    }
    return { rng, bmssp, sources: new Set(initial.keys()), trueDist };
  }

  // Check the Lemma 3.1 contract for a finished bmssp() call.
  function checkContract(bmssp, trueDist, B, bound, vertices, label) {
    if (!(bound <= B)) {
      throw new Error(`${label}: bound ${bound} exceeds B ${B}`);
    }
    for (const v of vertices) {
      if (!Object.is(bmssp.shortestPaths.get(v), trueDist.get(v))) {
        throw new Error(
          `${label}: returned vertex ${v} incomplete: d̂ ` +
            `${bmssp.shortestPaths.get(v)}, true ${trueDist.get(v)}`,
        );
      }
      // The paper's Lemma 3.1 states d(v) < B' for every returned vertex,
      // but that strictness assumes distinct path lengths (Assumption 2.1).
      // With ties, the stall escape hatch can settle — and must return —
      // a vertex tied exactly at the boundary (fuzz-found at seed 163066;
      // see the tie deviations tracked in #163), so the honest contract
      // is d(v) <= B'.
      if (!(trueDist.get(v) <= bound)) {
        throw new Error(
          `${label}: returned vertex ${v} at distance ${trueDist.get(v)} ` +
            `above bound ${bound}`,
        );
      }
    }
    for (const [v, d] of trueDist) {
      if (d < bound && !vertices.has(v)) {
        throw new Error(
          `${label}: vertex ${v} at distance ${d} below bound ${bound} ` +
            `missing from U`,
        );
      }
    }
    for (const [v, dHat] of bmssp.shortestPaths) {
      if (dHat < trueDist.get(v)) {
        throw new Error(
          `${label}: d̂ underestimates at ${v}: ${dHat} < ${trueDist.get(v)}`,
        );
      }
    }
    return vertices.size;
  }

  test(
    "bounded calls satisfy the Lemma 3.1 contract",
    () => {
      let returned = 0;
      for (let round = 0; round < 60 * ROUNDS; round += 1) {
        const seed = 163_000 + round;
        const { rng, bmssp, sources, trueDist } = buildMultiSourceCase(seed);
        const finite = [...trueDist.values()]
          .filter((d) => d < Infinity)
          .sort((a, b) => a - b);
        // B lands mid-distribution; half the rounds put it exactly on an
        // existing distance so boundary ties are exercised
        const q = finite[Math.floor(finite.length * (0.3 + rng() * 0.6))];
        const B = rng() < 0.5 ? q : q + 0.5;
        const label = `multi-source seed=${seed} |S|=${sources.size} B=${B}`;
        const { bound, vertices } = bmssp.bmssp(bmssp.topLevel, B, sources);
        returned += checkContract(bmssp, trueDist, B, bound, vertices, label);
      }
      expect(returned).toBeGreaterThan(0);
    },
    FUZZ_TIMEOUT,
  );

  test(
    "unbounded calls are successful executions settling the reachable set",
    () => {
      let returned = 0;
      for (let round = 0; round < 30 * ROUNDS; round += 1) {
        const seed = 164_000 + round;
        const { bmssp, sources, trueDist } = buildMultiSourceCase(seed);
        const label = `multi-source seed=${seed} |S|=${sources.size} B=Infinity`;
        const { bound, vertices } = bmssp.bmssp(
          bmssp.topLevel,
          Infinity,
          sources,
        );
        if (bound !== Infinity) {
          throw new Error(`${label}: expected bound Infinity, got ${bound}`);
        }
        returned += checkContract(
          bmssp,
          trueDist,
          Infinity,
          bound,
          vertices,
          label,
        );
        const reachable = new Set(
          [...trueDist].filter(([, d]) => d < Infinity).map(([v]) => v),
        );
        if (vertices.size !== reachable.size) {
          throw new Error(
            `${label}: settled ${vertices.size} vertices, ` +
              `reachable set has ${reachable.size}`,
          );
        }
      }
      expect(returned).toBeGreaterThan(0);
    },
    FUZZ_TIMEOUT,
  );
});
