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
 *   always has bound B so every value < B has a home.
 * - d0: blocks filled by batchPrepend() only; they conceptually sit in front
 *   of d1 (their values are smaller than everything inserted so far).
 *
 * The block-bound index is a plain array searched with binary search instead
 * of the paper's balanced BST — same behavior, worse constants (issue #167).
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
    // d1 starts as a single empty block with upper bound B
    this.d1 = [this.makeBlock(B)];
    this.d0 = [];
    // key -> block currently holding that key, for O(1) duplicate handling
    this.locator = new Map();
    this.count = 0;
  }

  // Internal: create an empty block with the given value upper bound
  makeBlock(bound) {
    return { bound, entries: new Map() };
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
    // Binary-search d1 for the first block whose bound covers the value
    let lo = 0;
    let hi = this.d1.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.compare(this.d1[mid].bound, value) >= 0) {
        hi = mid;
      } else {
        lo = mid + 1;
      }
    }
    const block = this.d1[lo];
    block.entries.set(key, value);
    this.locator.set(key, block);
    this.count += 1;
    if (block.entries.size > this.M) {
      this.splitBlock(lo);
    }
  }

  // Internal: split an overfull d1 block into two halves around its median
  // value. The lower half gets bound = its own max value; the upper half
  // keeps the original bound, so inter-block ordering is preserved.
  // (The paper uses linear-time median selection; sorting is O(M log M) but
  // simpler — acceptable for this correctness-first implementation.)
  splitBlock(index) {
    const block = this.d1[index];
    const sorted = [...block.entries].sort((a, b) => this.compare(a[1], b[1]));
    const half = sorted.length >> 1;
    const lower = this.makeBlock(sorted[half - 1][1]);
    for (let i = 0; i < half; i += 1) {
      const [key, value] = sorted[i];
      block.entries.delete(key);
      lower.entries.set(key, value);
      this.locator.set(key, lower);
    }
    this.d1.splice(index, 0, lower);
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
    // One block if the batch fits, otherwise sorted chunks of <= ceil(M/2)
    let chunks;
    if (fresh.length <= this.M) {
      chunks = [fresh];
    } else {
      fresh.sort((a, b) => this.compare(a[1], b[1]));
      const chunkSize = Math.ceil(this.M / 2);
      chunks = [];
      for (let i = 0; i < fresh.length; i += chunkSize) {
        chunks.push(fresh.slice(i, i + chunkSize));
      }
    }
    // Prepend in reverse chunk order so the smallest chunk lands at the front
    for (let c = chunks.length - 1; c >= 0; c -= 1) {
      const chunk = chunks[c];
      // Seed the block bound with the first value, then max-update — avoids
      // needing a -Infinity sentinel that a custom comparator can't order
      const block = this.makeBlock(chunk[0][1]);
      for (const [key, value] of chunk) {
        block.entries.set(key, value);
        this.locator.set(key, block);
        if (this.compare(value, block.bound) > 0) block.bound = value;
        this.count += 1;
      }
      this.d0.unshift(block);
    }
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
      this.d0 = [];
      this.d1 = [this.makeBlock(this.B)];
      this.locator.clear();
      this.count = 0;
      return { keys, bound: this.B };
    }
    // Collect prefix blocks from each sequence until that side holds >= M
    // candidate elements (or runs out). The M smallest overall are in there.
    const candidates = [];
    for (const seq of [this.d0, this.d1]) {
      let collected = 0;
      for (const block of seq) {
        if (collected >= this.M) break;
        for (const [key, value] of block.entries) {
          candidates.push([key, value, block]);
        }
        collected += block.entries.size;
      }
    }
    // Take the M smallest candidates out of the structure
    candidates.sort((a, b) => this.compare(a[1], b[1]));
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
    for (const seq of [this.d0, this.d1]) {
      const block = seq.find((b) => b.entries.size > 0);
      if (block) {
        for (const value of block.entries.values()) {
          if (bound === null || this.compare(value, bound) < 0) bound = value;
        }
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

  // Internal: physically remove an emptied block. The last d1 block (bound B)
  // is kept even when empty so insert always finds a home for any value < B.
  dropIfEmpty(block) {
    const i0 = this.d0.indexOf(block);
    if (i0 !== -1) {
      this.d0.splice(i0, 1);
      return;
    }
    const i1 = this.d1.indexOf(block);
    if (i1 !== -1 && i1 < this.d1.length - 1) {
      this.d1.splice(i1, 1);
    }
  }
}

export { BlockList };
