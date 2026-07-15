# 05 — Codebase Map (current state)

<!-- BOOKMARK-COMMIT: 611cd53306240b182b6be29c2ad7867de87ae7a4 -->
<!-- BOOKMARK-BRANCH: feat/45-adjacency-map -->
<!-- Last validated against the above commit (RKB refresh). This commit is on the #45 feature
     branch; when PR #160 merges, main HEAD will differ and session start will re-validate. -->
<!-- Update both the comment and the body when HEAD moves. -->

Snapshot of what exists in `bmssp-js` today, so you know what to build on vs. what's missing.

## 🔄 Session-start validation (this file is DYNAMIC)

This map is only true as of the **bookmark commit** recorded in the HTML comment at the top
of this file (`BOOKMARK-COMMIT`). The repo changes as commits land, so validate at the start
of every session:

```bash
git rev-parse HEAD          # compare to BOOKMARK-COMMIT above
```

- **HEAD == bookmark** → this map is current; nothing to do.
- **HEAD != bookmark** → the repo moved. Re-inspect and reconcile:
  1. `git diff --stat <BOOKMARK-COMMIT> HEAD` to see what changed.
  2. Re-read anything under `src/`, `test/`, `examples/`, `benchmarks/`, `index.mjs`,
     `package.json` that changed (especially: did any of the missing pieces below get built?).
  3. Rewrite the affected sections below (layout, class behavior, "Gaps to fill" table,
     package version).
  4. **Update the `BOOKMARK-COMMIT` comment to the new `HEAD`.**

This same procedure runs in full on the on-demand **`RKB`** (`revitalize_knowledge_base`)
command — see `../CLAUDE.md`. `RKB` always rewrites this file and re-stamps the bookmark,
regardless of whether HEAD moved.

## Layout

```
index.mjs                 # re-exports { BMSSP } and { dijkstra }
src/
  bmssp.mjs               # BMSSP class — scaffolding + #45 adjacency map (no real algorithm yet)
  dijkstra.mjs            # reference Dijkstra (array binary-heap) — DONE, used as oracle
test/
  main.test.mjs           # Jest tests: constructor, nodeIDs, adjacency map, shortestPaths, BMSSP-vs-Dijkstra
  roadNet-CA.txt          # real road-network edge list (SNAP roadNet-CA), weights randomized at load
  README.md
benchmarks/               # NEW (#45 PR): dependency-free benchmark harness, `npm run bench`
  generators.mjs          #   seeded graph builders + SCENARIOS registry (sparse/dense/grid/chain/star)
  bench-util.mjs          #   timing (timeMany) + markdown-table helpers
  adjacency.bench.mjs     #   adjacency map (#45) vs. linear edge scan
  scenarios.bench.mjs     #   construct + Dijkstra timings per graph shape
  run.mjs                 #   runs all benchmarks, prints markdown report
  README.md               #   methodology + "when to use which" guidance
  RESULTS.md              #   captured sample run
examples/
  main.mjs                # tiny usage example (constructs BMSSP, prints .graph)
docs/index.html           # published docs page
```

Tooling: Jest (`npm test`, needs `--experimental-vm-modules`, already in the `test` script),
ESLint + Prettier (`npm run lint` / `npm run format`), Dockerfile, GitHub Actions (dependabot
bumps dominate recent history). `eslint.config.js` now **ignores `.claude/**`** so the agent
knowledge base (markdown with pseudocode fences) isn't linted as shippable code.

## `src/bmssp.mjs` — what the class does now

```js
class BMSSP {
  constructor(inputGraph)          // inputGraph = array of [from, to, weight]
  //   this.graph          : deep-copied edge array
  //   this.nodeIDs        : Set of all node IDs (from both endpoints)
  //   this.shortestPaths  : Map<nodeId, distance>, initialized to Infinity  ← this is d̂[·]
  //   this.adjacency      : Map<nodeId, Array<[to, weight]>>  ← #45, built in constructor
  initializeShortestPaths()        // (re)set every nodeId's distance to Infinity
  buildAdjacency()                 // #45: (re)build adjacency from this.graph; every node gets an entry ([] for sinks)
  getEdges(nodeId)                 // #45: O(1) outgoing-edge lookup; returns [] for unknown nodes
  calculateShortestPaths(startNode)// validates startNode, then DELEGATES TO dijkstra()
}
```

**#45 (DONE, in PR #160):** the constructor now builds `this.adjacency`, a
`Map<nodeId, [to, weight][]>`, so fetching a node's outgoing edges is O(1) instead of an O(m)
scan of the edge array. `buildAdjacency()` gives **every** known node an entry (empty array
for sinks), so callers can rely on `.get(node)` / `getEdges(node)` returning an array. This is
the inner-loop primitive every BMSSP stage (BaseCase #40, FindPivots #44, main recursion #43)
needs to relax edges out of frontier nodes.

**Still a placeholder:** `calculateShortestPaths` currently just calls the reference
`dijkstra()` and copies the result into `shortestPaths`. The real BMSSP algorithm (base case →
FindPivots → block list → main recursion) has **not** been written yet — that's issues
#40–#44. The eventual BMSSP entry point should reproduce Dijkstra's answers via the paper's
method, not by calling Dijkstra.

## `src/dijkstra.mjs` — the oracle (already done)

`dijkstra(graph, nodeIDs, source) → Map<nodeId, distance>`. Standard array binary min-heap
with lazy stale-entry skipping (no `DecreaseKey`). Builds its own adjacency list from the edge
array (independent of the class's `this.adjacency`). This is the **ground truth** the BMSSP
implementation is tested against. Reuse its heap style / adjacency-list building.

## Tests (`test/main.test.mjs`) — the contract

- Constructor stores `graph` verbatim; `nodeIDs` = unique endpoints; `shortestPaths` all ∞.
- **Adjacency map (#45):** edges grouped by source; sinks get `[]`; one entry per unique node;
  total edge count preserved across all lists; `getEdges` returns a node's edges and `[]` for
  unknown nodes.
- `calculateShortestPaths(start)` sets `d̂[start] = 0` and throws on an unknown start node.
- `dijkstra` throws on a source not in `nodeIDs`.
- **Key one:** "BMSSP vs Dijkstra" — for a fixed source, `myBMSSP.shortestPaths` must equal
  `dijkstra(...)` for every node. **Any real BMSSP implementation must keep this passing.**
- Current suite: **12 tests, all passing; 100% coverage on `bmssp.mjs`.**

Graph data: `roadNet-CA.txt` is a large real directed road network; edge weights are assigned
a random integer in `[1, 1e8]` at load time (so weights differ per run, but BMSSP and Dijkstra
see the same array within a run).

## Benchmarks (`benchmarks/`, `npm run bench`) — NEW

Deterministic (seeded) micro-benchmarks. `adjacency.bench.mjs` shows the #45 map is
~thousands× faster per-node than a linear scan (gap scales with `m`). `scenarios.bench.mjs`
times construction + a Dijkstra run across five graph shapes (sparse-random, dense-random,
grid, chain, star) — the harness that will become the BMSSP-vs-Dijkstra head-to-head once #43
lands. `benchmarks/README.md` holds the "when to use which" guidance.

## Gaps to fill (the actual work)

| Missing piece | Lives where (suggested) | Issue | Status |
|---|---|---|---|
| Per-node edge adjacency map | `BMSSP` constructor | #45 | ✅ done (PR #160) |
| Binary min-heap module | `src/heap.mjs` (or inline) | #41 | ⬜ open |
| Base case (bounded Dijkstra) | `src/baseCase.mjs` / method | #40 | ⬜ open |
| Lemma 3.3 block-list `D` | `src/blockList.mjs` | #42 | ⬜ open |
| FindPivots | `src/findPivots.mjs` / method | #44 | ⬜ open |
| Main `BMSSP(l, B, S)` recursion + `k,t` derivation | `src/bmssp.mjs` | #43 | ⬜ open |

See [06-milestones-roadmap.md](06-milestones-roadmap.md) for the recommended order and test strategy.
