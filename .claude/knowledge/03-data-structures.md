# 03 — Data Structures

Two structures are needed. The **binary heap** is the easy one (base case). The **Lemma 3.3
block-based list `D`** is the heart of the algorithm and the trickiest piece to get right.

---

## A. Binary min-heap (for the base case) — issue #41

A standard array-backed binary min-heap keyed by distance, supporting:

- `Insert(⟨v, d⟩)`
- `ExtractMin()` → the `⟨v, d⟩` with smallest `d`
- `DecreaseKey(⟨v, d⟩)` → lower the key of an existing entry
- membership test ("is `v` in `H`?")

The repo's `src/dijkstra.mjs` already contains a lightweight inline array-heap
(`heapPush`/`heapPop`) you can learn the style from — but note it does **not** implement
`DecreaseKey`; instead it pushes duplicates and skips stale pops (`if (d > dist.get(u))
continue`). The base case can use either approach:
- **Lazy-deletion heap** (simpler): push duplicates, skip outdated entries on pop. No real
  `DecreaseKey` needed; needs a `d̂` map to detect staleness. Matches the existing Dijkstra.
- **True indexed heap** (matches the paper literally): maintain a `pos` map from vertex →
  heap index so `DecreaseKey` is O(log n). More code, exact to Algorithm 2.

Either is correct for BMSSP; the lazy version is the smaller change and is consistent with
the existing code.

---

## B. Lemma 3.3 — the block-based "partial-sort" structure `D` — issue #42

### What it is for

`D` holds `⟨key, value⟩` pairs (vertex, distance). It does **not** keep them fully sorted;
it keeps them in **value-ordered blocks** so that:
- you can cheaply `Pull` the `M` smallest values as a batch, and
- you can cheaply prepend a batch of values known to be smaller than everything already in
  it (`BatchPrepend`).

This is what lets BMSSP avoid the Θ(log n)-per-vertex cost of a fully-sorted heap.

### Parameters

- `N` — an upper bound on the number of inserts.
- `M` — block size / pull size. At recursion level `l`, `M = 2^((l-1)·t)`.
- `B` — a global upper bound on all values.

### Internal layout

Two sequences of blocks:
- **`D1`** — holds elements from **Insert**. Number of blocks is `O(max{1, N/M})`. Each
  block holds ≤ `M` pairs. Blocks are kept in sorted order **between** blocks (block `i`'s
  values ≤ block `j`'s values for `i < j`), but **not sorted within** a block.
- **`D0`** — holds elements from **BatchPrepend** only. Same "sorted between blocks, unsorted
  within" property; no cap on the number of blocks.

Each `D1` block carries an **upper bound** on its elements; consecutive blocks' bounds are
monotonic. These bounds live in a **self-balancing BST (e.g. red-black tree)** so you can
binary-search the right block for an insert in `O(max{1, log(N/M)})`. A `key → (block, value)`
lookup map lets you find/replace an existing key.

> **Implementation shortcut:** a balanced-BST-of-bounds is the asymptotically-correct choice,
> but for a first correct JS implementation you can back the block index with a plain sorted
> array of block-bounds and binary-search it (`O(log #blocks)` per op, `O(#blocks)` on
> split). Same behavior, worse constants — fine for `bmssp-js`'s correctness-first goal.
> Leave a TODO to swap in a real balanced tree later.

### Operations (contracts + costs)

**`Initialize(M, B)`** — `D0` empty; `D1` = one empty block with upper bound `B`. Store `M`.

**`Insert(⟨key, value⟩)`** — amortized `O(max{1, log(N/M)})`.
- If `key` already present with value `v'`, only replace when `value < v'` (delete old, insert
  new). Keep the smallest value per key.
- Locate the target `D1` block = the one with the **smallest upper bound ≥ value** (binary
  search the bounds). Append to that block's linked list in O(1).
- If the block now exceeds `M` elements → **Split**.

**`Split`** — when a `D1` block exceeds `M`:
- Find the **median** value (linear-time selection, O(M)), partition into two blocks of
  ≤ ⌈M/2⌉: smaller-than-median in the first, rest in the second. Preserves inter-block order.
- Update the bounds structure. Keeps `#blocks(D1) = O(N/M)`.

**`Delete(a, b)`** — remove `⟨a,b⟩` from its linked list in O(1). If a `D1` block becomes
empty, drop its bound from the BST. (Deletion cost amortizes into insertion cost.)

**`BatchPrepend(L)`** — insert `L` pairs, **each value smaller than every value currently in
`D`**; amortized `O(|L|·max{1, log(|L|/M)})`.
- If `|L| ≤ M`: make one new block from `L` and put it at the **front of `D0`**.
- Else: split `L` into `O(|L|/M)` new blocks of ≤ ⌈M/2⌉ each (by repeated median-finding) and
  put them at the front of `D0`.
- On duplicate keys, keep the smallest value.

**`Pull()`** → `(S', x)` — return the ≤ `M` smallest-valued keys `S'` and a separating bound
`x`; amortized `O(|S'|)`.
- Collect a prefix of blocks from `D0` and from `D1` separately until each side has gathered
  all its elements or reached `M` elements. Call these `S0'`, `S1'`.
- If `S0' ∪ S1'` has ≤ `M` elements total, that's everything in `D`: return it all as `S'`
  and set `x ← B`.
- Otherwise, select the `M` smallest from `S0' ∪ S1'` (O(M)) as `S'`, **delete them** from
  `D0`/`D1`, and set `x` = the smallest remaining value in `D` (so `max(S') < x ≤ min(remaining)`).

### The `[Bi', Bi)` staging in Algorithm 3

`Pull` returns batch `Si` with separator `Bi`. After recursing, newly-relaxed neighbors are
routed by distance:
- value in `[Bi, B)` → normal `Insert` back into `D`;
- value in `[Bi', Bi)` → collect into `K`, then `BatchPrepend` (they're **closer** than the
  current batch's floor and must be seen before anything else).
`Si` members that slipped below into `[Bi', Bi)` are batch-prepended back too.

`Bi'` here is the boundary returned by the level-`(l-1)` recursive call; `B0' = min_{x∈P} d̂[x]`
initially (or `B` if `P` is empty).

### Minimal test ideas for `D`

- Insert random `⟨key,val⟩`, then repeatedly `Pull(M)`; concatenated pulls must come out in
  non-decreasing value order across batches (within a batch, order is unspecified).
- `BatchPrepend` values all below current min, then `Pull` returns them first.
- Duplicate key keeps the smallest value.
- Separator `x` always satisfies `max(S') < x ≤ min(remaining)`.
