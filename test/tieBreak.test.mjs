import { describe, test, expect } from "@jest/globals";
import {
  compareKeys,
  compareKeyParts,
  toBound,
  makeTies,
  orderKey,
  relaxEdge,
  RELAX_LOST,
  RELAX_EQUAL,
  RELAX_IMPROVED,
  resetComparisonCount,
  getComparisonCount,
} from "../src/tieBreak.mjs";
import { BMSSP } from "../src/bmssp.mjs";
import { dijkstra } from "../src/dijkstra.mjs";

// Small deterministic PRNG so stress-test failures are reproducible
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Seeded Fisher-Yates shuffle (copy) — permutes the edge list to probe
// iteration-order independence
function shuffled(edges, rand) {
  const copy = edges.map((e) => [...e]);
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Seeded random graph drenched in ties: tiny integer weights (0-2) make
// equal-length paths and zero-weight plateaus the norm
function tiedEdges(rand, n, m) {
  const edges = [[0, 1 + Math.floor(rand() * (n - 1)), 1]];
  for (let i = 1; i < m; i += 1) {
    edges.push([
      Math.floor(rand() * n),
      Math.floor(rand() * n),
      Math.floor(rand() * 3),
    ]);
  }
  return edges;
}

// Reference oracle for the canonical labels: an O(n^2) Dijkstra over the
// lexicographic (length, hops) metric. Returns per-vertex distance and the
// minimal hop count among all shortest paths.
function lexDijkstra(edges, nodeIDs, source) {
  const adj = new Map();
  for (const id of nodeIDs) adj.set(id, []);
  for (const [from, to, weight] of edges) adj.get(from).push([to, weight]);
  const dist = new Map();
  const hop = new Map();
  for (const id of nodeIDs) {
    dist.set(id, Infinity);
    hop.set(id, Infinity);
  }
  dist.set(source, 0);
  hop.set(source, 0);
  const done = new Set();
  for (;;) {
    let best = null;
    for (const id of nodeIDs) {
      if (done.has(id) || dist.get(id) === Infinity) continue;
      if (
        best === null ||
        dist.get(id) < dist.get(best) ||
        (dist.get(id) === dist.get(best) && hop.get(id) < hop.get(best))
      ) {
        best = id;
      }
    }
    if (best === null) break;
    done.add(best);
    for (const [v, weight] of adj.get(best)) {
      const nd = dist.get(best) + weight;
      const nh = hop.get(best) + 1;
      if (nd < dist.get(v) || (nd === dist.get(v) && nh < hop.get(v))) {
        dist.set(v, nd);
        hop.set(v, nh);
      }
    }
  }
  return { dist, hop };
}

describe("compareKeys — lexicographic composite order", () => {
  test("length dominates, then hops, then id", () => {
    expect(compareKeys([1, 9, 9], [2, 0, 0])).toBeLessThan(0);
    expect(compareKeys([1, 2, 9], [1, 3, 0])).toBeLessThan(0);
    expect(compareKeys([1, 2, 3], [1, 2, 4])).toBeLessThan(0);
    expect(compareKeys([1, 2, 3], [1, 2, 3])).toBe(0);
    expect(compareKeys([2, 0, 0], [1, 9, 9])).toBeGreaterThan(0);
  });

  test("handles Infinity components (no NaN subtraction traps)", () => {
    expect(compareKeys([Infinity, 0, 1], [Infinity, 0, 2])).toBeLessThan(0);
    expect(compareKeys([Infinity, 0, 1], [Infinity, 0, 1])).toBe(0);
    expect(
      compareKeys([5, 1, 1], [Infinity, -Infinity, -Infinity]),
    ).toBeLessThan(0);
  });

  test("compareKeyParts agrees with compareKeys on every component branch (#168)", () => {
    const keys = [
      [1, 9, 9],
      [2, 0, 0],
      [1, 2, 9],
      [1, 3, 0],
      [1, 2, 3],
      [1, 2, 4],
      [Infinity, 0, 1],
      [Infinity, -Infinity, -Infinity],
    ];
    for (const a of keys) {
      for (const b of keys) {
        expect(Math.sign(compareKeyParts(a[0], a[1], a[2], b))).toBe(
          Math.sign(compareKeys(a, b)),
        );
      }
    }
  });
});

describe("toBound — scalar bounds keep strict semantics", () => {
  test("a scalar bound sits below every real key of the same length", () => {
    const bound = toBound(10);
    // Any real path of length 10 is NOT below the bound…
    expect(compareKeys([10, 0, 0], bound)).toBeGreaterThan(0);
    // …every shorter path is
    expect(compareKeys([9.5, 999, 999], bound)).toBeLessThan(0);
  });

  test("composite bounds pass through unchanged", () => {
    const key = [4, 2, 7];
    expect(toBound(key)).toBe(key);
  });
});

describe("relaxEdge — canonical relaxation", () => {
  test("updates d̂, hops and preds together on improvement", () => {
    const dHat = new Map([
      [0, 0],
      [1, Infinity],
    ]);
    const ties = makeTies();
    const result = relaxEdge(0, 1, 5, dHat, ties);
    expect(result).toBe(RELAX_IMPROVED);
    expect(dHat.get(1)).toBe(5);
    expect(ties.hops.get(1)).toBe(1);
    expect(ties.preds.get(1)).toBe(0);
    expect(orderKey(1, dHat, ties)).toEqual([5, 1, 1]);
  });

  test("equal-length candidates win only on fewer hops, then smaller pred", () => {
    const dHat = new Map([
      [0, 0],
      [7, 3],
      [3, 3],
      [9, 3],
      [5, 6],
    ]);
    const ties = makeTies(
      new Map([
        [7, 1],
        [3, 1],
        [9, 1],
        [5, 2],
      ]),
      new Map([[5, 7]]),
    );
    // Same length (3 + 3 = 6), same hops (3), pred 9 > current pred 7: no
    expect(relaxEdge(9, 5, 3, dHat, ties)).toBe(RELAX_LOST);
    expect(ties.preds.get(5)).toBe(7);
    // Same length, same hops, pred 3 < current pred 7: canonical update
    expect(relaxEdge(3, 5, 3, dHat, ties)).toBe(RELAX_IMPROVED);
    expect(orderKey(5, dHat, ties)).toEqual([6, 2, 5]);
    expect(ties.preds.get(5)).toBe(3);
    // Re-relaxation from the now-canonical pred reports exact equality —
    // the caller's re-enqueue signal — without touching the labels
    expect(relaxEdge(3, 5, 3, dHat, ties)).toBe(RELAX_EQUAL);
    expect(orderKey(5, dHat, ties)).toEqual([6, 2, 5]);
    expect(ties.preds.get(5)).toBe(3);
  });

  test("a zero-weight edge strictly increases the key: cycles cannot loop", () => {
    const dHat = new Map([
      [0, 2],
      [1, 2],
    ]);
    const ties = makeTies(
      new Map([
        [0, 1],
        [1, 2],
      ]),
      new Map([
        [0, 5],
        [1, 0],
      ]),
    );
    // 1 -> 0 with weight 0: candidate [2, 3, 1] vs current [2, 1, 5] — the
    // extra hops lose outright
    expect(relaxEdge(1, 0, 0, dHat, ties)).toBe(RELAX_LOST);
    // 0 -> 1 with weight 0 reproduces 1's canonical label exactly: reported
    // as equality, no update — so the cycle is quiescent, never looping
    expect(relaxEdge(0, 1, 0, dHat, ties)).toBe(RELAX_EQUAL);
    expect(orderKey(1, dHat, ties)).toEqual([2, 2, 1]);
    expect(ties.hops.get(1)).toBe(2);
  });

  test("a source (no stored pred) never loses an equal-(length, hops) tie", () => {
    const dHat = new Map([
      [4, 0],
      [2, 5],
    ]);
    const ties = makeTies(new Map([[2, 0]]), new Map());
    // Vertex 2 is an externally seeded hop-0 source at distance 5; an
    // equal-length, equal-hops... any candidate has hops >= 1 > 0, and even
    // a shorter-hop tie would face the -Infinity pred sentinel
    expect(relaxEdge(4, 2, 5, dHat, ties)).toBe(RELAX_LOST);
    expect(dHat.get(2)).toBe(5);
  });

  test("the optional bound gates the update entirely (paper's < B)", () => {
    const dHat = new Map([
      [0, 0],
      [1, Infinity],
    ]);
    const ties = makeTies();
    expect(relaxEdge(0, 1, 5, dHat, ties, toBound(5))).toBe(RELAX_LOST);
    expect(dHat.get(1)).toBe(Infinity);
    expect(ties.preds.has(1)).toBe(false);
    expect(relaxEdge(0, 1, 5, dHat, ties, toBound(5.1))).toBe(RELAX_IMPROVED);
    expect(orderKey(1, dHat, ties)).toEqual([5, 1, 1]);
  });

  test("orderKey defaults: missing labels read as hop-0, distance Infinity", () => {
    const dHat = new Map([[3, 4]]);
    const ties = makeTies();
    expect(orderKey(3, dHat, ties)).toEqual([4, 0, 3]);
    expect(orderKey(99, dHat, ties)).toEqual([Infinity, 0, 99]);
  });
});

describe("determinism (#163): edge order never changes the outcome", () => {
  test("full runs on tie-heavy graphs: identical d̂, hops and preds across permutations", () => {
    const rand = mulberry32(1630);
    for (let round = 0; round < 15; round += 1) {
      const n = 20 + Math.floor(rand() * 30);
      const edges = tiedEdges(rand, n, n * 4);
      const reference = new BMSSP(edges);
      reference.calculateShortestPaths(0);
      for (let p = 0; p < 3; p += 1) {
        const permuted = new BMSSP(shuffled(edges, rand));
        permuted.calculateShortestPaths(0);
        for (const v of reference.nodeIDs) {
          expect(permuted.shortestPaths.get(v)).toBe(
            reference.shortestPaths.get(v),
          );
          expect(permuted.hops.get(v)).toBe(reference.hops.get(v));
          expect(permuted.preds.get(v)).toBe(reference.preds.get(v));
        }
      }
    }
  });

  test("bounded partial calls: identical bound, boundKey and completed set across permutations", () => {
    const rand = mulberry32(1631);
    for (let round = 0; round < 15; round += 1) {
      const n = 25 + Math.floor(rand() * 25);
      const edges = tiedEdges(rand, n, n * 4);
      const probe = new BMSSP(edges);
      const oracle = dijkstra(probe.graph, probe.nodeIDs, 0);
      const finite = [...oracle.values()]
        .filter((d) => d < Infinity)
        .sort((a, b) => a - b);
      // A boundary deliberately placed ON a tied distance value
      const B = finite[Math.floor(finite.length * 0.5)];
      const run = (graphEdges) => {
        const bmssp = new BMSSP(graphEdges);
        bmssp.initializeShortestPaths();
        bmssp.shortestPaths.set(0, 0);
        bmssp.hops.set(0, 0);
        return bmssp.bmssp(bmssp.topLevel, B, new Set([0]));
      };
      const reference = run(edges);
      for (let p = 0; p < 3; p += 1) {
        const permuted = run(shuffled(edges, rand));
        expect(permuted.bound).toBe(reference.bound);
        expect(permuted.boundKey).toEqual(reference.boundKey);
        expect(permuted.vertices).toEqual(reference.vertices);
      }
    }
  });
});

describe("strict Lemma 3.1 (#163): no boundary ties in the composite order", () => {
  test("returned vertices sit strictly below boundKey even on tie-heavy graphs", () => {
    const rand = mulberry32(1632);
    for (let round = 0; round < 20; round += 1) {
      const n = 20 + Math.floor(rand() * 30);
      const edges = tiedEdges(rand, n, n * 4);
      const bmssp = new BMSSP(edges);
      const oracle = dijkstra(bmssp.graph, bmssp.nodeIDs, 0);
      const finite = [...oracle.values()]
        .filter((d) => d < Infinity)
        .sort((a, b) => a - b);
      const B = finite[Math.floor(finite.length * 0.6)];
      bmssp.initializeShortestPaths();
      bmssp.shortestPaths.set(0, 0);
      bmssp.hops.set(0, 0);
      const { bound, boundKey, vertices } = bmssp.bmssp(
        bmssp.topLevel,
        B,
        new Set([0]),
      );
      for (const v of vertices) {
        // Complete, scalar-below-or-tying the bound, strictly below the key
        expect(bmssp.shortestPaths.get(v)).toBe(oracle.get(v));
        expect(oracle.get(v)).toBeLessThanOrEqual(
          typeof bound === "number" ? bound : bound[0],
        );
        expect(
          compareKeys(orderKey(v, bmssp.shortestPaths, bmssp.ties), boundKey),
        ).toBeLessThan(0);
      }
      // Strict completeness: every reachable vertex whose key is below
      // boundKey must be in the returned set
      for (const [v, d] of oracle) {
        if (d === Infinity) continue;
        if (
          bmssp.shortestPaths.get(v) === d &&
          compareKeys(orderKey(v, bmssp.shortestPaths, bmssp.ties), boundKey) <
            0
        ) {
          expect(vertices.has(v)).toBe(true);
        }
      }
    }
  });

  test("zero-weight clusters (the old stall scenario) keep the strict contract", () => {
    // The pre-#163 escape-hatch graph: a zero-weight cluster at the source
    const edges = [
      [0, 1, 0],
      [1, 0, 0],
      [1, 2, 0],
      [2, 3, 1],
      [3, 4, 2],
    ];
    const bmssp = new BMSSP(edges);
    bmssp.initializeShortestPaths();
    bmssp.shortestPaths.set(0, 0);
    bmssp.hops.set(0, 0);
    // Bound tied exactly on the cluster's distance 0: only the cluster
    // members with key strictly below [0, -Inf, -Inf]... none — so a bound
    // above 0 must complete the whole cluster, strictly ordered by hops
    const { bound, vertices } = bmssp.bmssp(bmssp.topLevel, 1, new Set([0]));
    expect(bound).toBe(1);
    expect(vertices).toEqual(new Set([0, 1, 2]));
    expect(bmssp.hops.get(1)).toBe(1);
    expect(bmssp.hops.get(2)).toBe(2);
  });
});

describe("canonical labels (#163): hops and preds are the lexicographic optimum", () => {
  test("hops equal the minimal edge count among shortest paths (lex oracle)", () => {
    const rand = mulberry32(1633);
    for (let round = 0; round < 15; round += 1) {
      const n = 15 + Math.floor(rand() * 25);
      const edges = tiedEdges(rand, n, n * 4);
      const bmssp = new BMSSP(edges);
      bmssp.calculateShortestPaths(0);
      const { dist, hop } = lexDijkstra(bmssp.graph, bmssp.nodeIDs, 0);
      for (const v of bmssp.nodeIDs) {
        expect(bmssp.shortestPaths.get(v)).toBe(dist.get(v));
        if (dist.get(v) < Infinity) {
          expect(bmssp.hops.get(v)).toBe(hop.get(v));
        }
      }
    }
  });

  test("preds form a tree of tight edges choosing the smallest optimal parent", () => {
    const rand = mulberry32(1634);
    for (let round = 0; round < 15; round += 1) {
      const n = 15 + Math.floor(rand() * 25);
      const edges = tiedEdges(rand, n, n * 4);
      const bmssp = new BMSSP(edges);
      bmssp.calculateShortestPaths(0);
      const { dist, hop } = lexDijkstra(bmssp.graph, bmssp.nodeIDs, 0);
      for (const v of bmssp.nodeIDs) {
        if (v === 0 || dist.get(v) === Infinity) continue;
        // The canonical parent is the smallest-id in-neighbor u with a
        // (length, hops)-tight edge into v
        let expected = null;
        for (const [from, to, weight] of bmssp.graph) {
          if (to !== v) continue;
          if (
            dist.get(from) + weight === dist.get(v) &&
            hop.get(from) + 1 === hop.get(v)
          ) {
            if (expected === null || from < expected) expected = from;
          }
        }
        expect(bmssp.preds.get(v)).toBe(expected);
        // Walking the pred chain reaches the source without cycles
        let cursor = v;
        let steps = 0;
        while (cursor !== 0) {
          cursor = bmssp.preds.get(cursor);
          steps += 1;
          expect(steps).toBeLessThanOrEqual(bmssp.nodeIDs.size);
        }
      }
    }
  });
});

describe("comparison counter (#170): benchmark instrumentation", () => {
  test("resets to zero and counts each compareKeys call", () => {
    resetComparisonCount();
    expect(getComparisonCount()).toBe(0);
    compareKeys([1, 0, 0], [2, 0, 0]);
    compareKeys([1, 0, 0], [1, 0, 0]);
    expect(getComparisonCount()).toBe(2);
    resetComparisonCount();
    expect(getComparisonCount()).toBe(0);
  });

  test("counts comparisons made inside relaxEdge", () => {
    const dHat = new Map([
      [0, 0],
      [1, Infinity],
    ]);
    const ties = makeTies();
    resetComparisonCount();
    relaxEdge(0, 1, 5, dHat, ties);
    expect(getComparisonCount()).toBeGreaterThan(0);
  });

  test("a full BMSSP run performs comparisons through the counter", () => {
    const bmssp = new BMSSP([
      [0, 1, 1],
      [1, 2, 2],
      [0, 2, 5],
    ]);
    resetComparisonCount();
    bmssp.calculateShortestPaths(0);
    expect(getComparisonCount()).toBeGreaterThan(0);
    expect(bmssp.shortestPaths.get(2)).toBe(3);
  });
});
