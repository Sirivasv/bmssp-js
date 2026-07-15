# 05 — Codebase Map (current state)

<!-- BOOKMARK-COMMIT: 3cca82a35595f97a9c7b2420af55772ae95eed8a -->
<!-- BOOKMARK-BRANCH: main -->
<!-- Last validated after pulling main. PR #175 (feat(#42) Lemma 3.3 BlockList) is MERGED:
     adds src/blockList.mjs + test/blockList.test.mjs and bumps the version to 0.16.0
     (tagged + released; publish.yml fired). #42 is closed — remaining 1.0.0 issues are
     #40, #41, #43, #44.
     Pending: PR for #41 (feat: src/heap.mjs indexed MinHeap + tests, bump to 0.17.0) is
     OPEN — re-stamp the bookmark once merged. -->
<!-- Update both the comment and the body when HEAD moves. -->

Snapshot of what exists in `bmssp-js` today, so you know what to build on vs. what's missing.

## 🔄 Session-start validation (this file is DYNAMIC)

This map is only true as of the **bookmark commit** recorded in the HTML comment at the top
of this file (`BOOKMARK-COMMIT`). The repo changes as commits land, so validate at the start
of every session — **after pulling the latest `main`** (never validate against a stale local
checkout; a branch that looks unmerged locally may already be on `origin/main`):

```bash
git checkout main && git pull origin main
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
  blockList.mjs           # NEW (#42, PR #175): Lemma 3.3 block-based partial-sort structure D
  heap.mjs                # NEW (#41): indexed binary min-heap (MinHeap) for BaseCase (Alg 2)
test/
  main.test.mjs           # Jest tests: constructor, nodeIDs, adjacency map, shortestPaths, BMSSP-vs-Dijkstra
  blockList.test.mjs      # NEW (#42): 18 BlockList tests incl. a seeded random stress test
  heap.test.mjs           # NEW (#41): 16 MinHeap tests incl. a seeded stress test vs. a naive queue
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

## `src/blockList.mjs` — Lemma 3.3 structure `D` (#42, DONE in PR #175)

```js
class BlockList {
  constructor(M, B)        // block/pull size M >= 1 (floored), strict value upper bound B (Infinity OK)
  get size / isEmpty()
  insert(key, value)       // throws if !(value < B); duplicate key keeps the smallest value
  batchPrepend(pairs)      // iterable of [key, value]; caller guarantees "smaller than everything stored"
  pull()                   // → { keys: Set, bound } — the ≤M smallest keys; max(pulled) ≤ bound ≤ min(remaining);
}                          //   bound === B when the pull drains the structure
export { BlockList };      // NOT re-exported from index.mjs — internal to the algorithm
```

Implementation notes (matches §03-B including its documented shortcuts):
- `d1` (insert blocks) + `d0` (prepend blocks); values ordered between blocks, unsorted within.
  Blocks are `{ bound, entries: Map }`; a `locator` Map (key → block) gives O(1) duplicate handling.
- Bound index = plain array + binary search instead of a balanced BST (upgrade tracked as #167).
- Overfull `d1` block splits around the median via sort (O(M log M), not linear-time selection).
- Big `batchPrepend` batches are sorted and chunked into blocks of ≤ ⌈M/2⌉, prepended to `d0`.
- Last `d1` block (bound `B`) is kept even when empty so every `insert` finds a home.
- API surface for Algorithm 3: `Bi, Si ← D.Pull()` maps to `const { keys, bound } = d.pull()`.

## `src/heap.mjs` — indexed binary min-heap (#41)

```js
class MinHeap {
  constructor()            // no parameters
  get size / isEmpty()
  has(key)                 // O(1) membership — Algorithm 2's "if v not in H"
  getValue(key)            // current value or undefined
  peekMin()                // → { key, value } without removing; throws when empty
  insert(key, value)       // throws on duplicate key or non-number value
  decreaseKey(key, value)  // throws on missing key; ignored unless value < current (smallest wins)
  extractMin()             // → { key, value }; throws when empty
}
export { MinHeap };        // NOT re-exported from index.mjs — internal to the algorithm
```

The **true indexed heap** from §03-A (entries array + `position` Map for O(log n)
`decreaseKey`), matching Algorithm 2 literally — deliberately not the lazy duplicate-and-skip
variant `src/dijkstra.mjs` uses internally. An extracted key may be re-inserted later.
16 tests in `test/heap.test.mjs` (contracts, ordering, decreaseKey, the BaseCase
insert-or-decrease relaxation pattern, seeded stress vs. a naive linear-scan queue).

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
- Current suite: **12 tests in `main.test.mjs` + 18 in `blockList.test.mjs` + 16 in
  `heap.test.mjs`, all passing.**
- **BlockList (#42):** init validation, `value < B` enforcement, drain-pull returns bound `B`,
  batch-sorted pulls of the M smallest, separator invariant, smallest-value-wins dedupe
  (insert and batchPrepend, vs. stored and within-batch), split correctness, re-insert after
  pull, chunked large prepends, and a seeded random stress test checking global sorted order.

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
| Lemma 3.3 block-list `D` | `src/blockList.mjs` | #42 | ✅ done (PR #175) |
| Binary min-heap module | `src/heap.mjs` | #41 | 🔶 PR open (this branch) |
| Base case (bounded Dijkstra) | `src/baseCase.mjs` / method | #40 | ⬜ open |
| FindPivots | `src/findPivots.mjs` / method | #44 | ⬜ open |
| Main `BMSSP(l, B, S)` recursion + `k,t` derivation | `src/bmssp.mjs` | #43 | ⬜ open |

See [06-milestones-roadmap.md](06-milestones-roadmap.md) for the recommended order and test strategy.
