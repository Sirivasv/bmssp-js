# 05 — Codebase Map (current state)

<!-- BOOKMARK-COMMIT: 909a606ba7b455e6d20211d02cfbaa4778648333 -->
<!-- PENDING-PR-BRANCH: docs/head-to-head-vs-dijkstra -->
<!-- Last validated: 2026-07-16, reflection session after the 1.0.0 release. This map
     describes the tree of the docs/head-to-head-vs-dijkstra branch (docs-only PR: the
     measured BMSSP-vs-Dijkstra head-to-head in benchmarks/HEAD-TO-HEAD.md + README/KB
     refresh; no code behavior change, no version bump — closes no issue). The branch also
     carries the earlier Phase E bookkeeping commit c54ad76 that branch protection kept
     off origin/main. -->

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
  bmssp.mjs               # BMSSP class — full Algorithm 3 recursion (#43); wires the pieces below
  dijkstra.mjs            # reference Dijkstra (array binary-heap) — DONE, used as oracle
  blockList.mjs           # #42: Lemma 3.3 block-based partial-sort structure D
  heap.mjs                # #41: indexed binary min-heap (MinHeap) for BaseCase (Alg 2)
  baseCase.mjs            # #40: BaseCase(B, S) — Algorithm 2 bounded mini-Dijkstra
  findPivots.mjs          # #44: FindPivots(B, S) — Algorithm 1 frontier shrink
test/
  main.test.mjs           # Jest tests: constructor, nodeIDs, adjacency, shortestPaths, BMSSP-vs-Dijkstra (roadNet-CA)
  bmssp.test.mjs          # NEW (#43): 15 recursion tests — params, hand graphs, ties, Lemma 3.1 contract, seeded stress
  blockList.test.mjs      # #42: 18 BlockList tests incl. a seeded random stress test
  heap.test.mjs           # #41: 16 MinHeap tests incl. a seeded stress test vs. a naive queue
  baseCase.test.mjs       # #40: 13 BaseCase tests incl. seeded oracle-comparison stress
  findPivots.test.mjs     # #44: 12 FindPivots tests incl. two seeded oracle stress tests
  roadNet-CA.txt          # real road-network edge list (SNAP roadNet-CA), weights randomized at load
  README.md
benchmarks/               # dependency-free benchmark harness, `npm run bench`
  generators.mjs          #   seeded graph builders + SCENARIOS registry (sparse/dense/grid/chain/star)
  bench-util.mjs          #   timing (timeMany) + markdown-table helpers
  adjacency.bench.mjs     #   adjacency map (#45) vs. linear edge scan
  scenarios.bench.mjs     #   construct + Dijkstra timings per graph shape
  run.mjs                 #   runs all benchmarks, prints markdown report
  README.md               #   methodology + "when to use which" guidance
  RESULTS.md              #   captured sample run
  HEAD-TO-HEAD.md         #   measured BMSSP-vs-Dijkstra (1.0.0): wall-clock + comparison counts
examples/
  main.mjs                # tiny usage example (constructs BMSSP, prints .graph)
docs/index.html           # published docs page
```

Tooling: Jest (`npm test`, needs `--experimental-vm-modules`, already in the `test` script),
ESLint + Prettier (`npm run lint` / `npm run format`), Dockerfile, GitHub Actions (dependabot
bumps dominate recent history). `eslint.config.js` **ignores `.claude/**`** so the agent
knowledge base (markdown with pseudocode fences) isn't linted as shippable code.
**`main` now has branch-protection rules**: changes land through PRs only, commits must have
verified signatures (squash-merge via the GitHub UI signs for you), and CodeQL must pass —
direct `git push origin main` is rejected, including for docs-only bookkeeping commits.

## `src/bmssp.mjs` — the BMSSP class (Algorithm 3 wired in, #43)

```js
class BMSSP {
  constructor(inputGraph)          // inputGraph = array of [from, to, weight]
  //   this.graph          : deep-copied edge array
  //   this.nodeIDs        : Set of all node IDs (from both endpoints)
  //   this.shortestPaths  : Map<nodeId, distance>, initialized to Infinity  ← this is d̂[·]
  //   this.adjacency      : Map<nodeId, Array<[to, weight]>>  ← #45, built in constructor
  //   this.k, this.t, this.topLevel : paper parameters, derived in the constructor
  initializeShortestPaths()        // (re)set every nodeId's distance to Infinity
  buildAdjacency()                 // #45: (re)build adjacency from this.graph
  getEdges(nodeId)                 // #45: O(1) outgoing-edge lookup; [] for unknown nodes
  deriveParameters()               // #43: k = max(1,⌊(log₂n)^⅓⌋), t = max(1,⌊(log₂n)^⅔⌋),
                                   //      topLevel = max(1,⌈log₂n / t⌉) — from this.nodeIDs.size
  bmssp(l, B, S)                   // #43: Algorithm 3 → { bound, vertices } (the paper's B', U)
  calculateShortestPaths(startNode)// #43: validates, sets d̂[start] = 0, runs
                                   //      bmssp(topLevel, Infinity, {startNode}) — NO Dijkstra
}
```

**`bmssp(l, B, S)` (#43):** level 0 delegates to `baseCase`. At level ≥ 1: `findPivots`
shrinks the frontier; pivots seed a `BlockList(M = 2^((l-1)·t), B)`; the loop pulls
`Bi, Si ← D.pull()`, recurses `bmssp(l-1, Bi, Si)`, relaxes edges out of the returned `Ui`
(band `[Bi, B)` → `D.insert`, band `[Bi', Bi)` → staged `K` → `D.batchPrepend` together with
the uncompleted `Si` members), and stops when `D` empties (success, `bound === B`) or
`|U| ≥ k·2^(l·t)` trips (partial, `bound < B`). Finally folds in the `W` vertices below the
returned bound. Since `k·2^(topLevel·t) ≥ n`, the top call is always a successful execution.

**Degenerate-tie guards (Assumption 2.1 violations — context in #163).** Three deliberate
deviations from the paper's literal text, each needed only when equal path lengths (e.g.
zero-weight edges) occur; all are covered by tests in `test/bmssp.test.mjs`:
1. **Completed-vertex guard:** a vertex already in this call's `U` is never re-queued by an
   equal-sum relaxation (mirrors `baseCase`'s settled guard; prevents ping-pong loops).
2. **Out-of-scope pivot gate:** a pull can return a key tied with its separator, so a pivot
   can arrive with `d̂ ≥ B`; it is skipped when seeding `D` (`BlockList.insert` requires
   `value < B`) — the ancestor whose band covers it is responsible for it.
3. **Stall escape hatch:** if a child returns zero vertices (only possible when everything
   it settled tied exactly at its boundary), the batch would be re-pulled forever; instead
   each batch member is settled with an uncapped `baseCase` run bounded by `Bi` — correct,
   just not sublinear. Boundary-tied `Si` members (`d̂ == Bi < B`) re-enter `D` via a regular
   insert rather than being dropped.

**Performance (measured 2026-07-16, Apple Silicon, node v26.5.0 — full data + methodology
in `benchmarks/HEAD-TO-HEAD.md`):** algorithm-only wall-clock (construction excluded,
Dijkstra fed the same prebuilt adjacency): Dijkstra wins every shape/size; sparse-graph
ratio narrows with n (2.54× at 50k → **1.57× at 2M**), roadNet-CA ≈2.1×. **Comparison
counts (the paper's metric) cross over:** BMSSP does fewer distance comparisons than
Dijkstra past ~n = 1M sparse (0.96× at 1M, **0.91× at 2M**). Two measured pathologies,
tracked in **#182**: star graphs blow up superlinearly (67.8× at n = 500k) and the ratio
cliffs to 5× at n = 4M where `topLevel` steps 3→4. The two roadNet tests in
`main.test.mjs` carry explicit 120 s Jest timeouts (the default 5 s is not enough for a
real BMSSP run under CI).

## `src/blockList.mjs` — Lemma 3.3 structure `D` (#42)

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
- **Tie caveat (seen in #43):** with equal values across a pull boundary, `pull()`'s bound can
  equal a pulled key's value (the paper's `max(S') < x` is strict only under Assumption 2.1).
  Callers must tolerate batch members with `d̂ == Bi` — `bmssp()` does (guards above).

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
the paper's `≤` + `< B` test, with the settled-vertex guard against equal-sum re-insertion.
`bmssp()` calls it at level 0, and also re-uses it (with `k = n`, uncapped) as the
degenerate-tie stall escape hatch.

## `src/findPivots.mjs` — `FindPivots(B, S)`, Algorithm 1 (#44)

```js
findPivots(B, S, dHat, adjacency, k)  // → { pivots, W }
// B         : strict bound gating membership in W (Infinity OK); d̂ updates are NOT gated
// S         : non-empty Set of complete frontier sources (throws if empty / any d̂ not finite)
// dHat      : Map<nodeId, number> — the global d̂[·]; RELAXED IN PLACE
// adjacency : Map<nodeId, [to, weight][]> — the class's this.adjacency
// k         : rounds + tree-size threshold >= 1 (floored); throws otherwise
export { findPivots };   // NOT re-exported from index.mjs — internal to the algorithm
```

`k` rounds of Bellman-Ford relaxation out of `S` (paper's `≤` test; `< B` gates only the
membership in `W`). **Early exit:** as soon as `|W| > k·|S|`, returns `pivots = S` (copy)
with the partial `W`. Otherwise builds the tight-edge forest `F` inside `W` — each vertex
takes **at most one parent** (ties/DAG caveat, see #163) — and returns as pivots the
`S`-roots of trees with `≥ k` vertices. Guarantees `|pivots| ≤ |W|/k`. Note: a source with
`d̂ ≥ B` can be returned as a pivot (early exit copies all of `S`); `bmssp()` filters those
out when seeding `D`.

## `src/dijkstra.mjs` — the oracle (already done)

`dijkstra(graph, nodeIDs, source) → Map<nodeId, distance>`. Standard array binary min-heap
with lazy stale-entry skipping (no `DecreaseKey`). Builds its own adjacency list from the edge
array (independent of the class's `this.adjacency`). This is the **ground truth** the BMSSP
implementation is tested against — and, since #43, no longer part of the BMSSP code path.

## Tests — the contract

- `test/main.test.mjs` (12): constructor/nodeIDs/adjacency/shortestPaths contracts, plus the
  **key one** — "BMSSP vs Dijkstra" on roadNet-CA: for a fixed source, `myBMSSP.shortestPaths`
  must equal `dijkstra(...)` for every node. **Now exercises the real algorithm** (120 s
  timeouts on the two tests that run it on the road network).
- `test/bmssp.test.mjs` (15, NEW in #43): parameter derivation (clamps, paper formulas,
  `k·2^(topLevel·t) ≥ n` guard), end-to-end hand-built graphs (README example, multi-hop vs
  direct, unreachable ⇒ Infinity, self-loop, source switch), degenerate ties (zero-weight
  cycles/clusters, layered equal-length paths, seeded 0–2-weight stress), the Lemma 3.1
  recursion contract (bounded call: complete-below-boundary, exact membership, d̂ never
  underestimates; unbounded call: successful execution returning exactly the reachable set),
  and seeded full-map-vs-oracle stress across sizes (up to n = 2000).
- `test/blockList.test.mjs` (18), `test/heap.test.mjs` (16), `test/baseCase.test.mjs` (13),
  `test/findPivots.test.mjs` (12): per-module contracts incl. seeded stress — see the
  module sections above.
- Current suite: **86 tests, all passing**, 100% statement coverage.

Graph data: `roadNet-CA.txt` is a large real directed road network; edge weights are assigned
a random integer in `[1, 1e8]` at load time (so weights differ per run, but BMSSP and Dijkstra
see the same array within a run).

## Benchmarks (`benchmarks/`, `npm run bench`)

Deterministic (seeded) micro-benchmarks. `adjacency.bench.mjs` shows the #45 map is
~thousands× faster per-node than a linear scan. `scenarios.bench.mjs` times construction +
a Dijkstra run across five graph shapes. **`HEAD-TO-HEAD.md` records the measured
BMSSP-vs-Dijkstra comparison** (2026-07-16): wall-clock tables by shape and size, the
sparse scaling trend, and the comparison-count crossover (~n = 1M). #170 tracks folding
both measurements into the harness itself (algorithm-only `bmssp` column + optional
comparison-count mode); the raw baseline is also on #170 as a comment.

## Gaps to fill (the actual work)

| Missing piece | Lives where | Issue | Status |
|---|---|---|---|
| Per-node edge adjacency map | `BMSSP` constructor | #45 | ✅ done (PR #160) |
| Lemma 3.3 block-list `D` | `src/blockList.mjs` | #42 | ✅ done (PR #175) |
| Binary min-heap module | `src/heap.mjs` | #41 | ✅ done (PR #177) |
| Base case (bounded Dijkstra) | `src/baseCase.mjs` | #40 | ✅ done (PR #178) |
| FindPivots | `src/findPivots.mjs` | #44 | ✅ done (PR #180) |
| Main `BMSSP(l, B, S)` recursion + `k,t` derivation | `src/bmssp.mjs` | #43 | ✅ done (this PR) — **1.0.0 milestone complete** |

**The 1.0.0 milestone is done once this PR merges.** Next work comes from milestone `1.1.0`
(correctness hardening) — see [06-milestones-roadmap.md](06-milestones-roadmap.md).
