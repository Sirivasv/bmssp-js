/**
 * Array-backed indexed binary min-heap for the BMSSP base case (Algorithm 2
 * of "Breaking the Sorting Barrier for Directed Single-Source Shortest
 * Paths"). Holds <key, value> pairs (vertex, distance estimate) ordered by
 * value and supports exactly the operations BaseCase(B, S) needs:
 *
 *   insert(key, value)      — add a key not currently stored
 *   extractMin()            — remove and return the smallest-valued pair
 *   decreaseKey(key, value) — lower the value of a stored key
 *   has(key)                — membership test ("is v in H?")
 *
 * A position map (key -> array index) makes decreaseKey and has O(log n) /
 * O(1), matching the paper's heap literally instead of the lazy
 * duplicate-and-skip variant used inside src/dijkstra.mjs.
 */
class MinHeap {
  /**
   * @param {(a: *, b: *) => number} [compare] - Value comparator (negative
   *   when a < b). Defaults to numeric order, in which case values must be
   *   numbers; with a custom comparator values are opaque (#163 passes
   *   composite [length, hops, id] keys).
   */
  constructor(compare) {
    // entries[i] = [key, value], heap-ordered by value
    this.entries = [];
    // key -> index of that key in entries, for O(1) membership / lookup
    this.position = new Map();
    this.numericValues = compare === undefined;
    this.compare = compare ?? ((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  // Internal: reject non-number values, but only in default numeric mode
  checkValue(value) {
    if (
      this.numericValues &&
      (typeof value !== "number" || Number.isNaN(value))
    ) {
      throw new Error("value must be a number");
    }
  }

  // Number of pairs currently stored
  get size() {
    return this.entries.length;
  }

  isEmpty() {
    return this.entries.length === 0;
  }

  has(key) {
    return this.position.has(key);
  }

  /**
   * Current value of a stored key, or undefined if the key is not present.
   * @param {*} key - Typically a node ID
   * @returns {number|undefined}
   */
  getValue(key) {
    const index = this.position.get(key);
    return index === undefined ? undefined : this.entries[index][1];
  }

  /**
   * Smallest-valued pair without removing it.
   * @returns {{ key: *, value: number }}
   * @throws {Error} If the heap is empty
   */
  peekMin() {
    if (this.entries.length === 0) {
      throw new Error("heap is empty");
    }
    const [key, value] = this.entries[0];
    return { key, value };
  }

  /**
   * Add a pair for a key that is not currently stored (Algorithm 2 Insert).
   * A key that was extracted earlier may be inserted again.
   * @param {*} key - Typically a node ID
   * @param {number} value - Priority; smaller comes out first
   * @throws {Error} If the key is already stored, or value is not a number
   */
  insert(key, value) {
    this.checkValue(value);
    if (this.position.has(key)) {
      throw new Error("key already in heap — use decreaseKey");
    }
    this.entries.push([key, value]);
    this.position.set(key, this.entries.length - 1);
    this.siftUp(this.entries.length - 1);
  }

  /**
   * Lower the value of a stored key (Algorithm 2 DecreaseKey). A value that
   * would not decrease the stored one is ignored — the smallest value wins,
   * mirroring the `<=` edge relaxation which re-relaxes with equal sums.
   * @param {*} key - Must be currently stored
   * @param {number} value - New priority; applied only when smaller
   * @throws {Error} If the key is not stored, or value is not a number
   */
  decreaseKey(key, value) {
    this.checkValue(value);
    const index = this.position.get(key);
    if (index === undefined) {
      throw new Error("key not in heap — use insert");
    }
    if (this.compare(this.entries[index][1], value) <= 0) return;
    this.entries[index][1] = value;
    this.siftUp(index);
  }

  /**
   * Remove and return the smallest-valued pair (Algorithm 2 ExtractMin).
   * @returns {{ key: *, value: number }}
   * @throws {Error} If the heap is empty
   */
  extractMin() {
    if (this.entries.length === 0) {
      throw new Error("heap is empty");
    }
    const [key, value] = this.entries[0];
    this.position.delete(key);
    const last = this.entries.pop();
    if (this.entries.length > 0) {
      this.entries[0] = last;
      this.position.set(last[0], 0);
      this.siftDown(0);
    }
    return { key, value };
  }

  // Internal: swap two entries and keep the position map in sync
  swap(i, j) {
    const a = this.entries[i];
    const b = this.entries[j];
    this.entries[i] = b;
    this.entries[j] = a;
    this.position.set(b[0], i);
    this.position.set(a[0], j);
  }

  // Internal: move the entry at index up until its parent is not larger
  siftUp(index) {
    let i = index;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(this.entries[parent][1], this.entries[i][1]) <= 0) break;
      this.swap(parent, i);
      i = parent;
    }
  }

  // Internal: move the entry at index down until no child is smaller
  siftDown(index) {
    let i = index;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = i;
      if (
        left < this.entries.length &&
        this.compare(this.entries[left][1], this.entries[smallest][1]) < 0
      ) {
        smallest = left;
      }
      if (
        right < this.entries.length &&
        this.compare(this.entries[right][1], this.entries[smallest][1]) < 0
      ) {
        smallest = right;
      }
      if (smallest === i) break;
      this.swap(smallest, i);
      i = smallest;
    }
  }
}

export { MinHeap };
