# 05 — Codebase Map (current state)

<!-- BOOKMARK-COMMIT: 47fae54 -->
<!-- PENDING-PR-BRANCH: feat/212-direct-csr-construction -->
<!-- Last validated: 2026-07-22 (Phase C of the #212 PR, branch feat/212-direct-csr-construction,
     based on main 47fae54). This PR is the milestone-closing 3.0.0 work: DIRECT-CSR
     CONSTRUCTION — the constructor builds the dense index + CSR + typed labels straight from
     the validated input edges, removing the intermediate this.graph deep-copy and the
     this.adjacency Map (and buildAdjacency). Purely construction-side + label-preserving (CSR
     byte-identical), so every oracle/determinism assertion is unchanged; roughly HALVES
     construction time (n=500k/m=1.5M: ~510 → ~240 ms median, clean A/B vs main 2.0.0).
     BREAKING: the public this.graph / this.adjacency fields are gone → getEdges materializes
     the edge view from CSR on demand. User-confirmed decision (2026-07-22): remove the fields
     (not lazy getters). Test/bench migration: new test/helpers.mjs edgesOf() + bench-util
     adjacencyOf() rebuild oracle inputs from getEdges; publicApi.test pins the fields as GONE.
     **major → 3.0.0** (npm version major applied). Body describes post-merge reality; markers
     fast-path on the next session's Phase A. Also carries the #173-PR Phase-E 06 reconciliation
     that branch protection had stranded as a local bookkeeping edit. -->


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
index.mjs                 # re-exports { BMSSP }, { dijkstra }, { constantDegreeTransform }
                          # and { Graph } (#172), each with public-API JSDoc (#166);
                          # algorithm internals stay unexported
src/
  bmssp.mjs               # BMSSP class — full Algorithm 3 recursion (#43); wires the pieces below.
                          #      Constructor accepts flexible inputs via normalizeGraphInput (#172)
                          #      and builds the index/CSR DIRECTLY from them (#212) — no this.graph
                          #      deep-copy, no this.adjacency Map; getEdges reads the CSR on demand
  graph.mjs               # #172: public `Graph` input builder (addVertex/addEdge, chainable) +
                          #      normalizeGraphInput — edge array | adjacency Map/object | Graph →
                          #      canonical { edges, vertices }; `vertices` = explicit vertex universe
  dijkstra.mjs            # reference Dijkstra (array binary-heap) — DONE, used as oracle
  constantDegree.mjs      # #164: opt-in constant-degree transform (in/out-degree ≤ 2); public, re-exported
  tieBreak.mjs            # #163: composite [length, hops, index] keys — Assumption 2.1 realized; since #205
                          #      also the engine label state: makeLabels (typed d̂/hops/preds), labelKey, relaxEdge
  blockList.mjs           # #42: Lemma 3.3 block-based partial-sort structure D (comparator-aware since #163;
                          #      exact Lemma 3.3 asymptotics since #167 via boundIndex + select)
  boundIndex.mjs          # #167: AVL ordered block sequence — the paper's balanced-BST bound index (BoundIndex)
  select.mjs              # #167: deterministic worst-case-linear selection (partitionByRank, median of medians)
  heap.mjs                # #41: indexed binary min-heap (MinHeap) for BaseCase (comparator-aware since #163)
  baseCase.mjs            # #40: BaseCase(B, S) — Algorithm 2 bounded mini-Dijkstra; on the CSR + typed labels (#205)
  findPivots.mjs          # #44: FindPivots(B, S) — Algorithm 1 frontier shrink, canonical-pred forest (dense indices, #205)
test/
  main.test.mjs           # Jest tests: constructor validation, nodeIDs, adjacency, shortestPaths, BMSSP-vs-Dijkstra (seeded 10k sparse)
  bmssp.test.mjs          # #43: 15 recursion tests — params, hand graphs, ties, Lemma 3.1 contract, seeded stress
  fuzz.test.mjs           # #161: 18 high-volume fuzz tests — shapes × weight regimes × multi-source × seeded scale; FUZZ_ROUNDS / FUZZ_XL env vars
  edgeCases.test.mjs      # #162: 9 deterministic disconnection fixtures — isolated/sink sources, many components, source switching
  tieBreak.test.mjs       # #163: 16 tests — key order, canonical relaxEdge, edge-order determinism, strict Lemma 3.1, lex-oracle hops/preds
  constantDegree.test.mjs # #164: 11 tests — degree ≤ 2 on hand + seeded shapes (incl. star hub), distance preservation via oracle, BMSSP-on-transform, determinism, empty/validation
  graph.test.mjs          # #172: 18 tests — Graph builder (chain/idempotent/copies/eager validation), adjacency Map/object inputs, object-key coercion, isolated vertices (empty & null neighbor lists, declared, as source), cross-shape oracle equivalence (seeded 2k), unrecognized-input + malformed-adjacency throws
  pathReconstruction.test.mjs # #169: 3 public-API tests — Dijkstra path oracle, unreachable/pre-run/source switching, target validation
  multiSource.test.mjs     # #171: 19 tests — calculateShortestPathsFrom: single-source equivalence, nearest-of-many + custom-d0 multi-source oracle, bounded pruning, all input shapes, reconstructPath/state-reset integration, validation
  publicApi.test.mjs       # #173: CONTRACT tests — pins the 4 exports + BMSSP/Graph supported members + constantDegreeTransform/dijkstra shapes; export/rename drift fails CI. #212: +1 test pinning graph/adjacency as REMOVED (10 total)
  helpers.mjs              # #212: shared test helper edgesOf(instance) — rebuilds a [from,to,weight][] edge array from the public getEdges() view (the removed this.graph), to feed the dijkstra oracle
  blockList.test.mjs      # #42: 25 BlockList tests incl. seeded random stress, #182 many-chunk/M=1 regression tests + #167 machinery tests
  boundIndex.test.mjs     # #167: 8 BoundIndex tests — sequence ops, monotone findFirst, AVL invariants under seeded churn
  select.test.mjs         # #167: 9 partitionByRank tests — every-rank contract, worst-case orderings, duplicates, determinism
  heap.test.mjs           # #41: 16 MinHeap tests incl. a seeded stress test vs. a naive queue
  baseCase.test.mjs       # #40: 13 BaseCase tests incl. seeded oracle-comparison stress
  findPivots.test.mjs     # #44: 12 FindPivots tests incl. two seeded oracle stress tests
  benchmarks.test.mjs     # #170: 9 harness tests — dijkstra-adj vs shipped oracle, counters, countMismatches both branches, tiny-scenario report shape + zero mismatches
  README.md               # test-suite principles (everything seeded, no data files) + file map
benchmarks/               # dependency-free benchmark harness, `npm run bench` / `npm run bench:counts`
  generators.mjs          #   seeded graph builders + SCENARIOS registry (sparse/dense/grid/chain/star/sparse-l4)
  bench-util.mjs          #   timing (timeMany), markdown-table + countMismatches helpers;
                          #     #212 adjacencyOf(instance) — Map view rebuilt from getEdges for the fair Dijkstra baseline (built once, outside timing)
  adjacency.bench.mjs     #   adjacency map (#45) vs. linear edge scan
  scenarios.bench.mjs     #   #170: head-to-head per shape — construct + dijkstra + bmssp timings, verified outputs
  dijkstra-adj.mjs        #   #170: algorithm-only Dijkstra over prebuilt adjacency + comparison counter (fair baseline)
  compare-counts.bench.mjs#   #170: comparison-count mode (COUNT_CASES: sparse 50k/200k/1M + grid 700)
  run.mjs                 #   runs all benchmarks, prints markdown report; --counts adds count tables
  README.md               #   methodology + "when to use which" guidance
  RESULTS.md              #   captured `npm run bench:counts` report (2026-07-21)
  HEAD-TO-HEAD.md         #   frozen 1.0.0 measurement record (up to n = 4M): wall-clock + comparison counts
examples/                 # standalone, copy-pasteable gallery — each file imports from the
                          # PUBLISHED `bmssp` package (not relative src), so users run them
                          # after `npm install bmssp`; also bundled into the Docker image
  01-basic.mjs            #   calculateShortestPaths() + reconstructPath() on a tiny digraph
  02-dijkstra-oracle.mjs  #   validate BMSSP against the exported `dijkstra` oracle (per-node table)
  03-constant-degree.mjs  #   the opt-in constantDegreeTransform (sourceCopy/collapse)
  04-larger-graph.mjs     #   a generated 40×40 grid — timing + oracle spot-check
  05-flexible-inputs.mjs  #   #172 surface: edge array / adjacency Map / object / Graph all equal + isolated vertex
  06-multi-source.mjs     #   #171 surface: calculateShortestPathsFrom — nearest-of-many, custom d0, bounded pruning
  run-all.mjs             #   runs all six in order (the Docker image's default CMD)
  README.md               #   gallery index + Docker run/override/mount recipes
docs/index.html           # public-API reference (GitHub Pages via static.yml); since #173
                          # documents all FOUR exports (BMSSP, Graph, dijkstra,
                          # constantDegreeTransform) + calculateShortestPathsFrom + advanced bmssp
MIGRATION.md              # #173: 1.0 → 2.0 migration note (no breaking changes; the locked
                          # public surface + what's now explicitly @internal), linked from README
```

Tooling: Jest (`npm test`, needs `--experimental-vm-modules`, already in the `test` script),
ESLint + Prettier (`npm run lint` / `npm run format`), Dockerfile, GitHub Actions (dependabot
bumps dominate recent history). `eslint.config.js` **ignores `.claude/**`** so the agent
knowledge base (markdown with pseudocode fences) isn't linted as shippable code.
**`main` now has branch-protection rules**: changes land through PRs only, commits must have
verified signatures (squash-merge via the GitHub UI signs for you), and CodeQL must pass —
direct `git push origin main` is rejected, including for docs-only bookkeeping commits.

## `src/bmssp.mjs` — the BMSSP class (Algorithm 3 wired in, #43; dense-index engine, #205)

```js
class BMSSP {
  constructor(inputGraph)          // #172: normalizeGraphInput accepts an edge array,
                                   // an adjacency Map/object, or a Graph builder → { edges,
                                   // vertices }; validates edges (finite numeric node IDs,
                                   // finite non-negative weights) + folds in declared
                                   // vertices (isolated OK); [] / {} / empty Graph remain valid
  //   this.nodeIDs        : Set of all node IDs (from both endpoints)
  //   this.shortestPaths  : Map<nodeId, distance>, initialized to Infinity  ← public d̂[·]
  //   (#212 REMOVED this.graph + this.adjacency — CSR is the single source of truth;
  //    getEdges() materializes a node's [to,weight] edges from the CSR on demand)
  //   this.hops, this.preds : Map — #163 canonical labels, public mirror refreshed after a run
  //   this.ties           : { hops, preds } bundle (public boundary compatibility)
  //   --- #205 dense engine (indices assigned in ascending-id order) ---
  //   this.ids            : Float64Array index → original node id
  //   this.indexOf        : Map<nodeId, index>  (inverse of ids)
  //   this.csr            : { offsets:Uint32Array, targets:Uint32Array, weights:Float64Array }
  //   this.labels         : { dist:Float64Array, hops:Uint32Array, preds:Int32Array } ← engine d̂
  //   this.k, this.t, this.topLevel : paper parameters, derived in the constructor
  initializeShortestPaths()        // reset public Maps AND engine label arrays to ∞ / 0 / NO_PRED
  buildIndex(edges)                // #205/#212: sorted-id index + CSR + typed labels built
                                   //      DIRECTLY from the validated input edges (called in ctor)
  getEdges(nodeId)                 // #45/#212: node's [to,weight] edges materialized from the
                                   //      CSR (input edge order); [] for unknown nodes
  deriveParameters()               // #43: k = max(1,⌊(log₂n)^⅓⌋), t = max(1,⌊(log₂n)^⅔⌋),
                                   //      topLevel = max(1,⌈log₂n / t⌉) — from this.nodeIDs.size
  syncLabelsIn() / syncLabelsOut() // #205: snapshot public shortestPaths → engine arrays before a
                                   //      public bmssp() call, mirror arrays → public Maps after
  boundToEngine(B) / keyToPublic(k)// #205: id↔index translation for a bound / a returned key
  bmssp(l, B, S)                   // #205 PUBLIC wrapper (id space): sync in, translate, run
                                   //      bmsspIndex, translate out → { bound, boundKey, vertices }
  bmsspIndex(l, boundKey, S)       // #43 + #205: Algorithm 3 recursion, entirely in dense-index
                                   //      space (S/U = indices, keys = [len,hops,index], CSR + labels)
  calculateShortestPaths(startNode)// #43: validates, sets labels.dist[startIdx] = 0, runs
                                   //      bmsspIndex(topLevel, ∞, {startIdx}), then syncLabelsOut
  normalizeSources(sources)        // #171: flexible sources → Map<id, initialDistance>
                                   //      (Map | {id:dist} | [id,dist][] | id[]; validated)
  calculateShortestPathsFrom(sources, { bound }) // #171 PUBLIC multi-source/bounded entry:
                                   //      seed shortestPaths, run bmssp(topLevel, bound, S),
                                   //      prune the mirror to U under a finite bound
  reconstructPath(target)          // #169: source→target path from the public preds mirror
}
```

**Constructor input validation (#165, generalized by #172).** The constructor first calls
`normalizeGraphInput` (`src/graph.mjs`) to reduce the input to `{ edges, vertices }`, then
validates the edges: every entry must be an exact three-element `[from, to, weight]` array,
node IDs and weights must be finite numbers, and weights non-negative — failures identify the
offending edge index (unchanged messages). Declared `vertices` (the explicit universe from a
`Graph`/adjacency form) must be finite numbers too. An empty graph in any form
(`[]` / `{}` / `new Map()` / `new Graph()`) remains valid and preserves the #162 contract:
construction succeeds, then `calculateShortestPaths()` rejects any start node because the
graph has no nodes.

**Direct-CSR construction (#212, milestone-closing → 3.0.0).** The constructor builds the
dense index + CSR + typed labels **directly** from the validated input edges — there is no
longer an intermediate `this.graph` deep-copy or an eager `this.adjacency` Map (`buildAdjacency`
is gone). `buildIndex(edges)` takes the normalized edge array as a parameter: it validates
node membership, counts per-node out-degrees, prefix-sums the `offsets`, and fills
`targets`/`weights` straight from `edges`. **BREAKING:** the public `this.graph` and
`this.adjacency` fields are removed (user-confirmed 2026-07-22 — remove, not lazy getters), so
`getEdges(nodeId)` now materializes a node's `[to,weight]` edges from the CSR on demand
(`[]` for unknown / isolated nodes). Because the CSR is built from the same edges in the same
order, it is **byte-identical** to the pre-#212 round-trip, so every canonical label / oracle /
determinism assertion is unchanged — this is a construction-side change, not an engine change.
Measured payoff: construction time **roughly halved** (n=500k / m=1.5M: ~510 → ~240 ms median,
clean A/B vs `main` 2.0.0). Test/bench code that fed the removed fields to the Dijkstra oracles
rebuilds them from `getEdges` via `edgesOf` (`test/helpers.mjs`) / `adjacencyOf`
(`benchmarks/bench-util.mjs`); `test/publicApi.test.mjs` pins the two fields as **removed**.

**Flexible inputs (#172, `src/graph.mjs`).** `normalizeGraphInput(input)` recognizes four
shapes and always yields `{ edges: [[from,to,weight]…], vertices: [id…] }`:
- a **`Graph`** builder instance → `input.toNormalized()`;
- an **edge array** → `{ edges: input, vertices: [] }` (nodes inferred from edges — exact
  pre-#172 behavior);
- an **adjacency `Map`** `Map<from, Iterable<[to,weight]>>` → keys declare the vertex
  universe (a key with an empty/`null` list is an isolated vertex);
- a **plain object** `{ from: [[to,weight]…] }` → same as Map, but string keys are coerced to
  numbers (`Number(key)`; non-numeric keys fail the constructor's finite-vertex check).
Only structural checks live in the normalizer; per-edge value validation stays in the
constructor so the "Edge at index N" messages remain the single source of truth. Node-ID
semantics are unchanged (finite numbers, indices assigned in ascending-id order), so the
canonical `[length, hops, id]` tie-break and every oracle/determinism assertion are
untouched — this is a **surface generalization, not an engine change**.

**Dense-index engine (#205).** The algorithm no longer touches Maps in its hot path. The
constructor assigns every node id a dense index **in ascending numeric id order**
(`buildIndex`), lays the graph out in **CSR** arrays (`offsets`/`targets`/`weights`), and
allocates the labels as **typed arrays** (`dist:Float64Array`, `hops:Uint32Array`,
`preds:Int32Array`; `makeLabels` in `tieBreak`). `baseCase`/`findPivots`/`bmsspIndex` all
run purely on indices — `relaxEdge` reads/writes the typed arrays, edge loops walk CSR
ranges. Because index order equals id order, the composite-key id tie-break picks the same
canonical labels the pre-#205 id-keyed engine did, so **distances/hops/preds are unchanged
and still edge-order-invariant** (the determinism fuzz + oracle suites pass untouched).
`NO_PRED` is now `-1` (a valid `Int32Array` sentinel below every real index; was `-Infinity`).

**Public boundary stays backward-compatible.** `this.shortestPaths` / `this.hops` /
`this.preds` remain the documented public Maps (keyed by original id). The public
`bmssp(l, B, S)` is a thin wrapper: `syncLabelsIn` snapshots seeded distances from
`shortestPaths` into the engine arrays, the id-based `S`/bound are translated to index space
(`boundToEngine`), `bmsspIndex` runs, then `syncLabelsOut` mirrors the arrays back and the
result's indices/key are translated to id space (`keyToPublic`). `calculateShortestPaths`
skips the wrapper (runs `bmsspIndex` directly, then one `syncLabelsOut`). `reconstructPath`
reads the public `preds` mirror as before. This is why #205 is **API-non-breaking** despite
being in the 2.0.0 milestone: it re-engineers the interior, not the surface.

**Public multi-source / bounded entrypoint (#171).**
`calculateShortestPathsFrom(sources, { bound } = {})` exposes the paper's `BMSSP(l, B, S)`
generalization (§04) as ergonomic public API — an additive surface over the existing
`bmssp(topLevel, B, S)` wrapper, hiding both the recursion level and the "seed
`this.shortestPaths` first" ritual the fuzz suite uses directly. `normalizeSources` reduces
the flexible `sources` argument (`Map<id,dist>` | object `{id:dist}` (numeric-string keys
coerced) | array of `[id,dist]` pairs | bare id array → distance 0) to a validated
`Map<id, initialDistance>` (each id a known node, each distance finite ≥ 0; a repeated source
keeps its smallest distance). The method seeds those distances into `this.shortestPaths`, runs
`this.bmssp(this.topLevel, bound, new Set(ids))`, and — like `calculateShortestPaths` — writes
results into the public Maps and returns nothing. **Bounded-run cleanup:** BMSSP relaxes some
vertices at/above `B` without completing them, leaving over-estimates in the mirror, so under
a **finite** bound the method prunes `shortestPaths`/`hops`/`preds` to the returned completed
set `U` (exactly the vertices with `d(v) < B`); an unbounded run's `U` already equals the
reachable set, so no pruning is needed. Single-source SSSP is the special case
`calculateShortestPathsFrom([start])`. `bound` accepts a non-negative number or `Infinity`
(default). The multi-source ground truth is `trueDist(v) = min_s(d0[s] + dist_s(v))`; initial
distances are treated as the sources' true (complete) distances (the paper's precondition,
trivially met by the common all-zero seeding). **Additive only** — `calculateShortestPaths`,
`bmssp`, and `reconstructPath` are untouched, and node-ID / `[length, hops, id]` tie-break
semantics are unchanged.

**Public-API stabilization (#173, milestone-closing → 2.0.0).** A **documentation + contract
lockdown**, no behavior change (user-confirmed: document-only boundary, no `#`-privatization).
The class carries a class-level JSDoc enumerating the **supported public surface** — the
constructor, `calculateShortestPaths`, `calculateShortestPathsFrom`, `bmssp(l,B,S)` (advanced
primitive), `reconstructPath`, `getEdges`, and the public fields `shortestPaths` / `nodeIDs`
/ `hops` / `preds` (in 2.0.0 also `adjacency` / `graph`, **removed by #212**) — with
`@public`/`@internal` tags on the method
JSDoc. Everything else (the dense-index engine: `csr`, `labels`, `ids`, `indexOf`,
`bmsspIndex`, `syncLabelsIn/Out`, `boundToEngine`/`keyToPublic`, `normalizeSources`,
`buildIndex`, `deriveParameters`, `k`/`t`/`topLevel`/`ties`) is `@internal` — may change in a
minor. `index.mjs` exports exactly four names (`BMSSP`, `Graph`, `dijkstra`,
`constantDegreeTransform`); the algorithm-internal modules stay unexported. `MIGRATION.md`
records the 1.0→2.0 story (**no breaking changes** — #205/#172/#171 all landed additively, so
2.0.0 is a stability commitment + feature consolidation), and `test/publicApi.test.mjs` pins
the surface so export/rename drift fails CI. In 2.0.0 the raw `bmssp(l,B,S)` wrapper stayed a
documented advanced entrypoint and `this.graph` / `this.adjacency` stayed public (the #172/#206
direct-CSR construction perf lever deferred to #212). **#212 (3.0.0) then removed those two
fields** and did the direct-CSR construction — see the "Direct-CSR construction (#212)"
paragraph above; the contract test now pins them as gone.

**`bmsspIndex(l, boundKey, S)` (#43):** level 0 delegates to `baseCase`. At level ≥ 1:
`findPivots` shrinks the frontier; pivots seed a `BlockList(M = 2^((l-1)·t), boundKey,
compareKeys)`; the loop pulls `Bi, Si ← D.pull()`, recurses `bmsspIndex(l-1, Bi, Si)`,
relaxes edges out of the returned `Ui` (band `[Bi, B)` → `D.insert`, band `[Bi', Bi)` →
staged `K` → `D.batchPrepend` together with the uncompleted `Si` members), and stops when
`D` empties (success, `boundKey` = B's key) or `|U| ≥ k·2^(l·t)` trips (partial). Finally
folds in the `W` vertices below the returned bound. Since `k·2^(topLevel·t) ≥ n`, the top
call is always a successful execution.

**Deterministic tie-breaking (#163, `src/tieBreak.mjs`).** All internal ordering uses
composite `[length, hops, id]` keys (lexicographic), realizing the paper's Assumption 2.1
(distinct path lengths): a zero-weight edge strictly increases `hops`, distinct vertex ids
make every frontier comparison strict. Consequences, replacing the pre-#163 guards:
1. **Canonical relaxation** (`relaxEdge`): d̂/hops/preds update together iff the candidate
   path key `[d̂[u]+w, hops[u]+1, u]` beats the stored one — the chosen predecessor is the
   smallest among `(length, hops)`-optimal parents, independent of edge/iteration order.
2. **Exact-equality re-enqueue** (the paper's `≤` made canonical): when a completed `u`
   re-derives `v`'s label exactly, `v` is re-enqueued at the current level (it was labeled
   by a deeper call without being completed) — only the recorded label-setter triggers
   this; the `U.has(v)` / `settled.has(v)` filters keep it finite. This is the lazy repair
   chain that lets labels set by excluded boundary vertices get completed later.
3. **Strict Lemma 3.1:** pull separators are strict, pivots never arrive tied with `B`
   (the seeding filter now only scopes direct multi-source callers' sources), boundary-tied
   batch members are impossible, a child's `U` is never empty — the old stall escape hatch
   is gone. `boundKey` is strict: every returned vertex's key < `boundKey`; in the scalar
   projection a returned vertex may still tie `bound`'s length (`d(v) ≤ bound`), never
   exceed it.
4. **Full determinism:** distances, hops, preds, and even partial-call `U`/`boundKey` are
   invariant under edge-list permutation (`test/tieBreak.test.mjs` asserts this).

**Performance (measured 2026-07-16, addenda through 2026-07-21; Apple Silicon, node
v26.5.0 — full data + methodology in `benchmarks/HEAD-TO-HEAD.md`, latest capture in
`benchmarks/RESULTS.md`):** algorithm-only wall-clock (construction excluded, Dijkstra fed
the same prebuilt adjacency): Dijkstra still wins every shape, but **#205's dense-index
engine roughly halved BMSSP's time and brought sparse graphs to near-parity** — the
2026-07-21 post-#205 capture reads **sparse-random 1.38×** (was ~2.5–2.8× at 1.2.0),
**sparse-random-l4 1.07×**, **dense 1.16×**, grid 2.27×, chain 3.10×, star 2.48×. Clean
A/B vs 1.2.0: sparse 50k ~104 → ~53 ms, star ~145 → ~100 ms, sparse-l4 300k ~982 →
~424 ms. **Comparison counts are unchanged by #205** (identical algorithm, just typed
storage): they crossed over at ~n = 1M sparse in the 1.0.0/1.1.1 records and, since #167's
selection-based BlockList, cross before n = 50k — **0.95× at 50k, 0.76× at 200k, 0.65× at
1M** (grid 700×700 1.10×). Earlier deltas for context: #168 (1.2.0) cut wall-clock −13–23%
over #167 via allocation-free `relaxEdge` + unpacked band routing (`compareKeyParts`) +
indexed edge loops; #205 then removed the label-Map traffic those profiles flagged (~38%
self-time) by moving d̂/hops/preds into typed arrays over dense indices and the graph into
CSR. **Heap strategy (#168, measured):** the lazy duplicate-and-skip variant wins an
isolated BaseCase micro-benchmark (~29–33 ms vs ~37–52 ms per 10k bounded runs at
n = 100k) but BaseCase's heaps are capped at k+1 ≈ 4 entries and never register in
end-to-end profiles — the paper-literal indexed `MinHeap` is kept. The two #182
pathologies were profiled 2026-07-21 (HEAD-TO-HEAD addendum): the **star blowup was
quadratic `batchPrepend` bookkeeping — fixed in 1.1.1** (500k: 61 s → ~3.1 s); the
**`topLevel` 3→4 step is an inherent ~+24%** (one extra full relax pass per level,
measured at the exact n = 2^18 straddle; that pass is the paper's `≤`-reuse mechanism
for surfacing ≥-Bi neighbors — not removable as a micro-optimization) — the recorded 5×
at 4M is that step plus GC/memory amplification at 12M edges. Note `topLevel` is **3
from n = 10k to 2M** (4 only in n ∈ (2^18, ~376k]) — scale tests buy volume/memory
pressure, not recursion depth. The default suite runs in ~7.5 s; the opt-in `FUZZ_XL=1`
2M-node round takes ~33 s.

## `src/blockList.mjs` — Lemma 3.3 structure `D` (#42)

```js
class BlockList {
  constructor(M, B, compare?) // block/pull size M >= 1 (floored), strict value upper bound B
                              // (Infinity OK); optional value comparator (default numeric) —
                              // #163 passes compareKeys with composite-key values and bounds
  get size / isEmpty()
  insert(key, value)       // throws if !(value < B); duplicate key keeps the smallest value
  batchPrepend(pairs)      // iterable of [key, value]; caller guarantees "smaller than everything stored"
  pull()                   // → { keys: Set, bound } — the ≤M smallest keys; bound = min(remaining)
}                          //   exactly (strict under a total order); bound === B when drained
export { BlockList };      // NOT re-exported from index.mjs — internal to the algorithm
```

Implementation notes (matches §03-B; since #167 both of its documented shortcuts are gone
and the structure meets Lemma 3.3's exact per-operation bounds):
- `d1` (insert blocks) + `d0` (prepend blocks); values ordered between blocks, unsorted within.
  Blocks are `{ bound, entries: Map, node, prev, next }`; a `locator` Map (key → block) gives
  O(1) duplicate handling.
- **Bound index = `BoundIndex` AVL sequence tree (#167)**, replacing the plain sorted array:
  `insert` finds its block via a monotone-predicate descent (`findFirst`, O(log #blocks)),
  splits insert the lower half via `insertBefore`, emptied blocks leave via `remove` — no
  O(#blocks) `splice`/`indexOf` anywhere. Each `d1` block keeps its tree-node handle in
  `block.node` (`null` marks a `d0` block; `d0` is a doubly-linked list via `prev`/`next`
  with O(1) unlink).
- **Splits, chunking and pulls use `partitionByRank` (#167)** — deterministic worst-case-
  linear selection — instead of an O(M log M) sort: an overfull `d1` block partitions around
  its median rank; `pull` selects the exact M smallest candidates in O(M).
- Big `batchPrepend` batches become value-ordered chunks of ≤ ⌈M/2⌉ prepended to `d0` in one
  linked-list splice (#182 fix preserved). Chunking is a two-branch hybrid, both inside the
  Lemma bound O(|L|·max{1, log(|L|/M)}): with many chunks (|L| ≥ ⌈M/2⌉², e.g. the M = 1 star
  regime) one sort is within 2× of the target and far faster than log(|L|/M) median rounds;
  with few chunks (|L| < ⌈M/2⌉²) recursive median splitting (≤ log₂⌈M/2⌉ levels) avoids the
  sort's O(|L| log |L|) overshoot.
- The shared `compareBySecond` pair comparator is hoisted onto the instance so hot paths
  don't allocate a closure per call.
- Last `d1` block (bound `B`, `this.lastD1Block`) is kept even when empty so every `insert`
  finds a home.
- The pulled set is always the exact M smallest values regardless of block layout, so pulls
  are insertion-order independent. Under #163's composite keys (all values distinct) the
  separator is strictly above every pulled value — the pre-#163 tie caveat (bound tying a
  pulled key, `d̂ == Bi` batch members) is gone.

## `src/boundIndex.mjs` — AVL ordered block sequence (#167)

```js
class BoundIndex {
  constructor()            // empty sequence
  get size
  clear()
  first() / last()         // sequence ends (node handles), null when empty
  next(node)               // in-order successor, null at the end
  findFirst(predicate)     // leftmost node whose ITEM satisfies predicate — predicate must
                           // be monotone along the sequence (false…false, true…true);
                           // O(log size). BlockList passes bound >= value.
  append(item)             // → node handle; insert at the end
  insertBefore(node, item) // → node handle; insert immediately before an existing node
  remove(node)             // remove by handle
}
export { BoundIndex };     // NOT re-exported from index.mjs — internal to the algorithm
```

The paper's "balanced BST over block upper bounds", realized as a POSITIONAL AVL tree: the
tree never compares items — a node's in-order position is its sequence position, and because
`d1` bounds are monotone along the sequence, `findFirst` with a monotone predicate is a
binary search. Nodes are plain `{ item, parent, left, right, height }` objects handed back
as handles (blocks store theirs in `block.node`). Insert/remove rebalance with standard AVL
rotations walking to the root.

## `src/select.mjs` — deterministic linear-time selection (#167)

```js
partitionByRank(items, rank, compare?, cheapBudget?)  // → items[rank]
// Reorders items IN PLACE: items[0..rank] become the rank+1 smallest and
// items[rank] the rank-th smallest (their max); order within the sides is
// unspecified. compare defaults to numeric. cheapBudget (default 6·|items|)
// is the introselect knob: elements the median-of-3 phase may visit before
// pivots switch to median-of-medians; 0 forces the fallback (tests).
export { partitionByRank };   // NOT re-exported from index.mjs — internal to the algorithm
```

Introselect: deterministic median-of-3 quickselect (three-way partition, ~2–3n comparisons
on typical inputs — below a sort's n log n, which keeps the #170 comparison counts honest)
with a work budget; exhausting it switches pivots to median-of-medians (groups of 5), whose
guaranteed middle-40% split makes the remainder — and thus the worst case — linear. Pure
median-of-medians was measured at ~10–20n comparisons, worse than sorting at practical
sizes; the budgeted hybrid keeps both the bound and the constant. No randomness: fully
reproducible.

## `src/heap.mjs` — indexed binary min-heap (#41)

```js
class MinHeap {
  constructor(compare?)    // optional value comparator (default numeric; non-number values
                           // then throw) — #163's baseCase passes compareKeys
  get size / isEmpty()
  has(key)                 // O(1) membership — Algorithm 2's "if v not in H"
  getValue(key)            // current value or undefined
  peekMin()                // → { key, value } without removing; throws when empty
  insert(key, value)       // throws on duplicate key (and non-number value in numeric mode)
  decreaseKey(key, value)  // throws on missing key; ignored unless value < current (smallest wins)
  extractMin()             // → { key, value }; throws when empty
}
export { MinHeap };        // NOT re-exported from index.mjs — internal to the algorithm
```

The **true indexed heap** from §03-A (entries array + `position` Map for O(log n)
`decreaseKey`), matching Algorithm 2 literally — deliberately not the lazy duplicate-and-skip
variant `src/dijkstra.mjs` uses internally. An extracted key may be re-inserted later.

## `src/baseCase.mjs` — `BaseCase(B, S)`, Algorithm 2 (#40; dense engine #205)

```js
baseCase(B, S, labels, csr, k)  // → { bound, boundKey, vertices }
// B      : strict upper bound — scalar (Infinity OK) or composite key; scalar in,
//          scalar bound out (boundKey always the composite boundary)
// S      : singleton Set holding the complete source INDEX x (throws otherwise)
// labels : { dist, hops, preds } typed-array engine labels (#205); RELAXED IN PLACE
// csr    : { offsets, targets, weights } — the class's CSR graph (#205)
// k      : settle cap >= 1 (floored); throws otherwise
export { baseCase };     // NOT re-exported from index.mjs — internal to the algorithm
```

Bounded mini-Dijkstra from `x` on a `MinHeap(compareKeys)` ordered by composite keys (now
`[len, hops, index]`), stopping after settling `k+1` vertices. Full success (heap exhausted
at ≤ k settled) → `{ bound: B, vertices: U0 }`; partial (cap hit) → `boundKey` = max settled
key, `vertices` = exactly the k strictly-closer indices (composite-strict: a returned vertex
may tie the boundary's scalar length). Relaxation is canonical `relaxEdge` gated by `< B`;
the settled filter only skips exact-equality re-enqueue signals, keeping zero-weight plateaus
quiescent. `bmsspIndex()` calls it at level 0. Since #205 vertices are dense indices and the
graph is CSR — no per-edge `adjacency.get` / iterator allocation.

## `src/findPivots.mjs` — `FindPivots(B, S)`, Algorithm 1 (#44; dense engine #205)

```js
findPivots(B, S, labels, csr, k)  // → { pivots, W }
// B         : strict bound gating membership in W — scalar (Infinity OK) or composite key;
//             d̂ updates are NOT gated
// S         : non-empty Set of complete frontier source INDICES (throws if empty / d̂ not finite)
// labels    : { dist, hops, preds } typed-array engine labels (#205); RELAXED IN PLACE
// csr       : { offsets, targets, weights } — the class's CSR graph (#205)
// k         : rounds + tree-size threshold >= 1 (floored); throws otherwise
export { findPivots };   // NOT re-exported from index.mjs — internal to the algorithm
```

`k` strictly-layered rounds of canonical relaxation out of `S` (`relaxEdge`, ungated;
`< B` in the composite order gates only membership in `W`, and exact canonical equality
re-admits an already-labeled vertex through its recorded setter). **Early exit:** as soon
as `|W| > k·|S|`, returns `pivots = S` (copy) with the partial `W`. Otherwise the paper's
tight-edge forest is simply the canonical predecessor pointers (`labels.preds[v]`): every
vertex of `W \ S` hangs off its pred (always itself in `W`), a DAG or tight cycle is
impossible (one pred per vertex; zero-weight edges strictly increase hops), parent chains
always end in `S`, and `S` members are roots by definition. Pivots = `S`-roots of trees
with `≥ k` vertices; `|pivots| ≤ |W|/k`. The two #44-era tie ambiguities are resolved by
construction. Note: a source with key ≥ `B` can still be returned as a pivot (early exit
copies all of `S`, and direct multi-source callers may pass such sources); `bmsspIndex()`
filters them at seeding.

## `src/tieBreak.mjs` — composite keys + engine labels, Assumption 2.1 realized (#163, #205)

```js
compareKeys(a, b)                  // lexicographic compare of [length, hops, index] triples
compareKeyParts(length, hops, id, key) // #168: same order, left side unpacked — the hot
                                   // loops' allocation-free compare; counts as one comparison
toBound(B)                         // scalar B → [B, -Infinity, -Infinity] (infimum of length-B
                                   // keys, so key < toBound(B) ⇔ the strict scalar contract);
                                   // composite bounds pass through
makeLabels(n)                      // #205: engine label state — { dist:Float64Array(∞),
                                   //   hops:Uint32Array(0), preds:Int32Array(NO_PRED) }
labelKey(v, labels)                // #205: engine frontier key [dist[v], hops[v], v]
relaxEdge(u, v, w, labels, bound?) // #205: canonical relaxation on the typed arrays →
                                   //   RELAX_IMPROVED (dist/hops/preds updated together) |
                                   //   RELAX_EQUAL (candidate exactly matches v's stored
                                   //   label; u is the recorded setter — the re-enqueue
                                   //   signal) | RELAX_LOST (labels untouched). Allocation-
                                   //   free; enqueue paths build the key with labelKey
makeTies(hops?, preds?)            // #163 public-boundary label Maps (BMSSP class mirror)
orderKey(v, dHat, ties)            // #163 Map-based frontier key [d̂[v], hops[v] ?? 0, v]
resetComparisonCount() / getComparisonCount() // #170: unconditional comparison counter over
                                   // compareKeys + compareKeyParts + relaxEdge's inlined
                                   // label compare (the paper's cost metric)
export { compareKeys, compareKeyParts, toBound, makeTies, makeLabels, orderKey, labelKey,
         relaxEdge, NO_PRED, RELAX_LOST, RELAX_EQUAL, RELAX_IMPROVED,
         resetComparisonCount, getComparisonCount };
                                   // NOT re-exported from index.mjs — internal to the algorithm
```

The paper's Assumption 2.1 ("all path lengths distinct") in code: paths ranked by
`[length, hops, index]` — `hops` (the paper's "#vertices") makes zero-weight extensions
strictly increasing, the third component (pred index inside relaxation, own index for
frontier order) stands in for the paper's full vertex-sequence comparison at O(1). Since
#205 the engine uses dense **indices** here; because indices are assigned in ascending
id order, the canonical choice is identical to the pre-#205 id-keyed one. Sources (no
stored pred) hold the `NO_PRED = -1` sentinel (below every real index) and never lose an
equal-`(length, hops)` tie; unlabeled vertices read as hop-0 / distance-∞. `makeTies` and
`orderKey` remain for the **public boundary** — the BMSSP class mirrors the engine arrays
into `{ hops, preds }` Maps for `reconstructPath` and external inspection.

## `src/dijkstra.mjs` — the oracle (already done)

`dijkstra(graph, nodeIDs, source) → Map<nodeId, distance>`. Standard array binary min-heap
with lazy stale-entry skipping (no `DecreaseKey`). Builds its own adjacency list from the edge
array (independent of the class's CSR / `getEdges`). This is the **ground truth** the BMSSP
implementation is tested against — and, since #43, no longer part of the BMSSP code path.

## `src/constantDegree.mjs` — constant-degree transform (#164)

```js
constantDegreeTransform(graph)   // → { edges, copiesOf, originalOf, sourceCopy, collapse }
// graph      : [from, to, weight][] — same input contract as the BMSSP constructor
//              (validated identically; [] is valid → empty transform)
// edges      : the rewritten graph, in/out-degree ≤ 2, fresh integer copy IDs from 0
// copiesOf   : Map<originalId, copyId[]> — a vertex's port copies, in allocation order
// originalOf : Map<copyId, originalId> — the exact inverse of copiesOf
// sourceCopy(orig) : a canonical copy to start a run from (any works; throws for unknown)
// collapse(dist)   : fold a transformed distance Map back onto original IDs (min over a
//                    vertex's copies — all copies share one value, so the min is exact)
export { constantDegreeTransform };   // PUBLIC — re-exported from index.mjs (unlike the
                                      // algorithm-internal heap/blockList/baseCase/… modules)
```

Realizes the paper's Preliminaries assumption (§01): every vertex split into a **zero-weight
directed cycle** of one **port copy per incident edge endpoint**. The cycle gives each copy
exactly one in- and one out-cycle-edge, so a copy that also hosts a single original endpoint
reaches degree 2 on that side and 1 on the other — never more (a lone copy needs no cycle).
Because the cycle costs nothing to traverse, all copies of a vertex are mutually reachable at
zero added distance, so each copy's distance equals the original vertex's: **distance-preserving**.
**Opt-in and correctness-independent** — nothing in `bmssp.mjs`/`baseCase.mjs`/`findPivots.mjs`
calls it; BMSSP is correct on the untransformed graph. A caller opts in by transforming the
graph, running from `sourceCopy(source)`, and `collapse()`-ing the result. Output is
edge-order deterministic (copies allocated in edge order); ~2m copies, ~3m edges — O(m).

## `src/graph.mjs` — flexible input builder + normalizer (#172)

```js
class Graph {                    // PUBLIC — re-exported from index.mjs (like constantDegree)
  addVertex(id)                  // declare a vertex (isolated OK); finite-number; idempotent; → this
  addEdge(from, to, weight)      // directed edge, endpoints auto-declared; validates eagerly; → this
  hasVertex(id) / vertexCount / edgeCount
  toNormalized()                 // → { edges: [[f,t,w]…] (copies), vertices: [id…] }
}
normalizeGraphInput(input)       // → { edges, vertices }; accepts Graph | edge array |
                                 //   adjacency Map | plain object (numeric-string keys)
export { Graph, normalizeGraphInput };  // Graph is public; normalizeGraphInput is used by
                                 //   the BMSSP constructor (not re-exported from index.mjs)
```

The builder is the ergonomic front door: mutators chain
(`new Graph().addEdge(0,1,50).addVertex(9)`), `addVertex` is the only way to introduce an
isolated vertex, and both mutators validate at the call site (friendlier than the
constructor's index-based errors). `toNormalized` deep-copies edges so mutating the builder
after `new BMSSP(g)` can't reach the constructed graph. `normalizeGraphInput` is the shared
reducer described in the BMSSP-class section above — the constructor's sole entry point for
every accepted shape. See §"Flexible inputs (#172)" for the per-shape contract.

## Tests — the contract

- `test/main.test.mjs` (16): constructor input-validation failures (#165), nodeIDs,
  `getEdges` (CSR edge view; #212-repurposed from the old adjacency-Map assertions —
  ingests every input edge, sink → `[]`, edge count preserved), and shortestPaths
  contracts, plus the
  **key one** — "BMSSP vs Dijkstra" on a **seeded 10k-node sparse graph** (`sparseRandom(10_000,
  3, 1601)`, already `topLevel` 3): for a fixed source, `myBMSSP.shortestPaths` must equal
  `dijkstra(...)` for every node. (Until 2026-07-17 this ran on `roadNet-CA.txt`, an 87 MB
  SNAP road network with unseeded random weights — removed in PR #185 and purged from git
  history: irreproducible failures, ~71 s of every run, coverage superseded by the seeded
  fuzz + scale suite.)
- `test/bmssp.test.mjs` (18, #43 + 3 for #205): parameter derivation (clamps, paper formulas,
  `k·2^(topLevel·t) ≥ n` guard), end-to-end hand-built graphs (README example, multi-hop vs
  direct, unreachable ⇒ Infinity, self-loop, source switch), degenerate ties (zero-weight
  cycles/clusters, layered equal-length paths, seeded 0–2-weight stress), the Lemma 3.1
  recursion contract (bounded call: complete-below-boundary, exact membership, d̂ never
  underestimates; unbounded call: successful execution returning exactly the reachable set),
  seeded full-map-vs-oracle stress across sizes (up to n = 2000), and the **#205 public
  boundary**: a composite bound with non-contiguous ids round-tripping id↔index, a
  composite bound keyed on a non-node id, a partial level-0 scalar projection, and an
  unknown-source throw.
- `test/blockList.test.mjs` (25), `test/heap.test.mjs` (16), `test/baseCase.test.mjs` (13),
  `test/findPivots.test.mjs` (12): per-module contracts incl. seeded stress — see the
  module sections above. (Since #205 the `baseCase`/`findPivots` tests drive the functions
  in **dense-index space**: fixtures build a `BMSSP`, seed `g.labels.dist`, pass
  `idxSet(...)` / `g.csr`, and translate results back with `g.ids`. Since #163 the baseCase
  partial-run tests assert the composite contract: strictly below `boundKey`, `≤` the
  scalar bound. #167 added five BlockList tests: hundreds-of-splits drain at M = 2,
  interior-block drops via duplicate-key replacement, both chunking branches of
  `batchPrepend` — sort and median-recursion — and a middle-`d0`-block unlink.)
- `test/select.test.mjs` (11, #167): `partitionByRank` — validation, the every-rank
  contract on shuffled/sorted/reverse/duplicate-heavy/organ-pipe inputs, custom
  comparators, the forced median-of-medians fallback (`cheapBudget: 0`), seeded stress
  across sizes, and determinism of the final arrangement.
- `test/boundIndex.test.mjs` (8, #167): `BoundIndex` — sequence semantics of
  append/insertBefore/remove/first/last/next, leftmost-match `findFirst` on duplicate
  bound runs, and AVL invariants (parent pointers, stored heights, |balance| ≤ 1)
  verified recursively under append-only growth (height ≤ 17 at n = 2048) and two
  seeded random-churn stresses against a reference array.
- `test/tieBreak.test.mjs` (21, #163 + 3 counter tests from #170 + the #168
  `compareKeyParts`-vs-`compareKeys` agreement sweep + a #205 `makeLabels`-defaults check):
  unit tests for `compareKeys`/`toBound`/`relaxEdge` (asserting the #168 RELAX_* code
  contract, since #205 with label state read from typed **engine arrays** via `makeLabels`
  and asserted through `labelKey`)
  (lexicographic order, scalar-bound infimum, canonical pred choice, zero-weight-cycle
  quiescence, the equality re-enqueue signal), then the system-level properties:
  **edge-order determinism** (full runs AND bounded partial calls return identical
  d̂/hops/preds/`boundKey`/`U` across seeded permutations of tie-heavy 0–2-weight graphs),
  **strict Lemma 3.1** (returned vertices strictly below `boundKey`; strict completeness),
  the old zero-weight-cluster stall scenario under a tied bound, and canonical-label
  equality against an independent O(n²) lexicographic-(length, hops) Dijkstra oracle
  (hops = minimal edge count among shortest paths; preds = smallest optimal parent, chain
  reaching the source acyclically).
- `test/constantDegree.test.mjs` (11, #164): the opt-in `constantDegreeTransform`. Degree
  bound (in/out ≤ 2) on a hand-built hub and on all five seeded benchmark shapes — the
  **star** hub (degree ~2(n−1) before) is the key case; per-endpoint copy counts and the
  copiesOf/originalOf inverse; zero-weight cycle edges (and a single-copy vertex getting no
  cycle). Distance preservation checked by `collapse`-ing a transformed-graph distance map
  back onto original IDs and comparing to the **Dijkstra oracle on the original** — from
  *every* source, across the five shapes plus self-loop/zero-weight fixtures — and separately
  with **BMSSP itself** run on the transform. Determinism (collapsed distances invariant
  under edge-list permutation), the empty-graph transform, and constructor-parity input
  validation round it out.
- `test/pathReconstruction.test.mjs` (3, #169): the public `reconstructPath(target)` API
  checked against an independent Dijkstra path oracle, including competing paths, an
  unreachable vertex, calls before a run, source switching on one instance, and rejection
  of a target that is not in the graph.
- `test/multiSource.test.mjs` (19, #171): the public `calculateShortestPathsFrom(sources,
  { bound })` entrypoint. **Single-source equivalence** (`[s]` matches
  `calculateShortestPaths(s)` and the Dijkstra oracle on a seeded 400-node sparse graph;
  `[[s,0]]` == `[s]`); **multi-source semantics** against the `trueDist(v) =
  min_s(d0[s]+dist_s(v))` oracle (nearest-of-many on a hand graph, custom initial distances
  on a seeded 600-node graph, smallest-distance-wins for a repeated source); **bounded runs**
  (a bound between two oracle distances completes exactly `d < B` and prunes the rest to ∞;
  `bound = 0` completes nothing incl. the source; default `∞` is unbounded); **input shapes
  agree** (Map / object / `[id,dist]` pairs / bare ids); **integration** (`reconstructPath`
  and state-reset across `calculateShortestPaths`↔`calculateShortestPathsFrom` calls, isolated
  declared vertex valid as a source); and **validation** (unknown source, negative/NaN/∞
  initial distance, malformed pair, empty set, unrecognized shape, negative/NaN/non-number
  bound, non-numeric object key).
- `test/graph.test.mjs` (18, #172): the flexible-input surface. `Graph` builder
  (chaining, idempotent `addVertex`, endpoint auto-declare, `toNormalized` copy isolation,
  eager id/weight validation); `new BMSSP` from an adjacency **object** and **Map** and a
  **`Graph`** all equal the edge-array result; object string-keys coerce to numeric ids;
  isolated vertices via empty/`null` neighbor lists and `addVertex` (present-but-∞, and
  valid as a source reaching only itself); cross-shape **oracle equivalence** on a seeded
  2k sparse graph; and the failure modes — unrecognized top-level input, malformed
  adjacency entry, non-finite declared vertex, and the unchanged indexed edge-array messages.
- `test/publicApi.test.mjs` (9, #173): the **CONTRACT test** locking the 2.0.0 public
  surface. Asserts `index.mjs` exports exactly `{ BMSSP, Graph, constantDegreeTransform,
  dijkstra }` and their kinds; the `BMSSP` prototype has every documented public method
  (`calculateShortestPaths`, `calculateShortestPathsFrom`, `bmssp`, `reconstructPath`,
  `getEdges`) and an instance carries the public fields (`shortestPaths`/`nodeIDs`/`hops`/
  `preds`) — and, since #212, that the removed `adjacency`/`graph` fields are **absent** —
  with an end-to-end behavior smoke check; the `Graph` builder's
  public methods + chaining/`toNormalized` shape; `constantDegreeTransform`'s locked return
  keys; and `dijkstra`'s signature. Adding/removing/renaming any of these fails CI — the teeth
  behind the document-only boundary.
- `test/edgeCases.test.mjs` (9, #162): deterministic hand-built disconnection fixtures,
  each checked against a hand-computed full distance map **and** the Dijkstra oracle
  (Infinity entries included): self-loop-only source, sink source (adjacency keeps an
  empty list), empty graph rejects any start, five single-node components, ten 3-node
  chain components, a bridge edge pointing into the source's component, a 2-node island
  beside a 100-node chain (source on each side), and A→B→A source switching on one
  instance to prove state resets. Complements the randomized disconnected-forest rounds
  in `fuzz.test.mjs`.
- `test/fuzz.test.mjs` (18, #161 + scale runs added 2026-07-17): the high-volume
  property/fuzz suite. Full-map oracle equality across 8 shapes (the 5 benchmark generators
  reused, plus local random-DAG, disconnected-forest and uniform-multigraph generators; 2
  sources per graph; a thousands-of-nodes round), 4 extreme weight regimes (all-zero,
  zero-or-huge, tiny-int 0–2, dyadic floats — multiples of 1/256 so every path sum is exact
  in float64 and oracle equality stays bit-exact), direct multi-source `bmssp(topLevel, B, S)`
  fuzzing: random source sets (1–4) with initial distances, ground truth = per-source Dijkstra
  oracles (`trueDist(v) = min_s(d0[s] + dist_s(v))`), checking the Lemma 3.1 contract for
  bounded (incl. boundary-tie `B` choices) and unbounded calls — plus **seeded scale runs**:
  sparse n = 150k (asserted `topLevel` 3) and grid 300×300 in the default suite, and an
  **opt-in `FUZZ_XL=1` sparse n = 2M round** (~33 s, `test.skip` otherwise). Every failure
  message carries the round's seed for reproduction. **`FUZZ_ROUNDS=<x>`** multiplies all
  round counts (default 1 ≈ 0.5 s; 25 ≈ 10 s, several thousand graphs).
- `test/benchmarks.test.mjs` (9, #170): the harness itself. `dijkstraAdjacency` equals the
  shipped `dijkstra` on seeded graphs, reports Infinity for unreachable nodes, rejects an
  unknown source; both comparison counters count, reset, and are deterministic for a fixed
  graph; `countMismatches` (shared via `bench-util.mjs`) unit-tested on both branches
  (identical maps incl. Infinity → 0; wrong/missing entries counted); `runScenarioBenchmark`
  and `runComparisonCountBenchmark` on tiny injected scenarios return the expected columns
  with **zero mismatches**.
- Current suite: **238 tests — 237 passing + 1 XL skipped by default** (#212 added a
  contract test pinning `graph`/`adjacency` as removed, taking `publicApi.test.mjs` to 10;
  #171 the 19-test `multiSource.test.mjs`; #172 the 18-test `graph.test.mjs`; `bmssp.mjs`,
  `index.mjs`, `graph.mjs` and `test/helpers.mjs` at 100%),
  ~100% statement coverage, ~7 s wall-clock (the #164 distance-preservation sweeps run
  BMSSP/Dijkstra from every source). No graph data files: every generated test graph comes
  from a seed; the #162 fixtures are hand-built and fully deterministic. Like #205, the #212
  direct-CSR change touched construction and the test/bench oracle plumbing (`edgesOf`/
  `adjacencyOf` rebuild the removed fields from `getEdges`) but not a single oracle/determinism
  assertion — the fuzz (incl. FUZZ_ROUNDS=25 + FUZZ_XL 2M), edge-case, tie-break-determinism
  and constant-degree suites pass unchanged, the correctness proof that the CSR is identical.

## Benchmarks (`benchmarks/`, `npm run bench` / `npm run bench:counts`)

Deterministic (seeded) micro-benchmarks; since #170 the harness runs the full
BMSSP-vs-Dijkstra head-to-head itself:

- `adjacency.bench.mjs`: the #45 map is ~thousands× faster per-node than a linear scan.
- `scenarios.bench.mjs`: per shape, algorithm-only `dijkstra ms` / `bmssp ms` / `ratio`
  columns — both sides consume an adjacency Map built once from the BMSSP instance via
  `adjacencyOf` (getEdges → Map; since #212 the class no longer stores one) outside the timed
  region (`dijkstra-adj.mjs` is the fair baseline) and outputs are verified node-by-node
  (`mismatches` must be 0).
  Scenario registry adds `sparse-random-l4` (n = 300k, degree 3): `topLevel` steps 3→4 at
  exactly n = 2^18 + 1 and stays 4 until t reaches 7 (~n = 376k), so 300k sits inside the
  #182 level-transition window (the step itself measures ~+24% at the exact straddle).
  **Post-#205 capture (2026-07-21): sparse-random 1.38×, dense 1.16×, grid 2.27×,
  chain 3.10×, star 2.48×, sparse-random-l4 1.07×** — the dense-index engine roughly
  halved `bmssp ms` on every shape (sparse-l4 ~1083 → ~426 ms). Ratios are noisy
  run-to-run (the Dijkstra denominator swings ±20%); compare `bmssp ms` across captures
  for regressions.
- `compare-counts.bench.mjs` (opt-in, `npm run bench:counts` or `--counts`): comparisons
  between path lengths — BMSSP counted via `tieBreak`'s unconditional `compareKeys`
  counter, Dijkstra via matching counters in `dijkstra-adj.mjs`. One exact run per side
  (counts are deterministic). 2026-07-21 post-#167 capture: crossover before n = 50k —
  sparse **0.97× at 50k → 0.77× at 200k → 0.66× at 1M**; grid 700×700 down to 1.12×
  (pre-#167: 1.20× / 1.03× / 0.98× / 1.27× — sort-based splits/pulls were the cost).
- **`HEAD-TO-HEAD.md` is the frozen 1.0.0 measurement record** (2026-07-16, sizes to
  n = 4M incl. star-500k 67.8× and the 4M cliff) plus dated addenda (#182 cliffs,
  #167 crossover shift); `RESULTS.md` is the latest captured harness report.

## Gaps to fill (the actual work)

| Missing piece | Lives where | Issue | Status |
|---|---|---|---|
| Per-node edge adjacency map | `BMSSP` constructor | #45 | ✅ done (PR #160) |
| Lemma 3.3 block-list `D` | `src/blockList.mjs` | #42 | ✅ done (PR #175) |
| Binary min-heap module | `src/heap.mjs` | #41 | ✅ done (PR #177) |
| Base case (bounded Dijkstra) | `src/baseCase.mjs` | #40 | ✅ done (PR #178) |
| FindPivots | `src/findPivots.mjs` | #44 | ✅ done (PR #180) |
| Main `BMSSP(l, B, S)` recursion + `k,t` derivation | `src/bmssp.mjs` | #43 | ✅ done (PR #181) — **1.0.0 milestone complete** |
| Property/fuzz suite vs. the oracle | `test/fuzz.test.mjs` | #161 | ✅ done (PR #184, 1.0.1) |
| Deterministic disconnection edge cases | `test/edgeCases.test.mjs` | #162 | ✅ done (PR #187, no bump) |
| Deterministic tie-breaking (Assumption 2.1) | `src/tieBreak.mjs` + all modules | #163 | ✅ done (PR #188, no bump) |
| Public shortest-path reconstruction | `BMSSP.reconstructPath()` + `test/pathReconstruction.test.mjs` | #169 | ✅ done (PR #189, no bump) |
| Constructor input validation | `BMSSP` constructor + `test/main.test.mjs` | #165 | ✅ merged (PR #191, no bump) |
| Optional constant-degree transform (in/out-degree ≤ 2) | `src/constantDegree.mjs` + `test/constantDegree.test.mjs` | #164 | ✅ merged (PR #195, no bump) |
| JSDoc on `index.mjs` exports + public-API docs page | `index.mjs` + `docs/index.html` | #166 | ✅ merged (PR #196, **minor → 1.1.0**, released 2026-07-21) |
| BMSSP-vs-Dijkstra head-to-head in the harness | `benchmarks/` + `src/tieBreak.mjs` counter | #170 | ✅ merged (PR #198, no bump) |
| Performance-cliff investigation + quadratic batchPrepend fix | `src/blockList.mjs` + HEAD-TO-HEAD addendum | #182 | ✅ merged (PR #200, **patch → 1.1.1**, released 2026-07-21) |
| Exact Lemma 3.3 asymptotics (BST bound index + linear selection) | `src/boundIndex.mjs` + `src/select.mjs` + `src/blockList.mjs` | #167 | ✅ merged (PR #202, no bump) |
| Relaxation micro-optimizations (allocation-free relaxEdge, unpacked routing, heap measurement) | `src/tieBreak.mjs` + `src/bmssp.mjs` + `src/baseCase.mjs` + `src/findPivots.mjs` | #168 | ✅ merged (PR #203, **minor → 1.2.0**, released 2026-07-21) |
| Dense-index core: typed-array labels + CSR adjacency | `src/tieBreak.mjs` (makeLabels) + `src/bmssp.mjs` (buildIndex/CSR) + `src/baseCase.mjs` + `src/findPivots.mjs` | #205 | ✅ merged (PR #206, no bump — API-non-breaking) |
| Typed / flexible graph inputs (Graph builder + adjacency Map/object + explicit vertex universe) | `src/graph.mjs` (new) + `src/bmssp.mjs` (constructor) + `index.mjs` (Graph export) + `test/graph.test.mjs` | #172 | ✅ merged (PR #208, no bump — mid-2.0.0) |
| Public multi-source / bounded entrypoint (`calculateShortestPathsFrom`) | `src/bmssp.mjs` + `test/multiSource.test.mjs` | #171 | ✅ merged (PR #209, no bump — mid-2.0.0) |
| Public-API stabilization + 1.0→2.0 migration note | `src/bmssp.mjs` (JSDoc) + `MIGRATION.md` + `docs/index.html` + `examples/` + `test/publicApi.test.mjs` | #173 | ✅ merged (PR #210, **major → 2.0.0**, released 2026-07-21 — milestone-closing) |
| Direct-CSR construction: build index/CSR from the input, remove public `graph`/`adjacency` | `src/bmssp.mjs` (constructor/buildIndex/getEdges) + `test/helpers.mjs` + `benchmarks/bench-util.mjs` + test/docs migration | #212 | ✅ done-pending-merge (this PR, **major → 3.0.0** — milestone-closing) |

Milestones `1.1.0` (correctness hardening), `1.2.0` (performance & ergonomics) and `2.0.0`
(API-breaking generalization — #205/#172/#171/#173) are all **closed and released**
(2.0.0 on 2026-07-21, npm + Docker Hub; landed additively, so 2.0.0 had **no breaking
changes** — see `MIGRATION.md`). Milestone `3.0.0` (performance) is being closed by **this
PR**: **#212** (direct-CSR construction) is its only issue — it builds the index/CSR straight
from the input and removes the public `this.graph` / `this.adjacency` fields (the one breaking
change, hence **major → 3.0.0**), roughly halving construction time. See
[06-milestones-roadmap.md](06-milestones-roadmap.md).
