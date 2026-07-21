import { describe, test, expect } from "@jest/globals";
import { BlockList } from "../src/blockList.mjs";

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

// Drain the structure with repeated pulls, returning every batch with the
// separating bound reported alongside it
function drain(list) {
  const batches = [];
  while (!list.isEmpty()) {
    const { keys, bound } = list.pull();
    batches.push({ keys, bound });
  }
  return batches;
}

describe("BlockList initialization", () => {
  test("throws when M is not a number >= 1", () => {
    expect(() => new BlockList(0, 100)).toThrow("M must be a number >= 1");
    expect(() => new BlockList(NaN, 100)).toThrow("M must be a number >= 1");
    expect(() => new BlockList("4", 100)).toThrow("M must be a number >= 1");
  });

  test("starts empty", () => {
    const list = new BlockList(4, 100);
    expect(list.isEmpty()).toBe(true);
    expect(list.size).toBe(0);
  });

  test("pull on an empty structure returns no keys and bound B", () => {
    const list = new BlockList(4, 100);
    const { keys, bound } = list.pull();
    expect(keys.size).toBe(0);
    expect(bound).toBe(100);
  });
});

describe("BlockList insert + pull", () => {
  test("rejects values >= B", () => {
    const list = new BlockList(4, 100);
    expect(() => list.insert(1, 100)).toThrow("value must be < B");
    expect(() => list.insert(1, 250)).toThrow("value must be < B");
  });

  test("accepts any finite value when B is Infinity", () => {
    const list = new BlockList(2, Infinity);
    list.insert(1, 1e18);
    list.insert(2, 5);
    const { keys, bound } = list.pull();
    expect(keys).toEqual(new Set([1, 2]));
    expect(bound).toBe(Infinity);
  });

  test("a pull that drains the structure returns everything and bound B", () => {
    const list = new BlockList(4, 100);
    list.insert(10, 7);
    list.insert(11, 3);
    list.insert(12, 9);
    const { keys, bound } = list.pull();
    expect(keys).toEqual(new Set([10, 11, 12]));
    expect(bound).toBe(100);
    expect(list.isEmpty()).toBe(true);
  });

  test("pulls return the M smallest keys per batch, in batch-sorted order", () => {
    const M = 4;
    const list = new BlockList(M, 1000);
    // 23 pairs with distinct shuffled values: key i has value (i * 37) % 100
    const pairs = [];
    for (let i = 0; i < 23; i += 1) {
      pairs.push([i, (i * 37) % 100]);
    }
    for (const [key, value] of pairs) {
      list.insert(key, value);
    }
    const expected = [...pairs].sort((a, b) => a[1] - b[1]);
    const batches = drain(list);
    let offset = 0;
    for (const { keys } of batches) {
      const expectedKeys = new Set(
        expected.slice(offset, offset + keys.size).map(([key]) => key),
      );
      expect(keys).toEqual(expectedKeys);
      expect(keys.size).toBeLessThanOrEqual(M);
      offset += keys.size;
    }
    expect(offset).toBe(pairs.length);
  });

  test("separator satisfies max(pulled) < bound <= min(remaining)", () => {
    const list = new BlockList(3, 1000);
    const values = new Map();
    for (let i = 0; i < 17; i += 1) {
      const value = (i * 61) % 200; // distinct values
      values.set(i, value);
      list.insert(i, value);
    }
    while (!list.isEmpty()) {
      const before = list.size;
      const { keys, bound } = list.pull();
      const pulled = [...keys].map((k) => values.get(k));
      for (const k of keys) values.delete(k);
      if (values.size > 0) {
        expect(Math.max(...pulled)).toBeLessThan(bound);
        expect(bound).toBeLessThanOrEqual(Math.min(...values.values()));
      } else {
        expect(bound).toBe(1000);
      }
      expect(list.size).toBe(before - keys.size);
    }
  });

  test("duplicate key keeps the smallest value (either insert order)", () => {
    const list = new BlockList(1, 100);
    list.insert(7, 50);
    list.insert(7, 10); // smaller replaces
    list.insert(8, 20);
    list.insert(8, 60); // larger is ignored
    list.insert(9, 30);
    list.insert(9, 30); // equal keeps the existing pair
    expect(list.size).toBe(3);
    expect(drain(list).map(({ keys }) => keys)).toEqual([
      new Set([7]),
      new Set([8]),
      new Set([9]),
    ]);
  });

  test("splits keep pulls correct when many inserts land in one block", () => {
    const M = 2;
    const list = new BlockList(M, 100);
    const values = [9, 1, 8, 2, 7, 3, 6, 4, 5];
    values.forEach((value, key) => list.insert(key, value));
    const pulledValues = drain(list).flatMap(({ keys }) =>
      [...keys].map((key) => values[key]).sort((a, b) => a - b),
    );
    expect(pulledValues).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test("a pulled key can be inserted again", () => {
    const list = new BlockList(2, 100);
    list.insert(1, 10);
    list.insert(2, 20);
    list.pull();
    list.insert(1, 30);
    expect(list.pull().keys).toEqual(new Set([1]));
  });
});

describe("BlockList batchPrepend", () => {
  test("rejects values >= B", () => {
    const list = new BlockList(4, 100);
    expect(() => list.batchPrepend([[1, 100]])).toThrow("value must be < B");
  });

  test("prepended pairs come out before previously inserted ones", () => {
    const list = new BlockList(2, 1000);
    list.insert(1, 100);
    list.insert(2, 110);
    list.insert(3, 120);
    list.batchPrepend([
      ["a", 5],
      ["b", 7],
    ]);
    const { keys, bound } = list.pull();
    expect(keys).toEqual(new Set(["a", "b"]));
    expect(bound).toBeLessThanOrEqual(100);
  });

  test("a batch larger than M is chunked and still pulls in order", () => {
    const M = 4;
    const list = new BlockList(M, 1000);
    for (let i = 0; i < 5; i += 1) {
      list.insert(100 + i, 500 + i);
    }
    const prepended = [];
    for (let i = 0; i < 10; i += 1) {
      prepended.push([i, 10 + ((i * 7) % 10)]); // distinct values 10..19
    }
    list.batchPrepend(prepended);
    expect(list.size).toBe(15);
    const order = [];
    const valueOf = new Map([
      ...prepended,
      [100, 500],
      [101, 501],
      [102, 502],
      [103, 503],
      [104, 504],
    ]);
    for (const { keys } of drain(list)) {
      expect(keys.size).toBeLessThanOrEqual(M);
      order.push(...[...keys].map((k) => valueOf.get(k)).sort((a, b) => a - b));
    }
    expect(order).toEqual([...valueOf.values()].sort((a, b) => a - b));
  });

  test("a many-chunk batch at M = 1 pulls in order — the #182 star shape", () => {
    // M = 1 makes every chunk a single-entry block: the regime where the
    // pre-#182 per-chunk unshift turned quadratic. Behavior must be
    // unchanged: pulls come out in ascending value order, one at a time.
    const list = new BlockList(1, Infinity);
    list.insert("far", 10_000);
    const batch = [];
    for (let i = 0; i < 500; i += 1) {
      batch.push([`v${i}`, 1 + ((i * 271) % 500)]); // distinct values 1..500
    }
    list.batchPrepend(batch);
    expect(list.size).toBe(501);
    const values = new Map([...batch, ["far", 10_000]]);
    let previous = -Infinity;
    for (const { keys } of drain(list)) {
      expect(keys.size).toBe(1);
      const value = values.get([...keys][0]);
      expect(value).toBeGreaterThan(previous);
      previous = value;
    }
    expect(previous).toBe(10_000); // the pre-existing entry drained last
  });

  test("successive prepended batches stay ordered in front of each other", () => {
    const M = 2;
    const list = new BlockList(M, 1000);
    list.insert("stored", 500);
    list.batchPrepend([
      ["a", 40],
      ["b", 43],
      ["c", 41],
      ["d", 44],
      ["e", 42],
    ]); // > M -> chunked
    list.batchPrepend([
      ["f", 4],
      ["g", 3],
      ["h", 1],
      ["i", 2],
      ["j", 5],
    ]); // all smaller than everything above -> must drain first
    const values = new Map([
      ["a", 40],
      ["b", 43],
      ["c", 41],
      ["d", 44],
      ["e", 42],
      ["f", 4],
      ["g", 3],
      ["h", 1],
      ["i", 2],
      ["j", 5],
      ["stored", 500],
    ]);
    const order = [];
    for (const { keys } of drain(list)) {
      order.push(...[...keys].map((k) => values.get(k)).sort((a, b) => a - b));
    }
    expect(order).toEqual([...values.values()].sort((a, b) => a - b));
  });

  test("duplicate keys keep the smallest value, within the batch and vs stored", () => {
    const list = new BlockList(2, 100);
    list.insert("x", 50);
    list.insert("y", 60);
    list.batchPrepend([
      ["x", 9], // beats the stored 50
      ["z", 8],
      ["z", 4], // beats the in-batch 8
      ["y", 60], // does not beat the stored 60
    ]);
    expect(list.size).toBe(3);
    const first = list.pull();
    expect(first.keys).toEqual(new Set(["x", "z"]));
    expect(first.bound).toBeLessThanOrEqual(60);
    expect(list.pull().keys).toEqual(new Set(["y"]));
  });

  test("an empty batch is a no-op", () => {
    const list = new BlockList(2, 100);
    list.insert(1, 10);
    list.batchPrepend([]);
    list.batchPrepend([[1, 10]]); // fully deduped away
    expect(list.size).toBe(1);
  });

  test("insert can replace a key held in a prepended block", () => {
    const list = new BlockList(2, 100);
    list.insert(1, 90);
    list.pull();
    list.batchPrepend([["a", 50]]);
    list.insert("a", 20); // removes the pair from its d0 block
    expect(list.size).toBe(1);
    const { keys, bound } = list.pull();
    expect(keys).toEqual(new Set(["a"]));
    expect(bound).toBe(100);
  });
});

describe("BlockList #167 machinery (balanced bound index + selection)", () => {
  test("hundreds of splits at a small M still drain in sorted order", () => {
    // M = 2 with 600 shuffled distinct inserts forces ~hundreds of d1
    // blocks, exercising the AVL bound index's splits and searches deep
    // into rebalancing territory
    const M = 2;
    const list = new BlockList(M, Infinity);
    const values = new Map();
    for (let i = 0; i < 600; i += 1) {
      const value = (i * 389) % 600; // distinct values 0..599, shuffled
      list.insert(i, value);
      values.set(i, value);
    }
    expect(list.size).toBe(600);
    let previous = -Infinity;
    for (const { keys, bound } of drain(list)) {
      expect(keys.size).toBeLessThanOrEqual(M);
      const pulled = [...keys].map((k) => values.get(k));
      expect(Math.min(...pulled)).toBeGreaterThan(previous);
      previous = Math.max(...pulled);
      if (bound !== Infinity) expect(bound).toBeGreaterThan(previous);
    }
    expect(previous).toBe(599);
  });

  test("duplicate-key replacements empty and drop interior d1 blocks", () => {
    // Insert enough to split into several blocks, then move every key of
    // the middle band to tiny values: each move deletes from an interior
    // block (dropping it when emptied — a BST removal) and re-inserts
    const M = 3;
    const list = new BlockList(M, 1000);
    const values = new Map();
    for (let i = 0; i < 30; i += 1) {
      list.insert(i, 100 + i * 10);
      values.set(i, 100 + i * 10);
    }
    for (let i = 10; i < 20; i += 1) {
      list.insert(i, i - 10); // 0..9, far below the stored 200..290
      values.set(i, i - 10);
    }
    expect(list.size).toBe(30);
    const first = list.pull();
    expect(first.keys).toEqual(new Set([10, 11, 12]));
    let previous = Math.max(...[...first.keys].map((k) => values.get(k)));
    let drained = first.keys.size;
    for (const { keys } of drain(list)) {
      const pulled = [...keys].map((k) => values.get(k));
      expect(Math.min(...pulled)).toBeGreaterThan(previous);
      previous = Math.max(...pulled);
      drained += keys.size;
    }
    expect(drained).toBe(30);
    expect(previous).toBe(390); // key 29's untouched original value
  });

  test("a many-chunk batchPrepend (sort branch) drains sorted", () => {
    // 1000 pairs at M = 8 (chunkSize 4): |L| >= chunkSize², the sort-based
    // chunking branch
    const M = 8;
    const list = new BlockList(M, Infinity);
    list.insert("far", 1e9);
    const values = new Map([["far", 1e9]]);
    const batch = [];
    for (let i = 0; i < 1000; i += 1) {
      const value = (i * 761) % 1000; // distinct values 0..999, shuffled
      batch.push([i, value]);
      values.set(i, value);
    }
    list.batchPrepend(batch);
    expect(list.size).toBe(1001);
    let previous = -Infinity;
    for (const { keys } of drain(list)) {
      expect(keys.size).toBeLessThanOrEqual(M);
      const pulled = [...keys].map((k) => values.get(k));
      expect(Math.min(...pulled)).toBeGreaterThan(previous);
      previous = Math.max(...pulled);
    }
    expect(previous).toBe(1e9);
  });

  test("a few-chunk batchPrepend (median-recursion branch) drains sorted", () => {
    // 2000 pairs at M = 100 (chunkSize 50): M < |L| < chunkSize², the
    // repeated-median-splitting branch of the chunker
    const M = 100;
    const list = new BlockList(M, Infinity);
    list.insert("far", 1e9);
    const values = new Map([["far", 1e9]]);
    const batch = [];
    for (let i = 0; i < 2000; i += 1) {
      const value = (i * 1223) % 2000; // distinct values 0..1999, shuffled
      batch.push([i, value]);
      values.set(i, value);
    }
    list.batchPrepend(batch);
    expect(list.size).toBe(2001);
    let previous = -Infinity;
    for (const { keys } of drain(list)) {
      expect(keys.size).toBeLessThanOrEqual(M);
      const pulled = [...keys].map((k) => values.get(k));
      expect(Math.min(...pulled)).toBeGreaterThan(previous);
      previous = Math.max(...pulled);
    }
    expect(previous).toBe(1e9);
  });

  test("insert replacement can empty and unlink a middle d0 block", () => {
    // M = 1 turns every prepended pair into its own d0 block; replacing the
    // middle block's key exercises the linked-list unlink of an interior
    // block (head and tail unlinks are covered by the drain tests)
    const list = new BlockList(1, 100);
    list.insert("seed", 90);
    list.pull();
    list.batchPrepend([
      ["a", 3],
      ["b", 2],
      ["c", 1],
    ]);
    list.insert("b", 0.5); // removes b from the middle d0 block, re-inserts
    expect(list.size).toBe(3);
    const order = drain(list).map(({ keys }) => [...keys][0]);
    expect(order).toEqual(["b", "c", "a"]);
  });
});

describe("BlockList stress (seeded)", () => {
  // Mimics how Algorithm 3 drives D: after a pull with separator Bi, new
  // inserts land in [Bi, B) and batch-prepends land in [Bi', Bi) — i.e. at
  // or above everything already pulled. Under that contract, batches must
  // come out globally non-decreasing and each batch must be exactly the
  // current M smallest pairs.
  test("random inserts, prepends and pulls always come out value-sorted", () => {
    const rand = mulberry32(42);
    const M = 8;
    const list = new BlockList(M, Infinity);
    const values = new Map();
    let nextKey = 0;
    let floor = 0; // max value pulled so far; later batches must not go below
    let lastBound = 0; // separator of the last pull; inserts stay above it
    for (let round = 0; round < 60; round += 1) {
      // Insert a random handful of fresh pairs with distinct values >= lastBound
      const inserts = 1 + Math.floor(rand() * 12);
      for (let i = 0; i < inserts; i += 1) {
        const value = lastBound + rand() * 1e6;
        list.insert(nextKey, value);
        values.set(nextKey, value);
        nextKey += 1;
      }
      // Occasionally pull and check the batch is exactly the current minimums
      if (rand() < 0.6 && !list.isEmpty()) {
        const { keys, bound } = list.pull();
        const sorted = [...values.entries()].sort((a, b) => a[1] - b[1]);
        const expectedKeys = new Set(
          sorted.slice(0, keys.size).map(([key]) => key),
        );
        expect(keys).toEqual(expectedKeys);
        const pulled = [...keys].map((k) => values.get(k));
        expect(Math.min(...pulled)).toBeGreaterThanOrEqual(floor);
        floor = Math.max(...pulled);
        expect(bound).toBeGreaterThan(floor);
        for (const k of keys) values.delete(k);
        // Sometimes prepend a few pairs into [floor, bound) — all smaller
        // than everything still stored, like the K batch in Algorithm 3
        if (bound < Infinity && rand() < 0.5) {
          const prepends = 1 + Math.floor(rand() * M);
          const batch = [];
          for (let i = 0; i < prepends; i += 1) {
            const value = floor + rand() * (bound - floor);
            batch.push([nextKey, value]);
            values.set(nextKey, value);
            nextKey += 1;
          }
          list.batchPrepend(batch);
        }
        lastBound = bound === Infinity ? floor : bound;
      }
    }
    // Drain what is left and verify the global ordering held throughout
    for (const { keys } of drain(list)) {
      const pulled = [...keys].map((k) => values.get(k));
      expect(Math.min(...pulled)).toBeGreaterThanOrEqual(floor);
      floor = Math.max(...pulled);
      for (const k of keys) values.delete(k);
    }
    expect(values.size).toBe(0);
  });
});
