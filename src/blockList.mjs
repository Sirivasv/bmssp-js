import { BoundIndex } from "./boundIndex.mjs";
import { partitionByRank } from "./select.mjs";

/**
 * Block-based "partial-sort" structure D from Lemma 3.3 of the BMSSP paper
 * ("Breaking the Sorting Barrier for Directed Single-Source Shortest Paths").
 *
 * Holds <key, value> pairs (vertex, distance estimate) semi-sorted: values
 * are ordered BETWEEN blocks but unsorted WITHIN a block. That is enough to
 * repeatedly pull the M smallest values as a batch (pull) and to cheaply
 * add a batch of values known to be smaller than everything present
 * (batchPrepend) — without paying for a full sort.
 *
 * Internal layout:
 * - d1: blocks filled by insert(). Each block carries an upper bound on its
 *   values; bounds are non-decreasing across blocks, and the last block
 *   always has bound B so every value < B has a home. The sequence lives in
 *   a self-balancing BST (BoundIndex) searched through the monotone bounds.
 * - d0: blocks filled by batchPrepend() only, kept as a doubly-linked list;
 *   they conceptually sit in front of d1 (their values are smaller than
 *   everything inserted so far).
 *
 * Since #167 the structure meets Lemma 3.3's exact bounds: the bound index
 * is a balanced BST (O(log #blocks) search/split/drop instead of O(#blocks)
 * array splices) and splits/chunking/pulls use deterministic linear-time
 * selection (partitionByRank) instead of an O(M log M) sort.
 */
class BlockList {
  /**
   * Initialize the structure (Lemma 3.3 Initialize).
   * @param {number} M - Block size / pull batch size, >= 1. At recursion level l this is 2^((l-1)·t).
   * @param {*} B - Strict upper bound on every value ever stored (Infinity is allowed)
   * @param {(a: *, b: *) => number} [compare] - Value comparator (negative
   *   when a < b). Defaults to numeric order; #163 passes composite
   *   [length, hops, id] keys with their lexicographic comparator.
   * @throws {Error} If M is not a number >= 1
   */
  constructor(M, B, compare) {
    if (typeof M !== "number" || Number.isNaN(M) || M < 1) {
      throw new Error("M must be a number >= 1");
    }
    this.M = Math.floor(M);
    this.B = B;
    this.compare = compare ?? ((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    // d1 starts as a single empty block with upper bound B; that block is
    // kept as the sequence's last forever so every value < B has a home
    this.d1 = new BoundIndex();
    this.lastD1Block = this.makeBlock(this.B);
    this.lastD1Block.node = this.d1.append(this.lastD1Block);
    // d0 is a doubly-linked list of blocks; the head holds the smallest values
    this.d0Head = null;
    // key -> block currently holding that key, for O(1) duplicate handling
    this.locator = new Map();
    this.count = 0;
  }

  // Internal: create an empty block with the given value upper bound.
  // node is the handle in the d1 BoundIndex (null for d0 blocks);
  // prev/next thread the d0 linked list (null for d1 blocks).
  makeBlock(bound) {
    return { bound, entries: new Map(), node: null, prev: null, next: null };
  }

  // Number of pairs currently stored
  get size() {
    return this.count;
  }

  isEmpty() {
    return this.count === 0;
  }

  /**
   * Insert a pair (Lemma 3.3 Insert). If the key is already stored, the
   * smallest value wins (the pair is replaced only when value is smaller).
   * @param {*} key - Typically a node ID
   * @param {number} value - Must be < B
   * @throws {Error} If value >= B
   */
  insert(key, value) {
    if (!(this.compare(value, this.B) < 0)) {
      throw new Error("value must be < B");
    }
    const holder = this.locator.get(key);
    if (holder !== undefined) {
      if (this.compare(holder.entries.get(key), value) <= 0) return;
      this.removeKey(key, holder);
    }
    // First d1 block whose bound covers the value: bounds are monotone along
    // the sequence, so this predicate search is the paper's O(log #blocks)
    // BST lookup. It always succeeds — the last block's bound is B > value.
    const node = this.d1.findFirst(
      (candidate) => this.compare(candidate.bound, value) >= 0,
    );
    const block = node.item;
    block.entries.set(key, value);
    this.locator.set(key, block);
    this.count += 1;
    if (block.entries.size > this.M) {
      this.splitBlock(block);
    }
  }

  // Internal: split an overfull d1 block into two halves around its median
  // value (deterministic linear-time selection, as Lemma 3.3 prescribes).
  // The lower half gets bound = the median (its own max value); the upper
  // half keeps the original bound, so inter-block ordering is preserved.
  splitBlock(block) {
    const pairs = [...block.entries];
    const half = pairs.length >> 1;
    partitionByRank(pairs, half - 1, (a, b) => this.compare(a[1], b[1]));
    const lower = this.makeBlock(pairs[half - 1][1]);
    for (let i = 0; i < half; i += 1) {
      const [key, value] = pairs[i];
      block.entries.delete(key);
      lower.entries.set(key, value);
      this.locator.set(key, lower);
    }
    lower.node = this.d1.insertBefore(block.node, lower);
  }

  /**
   * Insert a batch of pairs whose values are all smaller than every value
   * currently stored (Lemma 3.3 BatchPrepend). On duplicate keys — within
   * the batch or against the current contents — the smallest value wins.
   * The caller is responsible for the "smaller than everything" contract;
   * only the value < B bound is checked here.
   * @param {Iterable<[*, number]>} pairs - [key, value] pairs, each value < B
   * @throws {Error} If any value >= B
   */
  batchPrepend(pairs) {
    // Dedupe the batch, keeping the smallest value per key
    const best = new Map();
    for (const [key, value] of pairs) {
      if (!(this.compare(value, this.B) < 0)) {
        throw new Error("value must be < B");
      }
      const seen = best.get(key);
      if (seen === undefined || this.compare(value, seen) < 0) {
        best.set(key, value);
      }
    }
    // Resolve clashes with keys already stored (smallest value wins)
    const fresh = [];
    for (const [key, value] of best) {
      const holder = this.locator.get(key);
      if (holder !== undefined) {
        if (this.compare(holder.entries.get(key), value) <= 0) continue;
        this.removeKey(key, holder);
      }
      fresh.push([key, value]);
    }
    if (fresh.length === 0) return;
    // One block if the batch fits; otherwise recursive median splitting into
    // value-ordered chunks of <= ceil(M/2) — O(|L|/M) blocks built with
    // O(|L|·max{1, log(|L|/M)}) comparisons, the Lemma 3.3 bound
    let chunks;
    if (fresh.length <= this.M) {
      chunks = [fresh];
    } else {
      chunks = [];
      this.chunkByMedian(fresh, Math.ceil(this.M / 2), chunks);
    }
    // Materialize the chunks as blocks (ascending order)...
    const blocks = [];
    for (const chunk of chunks) {
      // Seed the block bound with the first value, then max-update — avoids
      // needing a -Infinity sentinel that a custom comparator can't order
      const block = this.makeBlock(chunk[0][1]);
      for (const [key, value] of chunk) {
        block.entries.set(key, value);
        this.locator.set(key, block);
        if (this.compare(value, block.bound) > 0) block.bound = value;
        this.count += 1;
      }
      blocks.push(block);
    }
    // ...and link them in front of d0, smallest chunk becoming the new head
    let head = this.d0Head;
    for (let i = blocks.length - 1; i >= 0; i -= 1) {
      const block = blocks[i];
      block.next = head;
      if (head !== null) head.prev = block;
      head = block;
    }
    this.d0Head = head;
  }

  // Internal: recursively median-split pairs (in place / via slices) into
  // value-ordered chunks of at most maxSize, appended to out ascending
  chunkByMedian(pairs, maxSize, out) {
    if (pairs.length <= maxSize) {
      out.push(pairs);
      return;
    }
    const half = pairs.length >> 1;
    partitionByRank(pairs, half - 1, (a, b) => this.compare(a[1], b[1]));
    this.chunkByMedian(pairs.slice(0, half), maxSize, out);
    this.chunkByMedian(pairs.slice(half), maxSize, out);
  }

  /**
   * Remove and return the (at most) M smallest-valued keys plus a separating
   * bound (Lemma 3.3 Pull). In Algorithm 3 this is `Bi, Si <- D.Pull()`:
   * `keys` is Si and `bound` is Bi, satisfying
   * max(pulled values) <= bound <= min(remaining values).
   * When the pull drains the structure the bound is B.
   * @returns {{ keys: Set<*>, bound: number }}
   */
  pull() {
    if (this.count <= this.M) {
      // Everything fits in one batch: drain the structure and reset it
      const keys = new Set(this.locator.keys());
      this.d0Head = null;
      this.d1.clear();
      this.lastD1Block = this.makeBlock(this.B);
      this.lastD1Block.node = this.d1.append(this.lastD1Block);
      this.locator.clear();
      this.count = 0;
      return { keys, bound: this.B };
    }
    // Collect prefix blocks from each sequence until that side holds >= M
    // candidate elements (or runs out). The M smallest overall are in there.
    const candidates = [];
    let collected = 0;
    for (
      let block = this.d0Head;
      block !== null && collected < this.M;
      block = block.next
    ) {
      for (const [key, value] of block.entries) {
        candidates.push([key, value, block]);
      }
      collected += block.entries.size;
    }
    collected = 0;
    for (
      let node = this.d1.first();
      node !== null && collected < this.M;
      node = this.d1.next(node)
    ) {
      for (const [key, value] of node.item.entries) {
        candidates.push([key, value, node.item]);
      }
      collected += node.item.entries.size;
    }
    // Move the M smallest candidates to the front (linear-time selection,
    // the Lemma 3.3 O(M) pull) and take them out of the structure
    partitionByRank(candidates, this.M - 1, (a, b) => this.compare(a[1], b[1]));
    const keys = new Set();
    for (let i = 0; i < this.M; i += 1) {
      const [key, , block] = candidates[i];
      keys.add(key);
      this.removeKey(key, block);
    }
    // Separator = smallest value still stored (non-null here: this branch
    // only runs when more than M values were present). Thanks to the
    // inter-block ordering it lives in the first non-empty block of d0/d1.
    // Under a strict total order (#163's composite keys) this separator is
    // strictly above every pulled value — no boundary ties.
    let bound = null;
    for (let block = this.d0Head; block !== null; block = block.next) {
      if (block.entries.size > 0) {
        for (const value of block.entries.values()) {
          if (bound === null || this.compare(value, bound) < 0) bound = value;
        }
        break;
      }
    }
    for (let node = this.d1.first(); node !== null; node = this.d1.next(node)) {
      if (node.item.entries.size > 0) {
        for (const value of node.item.entries.values()) {
          if (bound === null || this.compare(value, bound) < 0) bound = value;
        }
        break;
      }
    }
    return { keys, bound };
  }

  // Internal: remove a key from the block that holds it, dropping the block
  // if it becomes empty (deletion cost amortizes into insertion, Lemma 3.3)
  removeKey(key, block) {
    block.entries.delete(key);
    this.locator.delete(key);
    this.count -= 1;
    if (block.entries.size === 0) {
      this.dropIfEmpty(block);
    }
  }

  // Internal: physically remove an emptied block from its sequence — an
  // O(log #blocks) BST removal for d1, an O(1) unlink for d0. The last d1
  // block (bound B) is kept even when empty so insert always finds a home.
  dropIfEmpty(block) {
    if (block.node !== null) {
      if (block === this.lastD1Block) return;
      this.d1.remove(block.node);
      return;
    }
    if (block.prev !== null) block.prev.next = block.next;
    else this.d0Head = block.next;
    if (block.next !== null) block.next.prev = block.prev;
  }
}

export { BlockList };
