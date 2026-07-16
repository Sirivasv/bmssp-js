# 05 — Codebase Map (current state)

<!-- BOOKMARK-COMMIT: 9a753b09d77d8b7b2f72118c17b74dafa5d0df0f -->
<!-- PENDING-PR-BRANCH: chore/agent-process-v2 -->
<!-- Last validated: 2026-07-16, on main. Version 0.18.0 (tagged + released; publish.yml
     fired). #40 (BaseCase) closed via PR #178; remaining 1.0.0 issues: #44 (FindPivots,
     fully specced on GitHub) then #43 (main recursion). No pending release work. -->

Snapshot of what exists in `bmssp-js` today, so you know what to build on vs. what's missing.

## 🔄 Bookmark validation procedure (this file is DYNAMIC)

This map describes the repo **as of the tree identified by the two markers above**:

- `BOOKMARK-COMMIT` — the `main` commit this map was last validated against.
- `PENDING-PR-BRANCH` — set only while a PR is in flight: this map was rewritten **inside
  that PR** (Phase C of `../CLAUDE.md`) and already describes the tree that PR will merge.
  `(none)` otherwise.

**At session start** (Phase A — after `git checkout main && git pull origin main`), run
`git rev-parse HEAD` and follow exactly one branch:

1. **HEAD == `BOOKMARK-COMMIT`** → map is current. Done.
2. **`PENDING-PR-BRANCH` is set** (not `(none)`) → our own PR may have just merged:
   ```bash
   gh pr list --repo Sirivasv/bmssp-js --head <PENDING-PR-BRANCH> --state merged \
     --json number,mergeCommit --jq '.[0]'
   ```
   - If it merged and its `mergeCommit` **== HEAD** → this map already describes HEAD.
     Set `BOOKMARK-COMMIT` to HEAD, set `PENDING-PR-BRANCH` to `(none)`, refresh the
     "Last validated" comment. Done — no re-inspection needed.
   - If it merged but HEAD moved **past** the merge commit → do step 3 using the merge
     commit as the baseline instead of `BOOKMARK-COMMIT`.
   - If it did **not** merge (PR still open/closed unmerged) → the map describes a tree
     that isn't on `main`; rewrite the map from `main`'s actual tree (step 3 with
     `BOOKMARK-COMMIT` as baseline), keep or clear the marker to match PR reality.
3. **Otherwise (repo moved under us)** →
   ```bash
   git diff --stat <baseline> HEAD    # if the baseline commit is unresolvable locally,
                                      # skip the diff and re-inspect everything below
   ```
   Re-read whatever changed under `src/`, `test/`, `benchmarks/`, `examples/`,
   `index.mjs`, `package.json`; rewrite the affected sections (layout, module APIs,
   "Gaps to fill" table); set `BOOKMARK-COMMIT` to HEAD and `PENDING-PR-BRANCH` to
   `(none)`.

**In Phase C (pre-PR, on the feature branch):** rewrite the body of this map to describe
the branch's tree (i.e. post-merge reality), leave `BOOKMARK-COMMIT` at the `main` commit
the branch is based on (`git merge-base main HEAD`), and set `PENDING-PR-BRANCH` to the
feature branch name. Step 2 above then fast-paths the post-merge session start.

## Layout

```
index.mjs                 # re-exports { BMSSP } and { dijkstra }
src/
  bmssp.mjs               # BMSSP class — scaffolding + #45 adjacency map (no real algorithm yet)
  dijkstra.mjs            # reference Dijkstra (array binary-heap) — DONE, used as oracle
  blockList.mjs           # NEW (#42, PR #175): Lemma 3.3 block-based partial-sort structure D
  heap.mjs                # NEW (#41): indexed binary min-heap (MinHeap) for BaseCase (Alg 2)
  baseCase.mjs            # NEW (#40): BaseCase(B, S) — Algorithm 2 bounded mini-Dijkstra
test/
  main.test.mjs           # Jest tests: constructor, nodeIDs, adjacency map, shortestPaths, BMSSP-vs-Dijkstra
  blockList.test.mjs      # NEW (#42): 18 BlockList tests incl. a seeded random stress test
  heap.test.mjs           # NEW (#41): 16 MinHeap tests incl. a seeded stress test vs. a naive queue
  baseCase.test.mjs       # NEW (#40): 13 BaseCase tests incl. seeded oracle-comparison stress
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

## `src/baseCase.mjs` — `BaseCase(B, S)`, Algorithm 2 (#40)

```js
baseCase(B, S, dHat, adjacency, k)  // → { bound, vertices }
// B         : strict distance upper bound (Infinity OK)
// S         : singleton Set holding the complete source x (throws otherwise)
// dHat      : Map<nodeId, number> — the global d̂[·]; RELAXED IN PLACE
// adjacency : Map<nodeId, [to, weight][]> — the class's this.adjacency
// k         : settle cap >= 1 (floored); throws otherwise
export { baseCase };     // NOT re-exported from index.mjs — internal to the algorithm
```

Bounded mini-Dijkstra from `x` on the `MinHeap`, stopping after settling `k+1` vertices.
Full success (heap exhausted at ≤ k settled) → `{ bound: B, vertices: U0 }`; partial (cap
hit) → `bound` = max settled `d̂`, `vertices` = the strictly-closer ones. Relaxation uses
the paper's `≤` + `< B` test, with one guard: a vertex already settled **in this call** is
never re-inserted into the heap (an equal-sum relaxation — e.g. a zero-weight cycle — would
otherwise loop forever; with non-negative weights a settled vertex cannot strictly improve,
so nothing is lost). Callers wire it as `Bi', Ui ← BaseCase(Bi, Si)` at level 0 of #43.

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
  `heap.test.mjs` + 13 in `baseCase.test.mjs`, all passing (59).**
- **BaseCase (#40):** validation (k, singleton S, complete source), full-success vs. finite/
  infinite B, partial k+1-cap boundary reporting (incl. ties excluded by the strict filter),
  zero-weight-cycle termination, and two seeded stress tests checking the Algorithm 2
  contract against the Dijkstra oracle (exact distances, completeness below B', d̂ never
  underestimates).
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
| Binary min-heap module | `src/heap.mjs` | #41 | ✅ done (PR #177) |
| Base case (bounded Dijkstra) | `src/baseCase.mjs` | #40 | ✅ done (PR #178) |
| FindPivots | `src/findPivots.mjs` / method | #44 | ⬜ open |
| Main `BMSSP(l, B, S)` recursion + `k,t` derivation | `src/bmssp.mjs` | #43 | ⬜ open |

See [06-milestones-roadmap.md](06-milestones-roadmap.md) for the recommended order and test strategy.
