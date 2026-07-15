import { describe, test, expect } from "@jest/globals";
import { MinHeap } from "../src/heap.mjs";

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

// Extract every pair, returning the values in extraction order
function drainValues(heap) {
  const values = [];
  while (!heap.isEmpty()) {
    values.push(heap.extractMin().value);
  }
  return values;
}

describe("MinHeap basics", () => {
  test("starts empty", () => {
    const heap = new MinHeap();
    expect(heap.isEmpty()).toBe(true);
    expect(heap.size).toBe(0);
  });

  test("extractMin and peekMin on an empty heap throw", () => {
    const heap = new MinHeap();
    expect(() => heap.extractMin()).toThrow("heap is empty");
    expect(() => heap.peekMin()).toThrow("heap is empty");
  });

  test("insert rejects non-numeric values", () => {
    const heap = new MinHeap();
    expect(() => heap.insert(1, NaN)).toThrow("value must be a number");
    expect(() => heap.insert(1, "7")).toThrow("value must be a number");
  });

  test("insert rejects a key that is already stored", () => {
    const heap = new MinHeap();
    heap.insert(1, 10);
    expect(() => heap.insert(1, 5)).toThrow(
      "key already in heap — use decreaseKey",
    );
  });

  test("size, has and getValue reflect inserts and extracts", () => {
    const heap = new MinHeap();
    heap.insert("a", 3);
    heap.insert("b", 1);
    expect(heap.size).toBe(2);
    expect(heap.has("a")).toBe(true);
    expect(heap.getValue("a")).toBe(3);
    expect(heap.getValue("missing")).toBeUndefined();
    expect(heap.extractMin()).toEqual({ key: "b", value: 1 });
    expect(heap.has("b")).toBe(false);
    expect(heap.size).toBe(1);
  });

  test("Infinity is a valid value", () => {
    const heap = new MinHeap();
    heap.insert(1, Infinity);
    heap.insert(2, 42);
    expect(heap.extractMin()).toEqual({ key: 2, value: 42 });
    expect(heap.extractMin()).toEqual({ key: 1, value: Infinity });
  });
});

describe("MinHeap ordering", () => {
  test("extracts pairs in non-decreasing value order", () => {
    const heap = new MinHeap();
    const values = [9, 4, 7, 1, 8, 2, 6, 3, 5, 0];
    values.forEach((value, key) => heap.insert(key, value));
    expect(drainValues(heap)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test("equal values all come out, adjacent to each other", () => {
    const heap = new MinHeap();
    heap.insert("a", 5);
    heap.insert("b", 5);
    heap.insert("c", 1);
    expect(heap.extractMin().value).toBe(1);
    const keys = [heap.extractMin(), heap.extractMin()].map((e) => e.key);
    expect(new Set(keys)).toEqual(new Set(["a", "b"]));
    expect(heap.isEmpty()).toBe(true);
  });

  test("peekMin returns the minimum without removing it", () => {
    const heap = new MinHeap();
    heap.insert(1, 20);
    heap.insert(2, 10);
    expect(heap.peekMin()).toEqual({ key: 2, value: 10 });
    expect(heap.size).toBe(2);
  });

  test("an extracted key can be inserted again", () => {
    const heap = new MinHeap();
    heap.insert(1, 10);
    heap.extractMin();
    heap.insert(1, 4);
    expect(heap.extractMin()).toEqual({ key: 1, value: 4 });
  });
});

describe("MinHeap decreaseKey", () => {
  test("rejects a key that is not stored", () => {
    const heap = new MinHeap();
    expect(() => heap.decreaseKey(1, 5)).toThrow(
      "key not in heap — use insert",
    );
  });

  test("rejects non-numeric values", () => {
    const heap = new MinHeap();
    heap.insert(1, 10);
    expect(() => heap.decreaseKey(1, NaN)).toThrow("value must be a number");
  });

  test("a lowered key becomes the new minimum", () => {
    const heap = new MinHeap();
    heap.insert("a", 10);
    heap.insert("b", 20);
    heap.insert("c", 30);
    heap.decreaseKey("c", 1);
    expect(heap.getValue("c")).toBe(1);
    expect(heap.extractMin()).toEqual({ key: "c", value: 1 });
  });

  test("a value that would not decrease the stored one is ignored", () => {
    const heap = new MinHeap();
    heap.insert(1, 10);
    heap.decreaseKey(1, 10);
    heap.decreaseKey(1, 25);
    expect(heap.getValue(1)).toBe(10);
  });

  test("supports the BaseCase relaxation pattern (insert or decreaseKey)", () => {
    // Relax edge (u, v): if v not in H insert it, else lower its key —
    // exactly the branch Algorithm 2 performs after each edge relaxation
    const heap = new MinHeap();
    const relax = (v, d) => {
      if (!heap.has(v)) heap.insert(v, d);
      else heap.decreaseKey(v, d);
    };
    relax("v", 50);
    relax("w", 30);
    relax("v", 20);
    relax("w", 40);
    expect(heap.extractMin()).toEqual({ key: "v", value: 20 });
    expect(heap.extractMin()).toEqual({ key: "w", value: 30 });
  });
});

describe("MinHeap stress (seeded)", () => {
  test("random inserts, decreases and extracts match a naive queue", () => {
    const rand = mulberry32(41);
    const heap = new MinHeap();
    const naive = new Map(); // key -> value, scanned linearly for the min
    let nextKey = 0;
    for (let step = 0; step < 5000; step += 1) {
      const roll = rand();
      if (roll < 0.5) {
        const value = Math.floor(rand() * 1e6);
        heap.insert(nextKey, value);
        naive.set(nextKey, value);
        nextKey += 1;
      } else if (roll < 0.75 && naive.size > 0) {
        // Decrease a random stored key by a random amount
        const keys = [...naive.keys()];
        const key = keys[Math.floor(rand() * keys.length)];
        const value = naive.get(key) - Math.floor(rand() * 1e5);
        heap.decreaseKey(key, value);
        if (value < naive.get(key)) naive.set(key, value);
      } else if (naive.size > 0) {
        const { key, value } = heap.extractMin();
        let minValue = Infinity;
        for (const v of naive.values()) {
          if (v < minValue) minValue = v;
        }
        expect(value).toBe(minValue);
        expect(naive.get(key)).toBe(minValue);
        naive.delete(key);
      }
      expect(heap.size).toBe(naive.size);
    }
    // Drain what is left: extraction order must be non-decreasing
    const rest = drainValues(heap);
    const sorted = [...rest].sort((a, b) => a - b);
    expect(rest).toEqual(sorted);
  });
});
