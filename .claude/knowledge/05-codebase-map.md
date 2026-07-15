# 05 — Codebase Map (current state)

<!-- BOOKMARK-COMMIT: e4c4d73a3c36fbf43a3ad96a70d833727c8bbe37 -->
<!-- BOOKMARK-BRANCH: main -->
<!-- Last validated against the above commit. Update both the comment and the body when HEAD moves. -->

Snapshot of what exists in `bmssp-js` today, so you know what to build on vs. what's missing.

## 🔄 Session-start validation (this file is DYNAMIC)

This map is only true as of the **bookmark commit** recorded in the HTML comment at the top
of this file (`BOOKMARK-COMMIT`). The repo changes as commits land on `main`, so validate at
the start of every session:

```bash
git rev-parse HEAD          # compare to BOOKMARK-COMMIT above
```

- **HEAD == bookmark** → this map is current; nothing to do.
- **HEAD != bookmark** → the repo moved. Re-inspect and reconcile:
  1. `git diff --stat <BOOKMARK-COMMIT> HEAD` to see what changed.
  2. Re-read anything under `src/`, `test/`, `examples/`, `index.mjs`, `package.json` that
     changed (especially: did any of the missing pieces below get implemented?).
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
  bmssp.mjs               # BMSSP class — scaffolding only (no real algorithm yet)
  dijkstra.mjs            # reference Dijkstra (array binary-heap) — DONE, used as oracle
test/
  main.test.mjs           # Jest tests: constructor, nodeIDs, shortestPaths, BMSSP-vs-Dijkstra
  roadNet-CA.txt          # real road-network edge list (SNAP roadNet-CA), weights randomized at load
  README.md
examples/
  main.mjs                # tiny usage example (constructs BMSSP, prints .graph)
docs/index.html           # published docs page
```

Tooling: Jest (`npm test`, needs `--experimental-vm-modules`, already in the `test` script),
ESLint + Prettier (`npm run lint` / `npm run format`), Dockerfile, GitHub Actions (dependabot
bumps dominate recent history).

## `src/bmssp.mjs` — what the class does now

```js
class BMSSP {
  constructor(inputGraph)          // inputGraph = array of [from, to, weight]
  //   this.graph          : deep-copied edge array
  //   this.nodeIDs        : Set of all node IDs (from both endpoints)
  //   this.shortestPaths  : Map<nodeId, distance>, initialized to Infinity  ← this is d̂[·]
  initializeShortestPaths()        // (re)set every nodeId's distance to Infinity
  calculateShortestPaths(startNode)// validates startNode, then DELEGATES TO dijkstra()
}
```

**Important:** `calculateShortestPaths` currently just calls the reference `dijkstra()` and
copies the result into `shortestPaths`. It is a **placeholder** — the real BMSSP algorithm
(base case → FindPivots → block list → main recursion) has **not** been written yet. That's
the whole point of issues #40–#45. The eventual BMSSP entry point should reproduce Dijkstra's
answers via the paper's method, not by calling Dijkstra.

## `src/dijkstra.mjs` — the oracle (already done)

`dijkstra(graph, nodeIDs, source) → Map<nodeId, distance>`. Standard array binary min-heap
with lazy stale-entry skipping (no `DecreaseKey`). Builds an adjacency list from the edge
array. This is the **ground truth** the BMSSP implementation is tested against. Reuse its
heap style / adjacency-list building.

## Tests (`test/main.test.mjs`) — the contract

- Constructor stores `graph` verbatim; `nodeIDs` = unique endpoints; `shortestPaths` all ∞.
- `calculateShortestPaths(start)` sets `d̂[start] = 0` and throws on an unknown start node.
- `dijkstra` throws on a source not in `nodeIDs`.
- **Key one:** "BMSSP vs Dijkstra" — for a fixed source, `myBMSSP.shortestPaths` must equal
  `dijkstra(...)` for every node. **Any real BMSSP implementation must keep this passing.**

Graph data: `roadNet-CA.txt` is a large real directed road network; edge weights are assigned
a random integer in `[1, 1e8]` at load time (so weights differ per run, but BMSSP and Dijkstra
see the same array within a run).

## Gaps to fill (the actual work)

| Missing piece | Lives where (suggested) | Issue |
|---|---|---|
| Binary min-heap module | `src/heap.mjs` (or inline) | #41 |
| Base case (bounded Dijkstra) | `src/baseCase.mjs` / method | #40 |
| Per-node edge adjacency map | in `BMSSP` constructor | #45 |
| Lemma 3.3 block-list `D` | `src/blockList.mjs` | #42 |
| FindPivots | `src/findPivots.mjs` / method | #44 |
| Main `BMSSP(l, B, S)` recursion + `k,t` derivation | `src/bmssp.mjs` | #43 |

See [06-milestones-roadmap.md](06-milestones-roadmap.md) for the recommended order and test strategy.
