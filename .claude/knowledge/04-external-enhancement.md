# 04 — External Enhancement (consolidated intuition)

> **Status: fixed.** This file was assembled once, from a few web searches, purely to
> strengthen the working understanding of the algorithm beyond the formal paper (§01–03).
> No source attribution is kept — treat it as background intuition. **It does not need to be
> regenerated in future sessions.**

## Framing

The result restated in plain terms: a **deterministic O(m·log^(2/3) n)** single-source
shortest-path algorithm for directed graphs with real non-negative weights — the first to
break Dijkstra's O(m + n·log n) "sorting barrier" on sparse graphs, and a recognized landmark
result in the field. The advantage is **asymptotic** (matters at very large n), not a
practical speedup on ordinary inputs.

## Problem generalization (why "multi-source" + "bounded")

- Classic SSSP finds distances from one source. **BMSSP generalizes** to a **set** of sources
  `S`, each with an initial distance, plus a distance **bound `B`**.
- Setting `S = {s}` at distance 0 with `B = ∞` recovers ordinary shortest paths. That
  generalization is exactly what makes the recursion work: each recursive call is a smaller
  bounded-multi-source problem.

## The two ideas that beat the barrier

1. **Distance bands + pivots (frontier shrink).** Think of the vertices as partitioned into
   ordered **distance bands**. Within a band, do lightweight Bellman-Ford-style relaxation for
   `k` steps from the current frontier `S`. Vertices reachable within `k` hops get finalized;
   the rest must funnel through the **root of a large shortest-path tree** — a **pivot**. Only
   the ~`|U|/k` pivots are carried into deeper recursion. So the expensive per-vertex work
   applies to roughly `1/log^Ω(1)(n)` of the frontier instead of all of it — turning `log n`
   sorting work into `log^(2/3) n`.
2. **Semi-sorted block list (partial sorting instead of a heap).** A heap keeps everything
   totally ordered → `log n` per op → the barrier. The Lemma 3.3 structure keeps elements in
   **blocks ordered relative to each other but unsorted inside** each block. That is enough to
   repeatedly pull the next-smallest batch and to cheaply prepend a batch known to be smaller
   than everything present — **without paying for a full sort**.

## Mental model of a run

- Recursively **partition the vertex set** into ordered pieces by distance, recursing into
  each with a tighter bound `B`.
- After ~`(log n)/t` levels the sub-problem is a single vertex → the base case (a tiny bounded
  Dijkstra). Each child returns a boundary `B'` telling the parent how much genuine progress
  (how far under `B`) was actually made, so the parent knows what to re-queue.

## Practical reality (important for this repo)

- Independent implementations exist in several languages, and a follow-up experimental study
  confirms the consensus: **in practice the algorithm does not meaningfully outperform a good
  Dijkstra yet** — real speedups are far smaller than theory predicts, dominated by constant
  factors, cache behavior, and the overhead of the recursion and block-list machinery. The
  crossover point where the asymptotics win is astronomically large.
- **Implication for `bmssp-js`:** optimize for **correctness and readability first**. Validate
  every step against the reference Dijkstra oracle already in the repo. A correct, clear,
  well-tested implementation is the goal — raw wall-clock speed is not.

## What to carry into implementation

1. The two levers are always `k` (Bellman-Ford steps / batch granularity) and `t` (branching /
   recursion depth).
2. "Pivots" = roots of big shortest-path trees; "block list" = semi-sorted batches. If a piece
   of code isn't serving one of those two ideas, question it.
3. Correctness is defined by matching Dijkstra; performance is a distant secondary concern.
