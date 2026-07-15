# 07 — Glossary

<!-- Updated on: RKB (revitalize_knowledge_base) -->

> **Lifecycle: dynamic — updated on `RKB`.** This glossary is refreshed on the on-demand
> `revitalize_knowledge_base` (`RKB`) command (see `../CLAUDE.md`). When code or the roadmap
> introduces new symbols/terms (e.g. new module names, new data-structure fields), add them
> here during the `RKB` refresh. Not touched during normal session start.

Quick lookup for the symbols and terms used across the paper, the notes, and the code.

## Symbols

| Symbol | Meaning |
|---|---|
| `n`, `m` | number of vertices / edges. Sparse graphs: `m = O(n)`. |
| `s` | the source vertex. |
| `d(v)` | **true** shortest distance from `s` to `v`. |
| `d̂[v]` | current distance **estimate** (`≥ d(v)`, starts ∞, only decreases). In code: `shortestPaths` map. |
| `w(u,v)`, `w_uv` | weight of edge `(u,v)`; non-negative. |
| `Pred[v]` | predecessor of `v` on the current best path (forms a tree). |
| `B` | upper distance **bound** for a (sub)problem; only vertices with `d < B` are in scope. |
| `B'` | the **returned** boundary of a call, `B' ≤ B`. Says how much real progress was made. |
| `S` | the **frontier** / source set of a (sub)problem. `|S| ≤ 2^(l·t)`. |
| `U` | the set of completed vertices a call returns (all with `d < B'`, reachable via `S`). |
| `U'` | (analysis) all `v` with `d(v) < B` whose shortest path visits `S`. Success ⇒ `U = U'`. |
| `P` | **pivots**: the ⊆ `S` roots of big shortest-path trees; `|P| ≤ |W|/k`. From FindPivots. |
| `W` | vertices completed/collected by FindPivots' `k` Bellman-Ford rounds; `|W| = O(k·|S|)`. |
| `F` | forest of "tight" edges (`d̂[v] == d̂[u]+w(u,v)`) inside `W`; used to find pivot roots. |
| `D` | the Lemma 3.3 **block-based list** (Insert / BatchPrepend / Pull). §03-B. |
| `k` | `⌊log^(1/3) n⌋`. Bellman-Ford step count in FindPivots; base-case batch cap (`k+1`). |
| `t` | `⌊log^(2/3) n⌋`. Governs branching/level sizing. |
| `l` | recursion **level**, `0 … ⌈(log n)/t⌉`. `l = 0` is the base case. |
| `M` | block-list block/pull size at level `l`: `M = 2^((l-1)·t)`. |
| `Si`, `Bi` | the `i`-th `Pull`'s batch of keys and its separating bound. |
| `Bi'`, `Ui` | boundary and completed-set returned by the `i`-th recursive `BMSSP(l-1,…)`. |
| `K` | staging set for BatchPrepend: newly-relaxed neighbors landing in `[Bi', Bi)`. |

## Terms

- **Complete / incomplete vertex** — `v` is *complete* when `d̂[v] == d(v)` (estimate is
  final); otherwise *incomplete*. Completeness is relative to algorithm progress.
- **Frontier** — the set `S` such that every in-scope incomplete vertex's shortest path
  passes through a complete member of it. Dijkstra's is the priority queue; BMSSP keeps it
  small via FindPivots.
- **Pivot** — a frontier vertex that is the root of a shortest-path tree with `≥ k` vertices;
  the only frontier vertices worth recursing on.
- **Relaxation** — `if d̂[u]+w(u,v) ≤ d̂[v]: d̂[v] ← d̂[u]+w(u,v)`. Note `≤` (Remark 3.4) so a
  lower-level relaxation can be reused higher up.
- **Sorting barrier** — the Ω(n log n) cost of producing a fully sorted order; Dijkstra pays
  it, BMSSP sidesteps it by not sorting the frontier.
- **Comparison-addition model** — cost model where only `+` and `<` on real weights are
  allowed, each O(1). The paper's setting.
- **Successful vs partial execution** — a `BMSSP` call is *successful* if `D` empties
  (`B' = B`, returns all of `U'`); *partial* if the workload cap `|U| < k·2^(l·t)` trips
  (`B' < B`, returns only vertices below `B'`).
- **Constant-degree transform** — reduces any graph to in/out-degree ≤ 2 by splitting each
  vertex into a zero-weight cycle. Needed for the paper's bounds; optional in practice.
- **BaseCase / FindPivots / BMSSP** — Algorithm 2 / Algorithm 1 / Algorithm 3. See §02.
- **BlockList (`D`)** — Lemma 3.3 semi-sorted structure. See §03-B.
- **Oracle** — the reference `dijkstra()` in `src/dijkstra.mjs`; ground truth for tests.
