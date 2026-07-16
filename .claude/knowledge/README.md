# bmssp-js Knowledge Base

A distilled, self-contained "mental map" of everything needed to implement the BMSSP
algorithm in this repo, so an agent — **any model** — can start on the issues **without
visiting the paper, PDF, or any external article**.

**Operational entrypoint is [`../CLAUDE.md`](../CLAUDE.md)** — it defines the full working
lifecycle (Phase A session start → Phase C automatic pre-PR sync → Phase E gated release)
that keeps the dynamic files below in sync. Read it first each session.

## Files and lifecycle

| # | File | Lifecycle |
|---|------|-----------|
| 1 | **[01-paper-overview.md](01-paper-overview.md)** — big idea, sorting barrier, `k`/`t` | Fixed |
| 2 | **[02-algorithms.md](02-algorithms.md)** — FindPivots / BaseCase / BMSSP pseudocode | Fixed |
| 3 | **[03-data-structures.md](03-data-structures.md)** — Lemma 3.3 block-list + heap | Fixed |
| 4 | **[04-external-enhancement.md](04-external-enhancement.md)** — consolidated intuition | Fixed |
| 5 | **[05-codebase-map.md](05-codebase-map.md)** — what exists in `src/` today | **Dynamic** — validated at session start (Phase A); rewritten inside every PR (Phase C) |
| 6 | **[06-milestones-roadmap.md](06-milestones-roadmap.md)** — milestones/issues → build order | **Dynamic** — read-reconciled at session start; proposals in Phase C; gated GitHub writes in Phase E |
| 7 | **[07-glossary.md](07-glossary.md)** — symbol/term lookup | **Dynamic** — updated in Phase C |

"Fixed" = verified transcription/intuition; change `01–03` only to fix a factual error
against the paper, never to restyle. All dynamic facts (versions, issue states, module
inventories) live **only** in `05`/`06`/`07` — see the single-source-of-truth rule in
`../CLAUDE.md`.

## Reading map — what to read for the task at hand

| If you are… | Read exactly |
|---|---|
| Starting any session | `../CLAUDE.md` Phase A, then this table |
| Implementing **#44 FindPivots** (Alg 1) | `02` §Algorithm 1 · `05` (`baseCase`/adjacency APIs to mirror) · `07` (`W`, `P`, `F`, tight edge) |
| Implementing **#43 main BMSSP** (Alg 3) | `02` §Algorithm 3 · `03`-B (`D`'s contracts, `[Bi', Bi)` staging) · `06` §Parameter derivation · `05` (all module APIs) |
| Touching the **BlockList** | `03`-B · `05` §blockList · issue #167 (deferred asymptotics) |
| Touching the **heap / BaseCase** | `03`-A · `02` §Algorithm 2 · `05` §heap/§baseCase |
| Writing **tests** | `02` §Correctness invariant · `03` §Minimal test ideas · `05` §Tests |
| Deciding **what to build next** | `06` (build order + milestone tables) |
| Unsure what a symbol means | `07` |
| Explaining the project to a human | root `README.md` (kept current in Phase C) |

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
