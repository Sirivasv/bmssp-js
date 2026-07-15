# bmssp-js Knowledge Base

A distilled, self-contained "mental map" of everything needed to implement the BMSSP
algorithm in this repo, so an agent can start on the issues **without visiting the paper,
PDF, or any external article**.

**Operational entrypoint is [`../CLAUDE.md`](../CLAUDE.md)** — it defines the session-start
routine and the on-demand `RKB` (`revitalize_knowledge_base`) command that keep the dynamic
files below in sync. Read it first each session.

## Files and lifecycle

| # | File | Lifecycle |
|---|------|-----------|
| 1 | **[01-paper-overview.md](01-paper-overview.md)** — big idea, sorting barrier, `k`/`t` | Fixed |
| 2 | **[02-algorithms.md](02-algorithms.md)** — FindPivots / BaseCase / BMSSP pseudocode | Fixed |
| 3 | **[03-data-structures.md](03-data-structures.md)** — Lemma 3.3 block-list + heap | Fixed |
| 4 | **[04-external-enhancement.md](04-external-enhancement.md)** — consolidated intuition | Fixed |
| 5 | **[05-codebase-map.md](05-codebase-map.md)** — what exists in `src/` today | **Dynamic** — validated vs. bookmark commit at session start; refreshed on `RKB` |
| 6 | **[06-milestones-roadmap.md](06-milestones-roadmap.md)** — milestones/issues → build order | **Dynamic** — read-reconciled from GitHub at session start; two-way synced on `RKB` |
| 7 | **[07-glossary.md](07-glossary.md)** — symbol/term lookup | **Dynamic** — updated on `RKB` |

## One-paragraph summary

Dijkstra spends Θ(n log n) because it keeps a fully-sorted frontier. BMSSP replaces the
single global priority queue with a **recursive divide-and-conquer over vertex sets**,
bounded by a distance ceiling `B`. At each level it (a) uses **FindPivots** to shrink the
frontier `S` down to the few "pivot" roots that actually matter (~|U|/k of them), (b) stores
those pivots in a **block-based partial-sorting structure `D`** that supports cheap
batched inserts and `Pull`ing the next small batch, and (c) recurses on smaller sub-bounds.
The base case (level 0, singleton source) is a small bounded Dijkstra. Parameters are
`k = ⌊log^(1/3) n⌋` and `t = ⌊log^(2/3) n⌋`. Correctness is checked against a plain
Dijkstra oracle already in the repo.

## Conventions used across these notes

- `d̂[v]` = current distance estimate for vertex `v` (starts ∞, only decreases). In code
  this is the `shortestPaths` map. `d(v)` = the true shortest distance.
- A vertex is **complete** when `d̂[v] == d(v)`.
- `w(u,v)` / `w_uv` = weight of edge `(u,v)`. Weights are non-negative.
- Pseudocode uses the paper's names (`B`, `S`, `U`, `P`, `W`, `D`, `k`, `t`, `l`, `M`).
  See the [glossary](07-glossary.md).
