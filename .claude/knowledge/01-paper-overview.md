# 01 — Paper Overview

Source: _"Breaking the Sorting Barrier for Directed Single-Source Shortest Paths"_
(Duan, Mao, Mao, Shu, Yin, 2025; arXiv 2504.17033v2; ACM 10.1145/3717823.3718179).

## The result

A **deterministic O(m·log^(2/3) n)** algorithm for single-source shortest paths (SSSP) on
directed graphs with real, non-negative edge weights, in the **comparison-addition model**
(only comparisons and additions on weights, each O(1)). This is the first algorithm to beat
Dijkstra's classic **O(m + n·log n)** bound on sparse graphs — i.e. it proves Dijkstra is
_not_ optimal for SSSP when you only need distances, not a full sorted order.

- `n` = number of vertices, `m` = number of edges.
- The improvement matters on **sparse** graphs where `m = O(n)`.

## Why Dijkstra has a "sorting barrier"

Dijkstra repeatedly extracts the closest vertex from a priority queue and relaxes its edges.
As a byproduct it produces vertices **in sorted distance order**. Producing a total sorted
order of n items costs Ω(n log n) — the "sorting barrier." Haeupler et al. (2024) showed
Dijkstra is optimal _if_ you must output that order. The trick here: **we don't need the
order, only the distances**, so we can avoid fully sorting the frontier.

## The core idea (one screen)

- At a moment in Dijkstra, the priority queue holds a **frontier** `S`. Every incomplete
  vertex `u` whose true distance `d(u) < B` has a shortest path that must pass through some
  **complete** vertex in `S`. We say such a `u` is "dependent on" `S`.
- The cost blows up because `S` can hold Θ(n) vertices and we keep re-sorting them.
- **Key move — shrink the frontier.** Suppose we only care about distances `< B`. Let `U'`
  be the vertices `u` with `d(u) < B` reachable through `S`. We can always reduce the useful
  frontier to size **`|U'| / k`** for a parameter `k = log^Ω(1)(n)`:
  - If `|U'| > k·|S|`, the frontier is _already_ small relative to `U'` (`≤ |U'|/k`).
  - Otherwise run **Bellman-Ford for k steps** from `S`. Any vertex whose shortest path uses
    `< k` intermediate frontier-region vertices becomes complete. The rest must hang off a
    shortest-path tree with `≥ k` vertices — so only the **roots** ("pivots") of those big
    trees matter, and there are at most `|U'|/k` of them.
- Instead of a dynamic Dijkstra frontier (intractable to keep small), use **divide-and-
  conquer** with `O((log n)/t)` levels. Each level has a frontier and a bound `B`. Frontier
  reduction means the expensive Θ(t) work per vertex applies only to the ~`1/log^Ω(1)(n)`
  pivots — dropping cost per vertex from `log n` to `log n / log^Ω(1) n`.

## The two parameters

```
k = ⌊ log^(1/3)(n) ⌋      // "steps" of Bellman-Ford in FindPivots; base-case batch size
t = ⌊ log^(2/3)(n) ⌋      // controls the branching / recursion depth
```

- Recursion has levels `l ∈ [0, ⌈(log n)/t⌉]`. Depth is `O((log n)/t) = O(log^(1/3) n)`.
- At level `l`, the frontier obeys `|S| ≤ 2^(l·t)`, and the block-list parameter is
  `M = 2^((l-1)·t)`.
- Top-level call: `BMSSP(l = ⌈(log n)/t⌉, B = ∞, S = {s})`. Because `|U| ≤ |V|` this must be
  a "successful execution," and all distances get computed.

> **Practical note (from the explainer):** these asymptotics only win for astronomically
> large n. A straightforward implementation runs ~5–7× slower than Dijkstra in practice.
> The value of this repo is a **correct, readable** implementation, not raw speed.

## Preliminaries / model assumptions

- **Constant-degree graph.** The paper first transforms `G` so every vertex has in-degree
  and out-degree ≤ 2 (split each vertex into a small zero-weight cycle). This keeps `m = O(n)`
  and makes the "constant out-degree" arguments hold. An implementation may skip this
  transform and just handle general degrees; it affects constants, not correctness.
- **All vertices reachable from `s`** is assumed (so `m ≥ n − 1`).
- **Distinct path lengths (Assumption 2.1).** The paper assumes every path has a unique
  length, giving a strict total order on paths. This keeps the predecessor pointers `Pred[]`
  a proper tree and breaks ties deterministically. In code, ties can be broken by an explicit
  rule (e.g. by (length, #vertices, vertex sequence)) — you rarely need the full machinery,
  but be aware equal distances need a consistent tie-break.
- **Labels.** `d̂[v]` starts at 0 for the source, ∞ elsewhere, and only ever decreases via
  edge relaxation `d̂[v] ← min(d̂[v], d̂[u] + w(u,v))`. `Pred[v]` records the predecessor.

## Mapping to code

- `d̂[·]` ⇢ the `shortestPaths` Map in `src/bmssp.mjs`.
- The Dijkstra oracle ⇢ `src/dijkstra.mjs` (already implemented; used in tests).
- `k`, `t` ⇢ to be derived from `n = nodeIDs.size` when the algorithm is built.
