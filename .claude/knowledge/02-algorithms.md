# 02 — The Three Algorithms

Transcribed and explained from Section 3.1 of the paper. These are the exact procedures the
repo needs to implement. Notation: `d̂[v]` = current estimate, `d(v)` = true distance,
`w(u,v)` = edge weight, `k`/`t` = the two parameters, `l` = recursion level.

Relaxing an edge `(u,v)` means: if `d̂[u] + w(u,v) ≤ d̂[v]`, set `d̂[v] ← d̂[u] + w(u,v)`
(and `Pred[v] ← u`). **The `≤` (not `<`) is deliberate** — equality lets an edge relaxed at
a lower level be reused at an upper level (Remark 3.4).

---

## Algorithm 2 — `BaseCase(B, S)`  → the level-0 case

**Preconditions:** `S = {x}` is a singleton and `x` is complete; every incomplete vertex `v`
with `d(v) < B` has a shortest path through `x`.
**Returns:** a boundary `B' ≤ B` and a vertex set `U`.

This is a **mini bounded Dijkstra** from `x` that stops after collecting `k+1` vertices.

```
function BaseCase(B, S = {x}):
    U0 ← {x}
    H  ← binary min-heap, initialized with ⟨x, d̂[x]⟩
    while H is non-empty and |U0| < k + 1:
        ⟨u, d̂[u]⟩ ← H.ExtractMin()
        U0 ← U0 ∪ {u}
        for each edge (u, v):
            if d̂[u] + w(u,v) ≤ d̂[v] and d̂[u] + w(u,v) < B:
                d̂[v] ← d̂[u] + w(u,v)
                if v not in H: H.Insert(⟨v, d̂[v]⟩)
                else:          H.DecreaseKey(⟨v, d̂[v]⟩)
    if |U0| ≤ k:
        return B' ← B,  U ← U0                      # exhausted before k+1 → full success
    else:
        Bʹ ← max_{v ∈ U0} d̂[v]
        return B' ← Bʹ,  U ← { v ∈ U0 : d̂[v] < Bʹ } # hit the k+1 cap → report partial boundary
```

**Plain English:** grow the closest-vertex set from `x`, bounded by `B`. If fewer than `k+1`
vertices exist under `B`, you've found them all (`B' = B`). If you hit `k+1`, you stop early
and report `B'` = the largest distance seen, returning only the strictly-closer vertices.

**Implements issues:** #40 (base case) and depends on #41 (the binary heap).

---

## Algorithm 1 — `FindPivots(B, S)`  → shrink the frontier

**Precondition:** every incomplete `v` with `d(v) < B` has a shortest path through some
complete vertex in `S`.
**Returns:** a set `W ⊆ U'` of size `O(k·|S|)` and pivots `P ⊆ S` of size `≤ |W|/k`, such
that for every `x ∈ U'` either (a) `x ∈ W` and is complete, or (b) its shortest path visits a
complete pivot in `P`.

```
function FindPivots(B, S):
    W  ← S
    W0 ← S
    for i in 1..k:                              # k rounds of Bellman-Ford relaxation
        Wi ← ∅
        for each edge (u, v) with u ∈ W_{i-1}:
            if d̂[u] + w(u,v) ≤ d̂[v]:
                d̂[v] ← d̂[u] + w(u,v)
                if d̂[u] + w(u,v) < B:
                    Wi ← Wi ∪ {v}
        W ← W ∪ Wi
        if |W| > k·|S|:                         # frontier already small vs. W → all of S are pivots
            return P ← S, W
    # forest of tight edges inside W (unique under the distinct-length assumption):
    F ← { (u,v) ∈ E : u,v ∈ W and d̂[v] == d̂[u] + w(u,v) }
    P ← { u ∈ S : u is the root of a tree in F with ≥ k vertices }
    return P, W
```

**Plain English:** relax outward from `S` for `k` steps. Vertices reachable within `k` hops
get completed and land in `W`. If `W` blows past `k·|S|`, bail early and treat all of `S` as
pivots. Otherwise, build the forest `F` of "tight" (shortest-path) edges among `W`; the
pivots are the roots in `S` whose trees have `≥ k` vertices — those are the only frontier
vertices worth recursing on. Everything else is either already complete (in `W`) or hangs off
a pivot.

**Cost:** `O(k·|W|) = O(min{k²·|S|, k·|U'|})`.
**Implements issue:** #44 (FindPivots).

---

## Algorithm 3 — `BMSSP(l, B, S)`  → the main recursion

**Preconditions:** `|S| ≤ 2^(l·t)`; every incomplete `x` with `d(x) < B` has a shortest path
through some complete `y ∈ S`.
**Returns:** boundary `B' ≤ B` and set `U` containing every vertex `v` with `d(v) < B'`
reachable through `S`; on return all of `U` is complete.

```
function BMSSP(l, B, S):
    if l == 0:
        return BaseCase(B, S)                       # ← Algorithm 2

    P, W ← FindPivots(B, S)                          # ← Algorithm 1
    D ← new BlockList(M = 2^((l-1)·t), B)            # ← Lemma 3.3 structure
    for x in P: D.Insert(⟨x, d̂[x]⟩)

    i   ← 0
    B0' ← min_{x ∈ P} d̂[x]        (if P == ∅, set B0' ← B)
    U   ← ∅

    while |U| < k·2^(l·t) and D is non-empty:
        i ← i + 1
        Bi, Si ← D.Pull()                            # next small batch + separating bound
        Bi', Ui ← BMSSP(l - 1, Bi, Si)               # recurse one level down
        U ← U ∪ Ui

        K ← ∅
        for each edge (u, v) with u ∈ Ui:            # relax out of the newly-completed Ui
            if d̂[u] + w(u,v) ≤ d̂[v]:
                d̂[v] ← d̂[u] + w(u,v)
                if   d̂[u] + w(u,v) ∈ [Bi, B):  D.Insert(⟨v, d̂[u] + w(u,v)⟩)
                elif d̂[u] + w(u,v) ∈ [Bi', Bi): K ← K ∪ {⟨v, d̂[u] + w(u,v)⟩}

        # add back the just-processed Si vertices that still fall in [Bi', Bi):
        D.BatchPrepend( K ∪ { ⟨x, d̂[x]⟩ : x ∈ Si and d̂[x] ∈ [Bi', Bi) } )

    return B' ← min(Bi', B),  U ← U ∪ { x ∈ W : d̂[x] < B' }
```

Two outcomes (Lemma 3.1):
- **Successful execution:** `D` emptied before the workload cap → `B' = B`, `U` = full `U'`.
- **Partial execution (large workload):** the `|U| < k·2^(l·t)` guard tripped → `B' < B`,
  `|U| = Θ(k·2^(l·t))`, and only vertices with `d < B'` are returned.

**Plain English, step by step:**
1. Level 0 is the base case; otherwise proceed.
2. `FindPivots` shrinks `S` to pivots `P` (and completes a batch `W`).
3. Seed the block-list `D` with the pivots keyed by their current distance.
4. Repeatedly **Pull** the closest small batch `Si` (with a separating bound `Bi`) and
   **recurse** at level `l-1` on it. The recursion returns completed vertices `Ui`.
5. Relax edges out of `Ui`. Newly-improved neighbors go back into `D` (`Insert`) if they land
   in `[Bi, B)`, or get staged into `K` for a **BatchPrepend** if they land below `Bi` in
   `[Bi', Bi)` (they're closer than the current batch and must be reconsidered first).
6. Stop when `D` empties (success) or `U` grows past `k·2^(l·t)` (partial). Finally fold in
   the `W` vertices already completed by `FindPivots` that are below `B'`.

**Implements issue:** #43 (main algorithm). Depends on #40, #42, #44.

---

## Correctness invariant to preserve

In any `BMSSP(l, B, S)` call, let `U'` = all `v` with `d(v) < B` whose shortest path visits
`S`. A **successful** call returns `U = U'`; a **partial** call returns
`U = { u ∈ U' : d(u) < B' }`. **Every returned vertex is complete.** The test suite enforces
the end-to-end version of this: full-graph BMSSP distances must equal the Dijkstra oracle's.
