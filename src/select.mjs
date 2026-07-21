/**
 * Deterministic worst-case-linear selection — the "linear-time median
 * selection" Lemma 3.3 prescribes for BlockList block splits, batch
 * chunking and pulls (issue #167; replaces the sort-based O(M log M)
 * shortcut).
 *
 * Quickselect with a median-of-medians pivot (groups of 5): the pivot is
 * guaranteed to land in the middle 40% of the range, so every round discards
 * a constant fraction and the whole selection is O(n) comparisons in the
 * worst case — with no randomness, so runs stay fully reproducible.
 */

// Internal: swap two array slots
function swap(items, i, j) {
  const tmp = items[i];
  items[i] = items[j];
  items[j] = tmp;
}

// Internal: insertion-sort the closed range [lo, hi] (only ever called on
// groups of at most 5 elements)
function sortRange(items, lo, hi, compare) {
  for (let i = lo + 1; i <= hi; i += 1) {
    const item = items[i];
    let j = i - 1;
    while (j >= lo && compare(items[j], item) > 0) {
      items[j + 1] = items[j];
      j -= 1;
    }
    items[j + 1] = item;
  }
}

// Internal: median-of-medians pivot for the closed range [lo, hi]. Sorts
// each group of 5, gathers the group medians at the front of the range, and
// recursively selects their median.
function pivotOf(items, lo, hi, compare) {
  if (hi - lo < 5) {
    sortRange(items, lo, hi, compare);
    return items[lo + ((hi - lo) >> 1)];
  }
  let write = lo;
  for (let i = lo; i <= hi; i += 5) {
    const groupHi = Math.min(i + 4, hi);
    sortRange(items, i, groupHi, compare);
    swap(items, write, i + ((groupHi - i) >> 1));
    write += 1;
  }
  const mid = lo + ((write - 1 - lo) >> 1);
  selectRange(items, mid, compare, lo, write - 1);
  return items[mid];
}

// Internal: quickselect on the closed range [lo, hi]. Elements outside the
// active range are already on their correct side, so when the range narrows
// to the rank (or the rank falls inside the pivot-equal band) the whole
// prefix [0..rank] holds the rank+1 smallest.
function selectRange(items, rank, compare, lo, hi) {
  while (lo < hi) {
    const pivot = pivotOf(items, lo, hi, compare);
    // Three-way partition: [lo, lt) < pivot, [lt, gt] == pivot, (gt, hi] >
    // pivot. The equal band makes duplicate-heavy inputs terminate in one
    // round instead of degrading.
    let lt = lo;
    let i = lo;
    let gt = hi;
    while (i <= gt) {
      const order = compare(items[i], pivot);
      if (order < 0) {
        swap(items, lt, i);
        lt += 1;
        i += 1;
      } else if (order > 0) {
        swap(items, i, gt);
        gt -= 1;
      } else {
        i += 1;
      }
    }
    if (rank < lt) {
      hi = lt - 1;
    } else if (rank > gt) {
      lo = gt + 1;
    } else {
      return;
    }
  }
}

/**
 * Partially reorder items IN PLACE so that items[0..rank] are the rank+1
 * smallest under compare and items[rank] is the largest of them (i.e. the
 * rank-th smallest overall, 0-indexed). Order within the two sides is
 * unspecified — exactly what a semi-sorted block structure needs.
 * @param {Array<*>} items - Reordered in place
 * @param {number} rank - 0-indexed target rank, 0 <= rank < items.length
 * @param {(a: *, b: *) => number} [compare] - Comparator (negative when
 *   a < b). Defaults to numeric order.
 * @returns {*} items[rank], the rank-th smallest element
 * @throws {Error} If items is not a non-empty array or rank is out of range
 */
function partitionByRank(items, rank, compare) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("items must be a non-empty array");
  }
  if (!Number.isInteger(rank) || rank < 0 || rank >= items.length) {
    throw new Error("rank must be an integer index into items");
  }
  const order = compare ?? ((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  selectRange(items, rank, order, 0, items.length - 1);
  return items[rank];
}

export { partitionByRank };
