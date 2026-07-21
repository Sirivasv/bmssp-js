import { describe, test, expect } from "@jest/globals";
import { partitionByRank } from "../src/select.mjs";

// Small deterministic PRNG so stress-test failures are reproducible
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Assert the partitionByRank contract on a numeric array: items[rank] is the
// rank-th smallest, everything before it is <= it, everything after is >= it,
// and the array is a permutation of the original
function expectPartitioned(items, rank, original) {
  const sorted = [...original].sort((a, b) => a - b);
  expect(items[rank]).toBe(sorted[rank]);
  for (let i = 0; i < rank; i += 1) {
    expect(items[i]).toBeLessThanOrEqual(items[rank]);
  }
  for (let i = rank + 1; i < items.length; i += 1) {
    expect(items[i]).toBeGreaterThanOrEqual(items[rank]);
  }
  expect([...items].sort((a, b) => a - b)).toEqual(sorted);
}

describe("partitionByRank validation", () => {
  test("rejects non-arrays and empty arrays", () => {
    expect(() => partitionByRank("nope", 0)).toThrow(
      "items must be a non-empty array",
    );
    expect(() => partitionByRank([], 0)).toThrow(
      "items must be a non-empty array",
    );
  });

  test("rejects out-of-range or non-integer ranks", () => {
    expect(() => partitionByRank([3, 1, 2], -1)).toThrow(
      "rank must be an integer index into items",
    );
    expect(() => partitionByRank([3, 1, 2], 3)).toThrow(
      "rank must be an integer index into items",
    );
    expect(() => partitionByRank([3, 1, 2], 1.5)).toThrow(
      "rank must be an integer index into items",
    );
  });
});

describe("partitionByRank selection contract", () => {
  test("selects every rank of a small shuffled array (default comparator)", () => {
    const original = [7, 3, 9, 1, 5, 8, 2, 6, 4, 0];
    for (let rank = 0; rank < original.length; rank += 1) {
      const items = [...original];
      const value = partitionByRank(items, rank);
      expect(value).toBe(rank);
      expectPartitioned(items, rank, original);
    }
  });

  test("handles sorted and reverse-sorted inputs at size 1000", () => {
    // Large enough to exercise the median-of-medians pivot recursion; these
    // orderings are the classic worst cases for naive quickselect
    const ascending = Array.from({ length: 1000 }, (_, i) => i);
    const descending = [...ascending].reverse();
    for (const original of [ascending, descending]) {
      for (const rank of [0, 1, 499, 500, 998, 999]) {
        const items = [...original];
        expect(partitionByRank(items, rank)).toBe(rank);
        expectPartitioned(items, rank, original);
      }
    }
  });

  test("handles duplicate-heavy and all-equal inputs", () => {
    const fewValues = Array.from({ length: 500 }, (_, i) => i % 3);
    for (const rank of [0, 166, 167, 333, 334, 499]) {
      const items = [...fewValues];
      partitionByRank(items, rank, (a, b) => a - b);
      expectPartitioned(items, rank, fewValues);
    }
    const allEqual = Array.from({ length: 100 }, () => 42);
    const items = [...allEqual];
    expect(partitionByRank(items, 57)).toBe(42);
    expectPartitioned(items, 57, allEqual);
  });

  test("single-element and tiny arrays", () => {
    expect(partitionByRank([5], 0)).toBe(5);
    const pair = [9, 4];
    expect(partitionByRank(pair, 0)).toBe(4);
    expect(pair).toEqual([4, 9]);
  });

  test("works with a custom comparator over structured items", () => {
    // [key, value] pairs ordered by value — how BlockList uses it
    const rand = mulberry32(167);
    const original = Array.from({ length: 200 }, (_, i) => [
      `k${i}`,
      Math.floor(rand() * 50),
    ]);
    const byValue = (a, b) => a[1] - b[1];
    const sortedValues = original.map((p) => p[1]).sort((a, b) => a - b);
    for (const rank of [0, 42, 99, 100, 199]) {
      const items = original.map((p) => [...p]);
      const picked = partitionByRank(items, rank, byValue);
      expect(picked[1]).toBe(sortedValues[rank]);
      for (let i = 0; i < rank; i += 1) {
        expect(items[i][1]).toBeLessThanOrEqual(picked[1]);
      }
      for (let i = rank + 1; i < items.length; i += 1) {
        expect(items[i][1]).toBeGreaterThanOrEqual(picked[1]);
      }
    }
  });

  test("seeded random stress across sizes and ranks", () => {
    const rand = mulberry32(4242);
    for (let round = 0; round < 200; round += 1) {
      const size = 1 + Math.floor(rand() * 120);
      const original = Array.from({ length: size }, () =>
        Math.floor(rand() * 40),
      );
      const rank = Math.floor(rand() * size);
      const items = [...original];
      partitionByRank(items, rank, (a, b) => a - b);
      expectPartitioned(items, rank, original);
    }
  });

  test("median-of-medians fallback (cheapBudget 0) selects every rank", () => {
    // Forcing the budget to 0 routes every pivot through median-of-medians —
    // the worst-case-linear fallback that ordinary inputs never reach
    const rand = mulberry32(7);
    for (let round = 0; round < 50; round += 1) {
      const size = 5 + Math.floor(rand() * 200);
      const original = Array.from({ length: size }, () =>
        Math.floor(rand() * 60),
      );
      const rank = Math.floor(rand() * size);
      const items = [...original];
      partitionByRank(items, rank, (a, b) => a - b, 0);
      expectPartitioned(items, rank, original);
    }
  });

  test("organ-pipe input stays correct at the default budget", () => {
    // Ascending-then-descending — a classically awkward shape for cheap
    // quickselect pivots; the budget guard keeps it linear either way
    const n = 1024;
    const original = Array.from({ length: n }, (_, i) =>
      i < n / 2 ? i : n - i,
    );
    for (const rank of [0, 255, 511, 512, 1023]) {
      const items = [...original];
      partitionByRank(items, rank, (a, b) => a - b);
      expectPartitioned(items, rank, original);
    }
  });

  test("is deterministic: identical inputs produce identical arrangements", () => {
    const rand = mulberry32(99);
    const original = Array.from({ length: 300 }, () => Math.floor(rand() * 25));
    const first = [...original];
    const second = [...original];
    partitionByRank(first, 150, (a, b) => a - b);
    partitionByRank(second, 150, (a, b) => a - b);
    expect(first).toEqual(second);
  });
});
