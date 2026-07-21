import { describe, test, expect } from "@jest/globals";
import { BoundIndex } from "../src/boundIndex.mjs";

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

// In-order item walk via the public iteration surface
function toArray(tree) {
  const items = [];
  for (let node = tree.first(); node !== null; node = tree.next(node)) {
    items.push(node.item);
  }
  return items;
}

// Recursively verify the AVL shape: parent pointers consistent, stored
// heights correct, every balance factor within [-1, 1]. Returns the height.
function verifyShape(node, parent) {
  if (node === null) return 0;
  expect(node.parent).toBe(parent);
  const left = verifyShape(node.left, node);
  const right = verifyShape(node.right, node);
  expect(node.height).toBe(1 + Math.max(left, right));
  expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
  return node.height;
}

describe("BoundIndex basics", () => {
  test("starts empty and clears back to empty", () => {
    const tree = new BoundIndex();
    expect(tree.size).toBe(0);
    expect(tree.first()).toBeNull();
    expect(tree.last()).toBeNull();
    tree.append("a");
    tree.append("b");
    expect(tree.size).toBe(2);
    tree.clear();
    expect(tree.size).toBe(0);
    expect(tree.first()).toBeNull();
    expect(toArray(tree)).toEqual([]);
  });

  test("append keeps sequence order; first/last/next agree", () => {
    const tree = new BoundIndex();
    const items = ["a", "b", "c", "d", "e", "f", "g"];
    for (const item of items) tree.append(item);
    expect(toArray(tree)).toEqual(items);
    expect(tree.first().item).toBe("a");
    expect(tree.last().item).toBe("g");
    verifyShape(tree.root, null);
  });

  test("insertBefore places items at the head and mid-sequence", () => {
    const tree = new BoundIndex();
    const b = tree.append("b");
    const d = tree.append("d");
    tree.insertBefore(b, "a"); // head insert (reference has no left child)
    tree.insertBefore(d, "c"); // middle insert
    tree.insertBefore(d, "c2"); // reference now has a left subtree
    expect(toArray(tree)).toEqual(["a", "b", "c", "c2", "d"]);
    verifyShape(tree.root, null);
  });

  test("remove handles leaves, one-child and two-children nodes", () => {
    const tree = new BoundIndex();
    const nodes = [];
    for (let i = 0; i < 10; i += 1) nodes.push(tree.append(i));
    tree.remove(nodes[9]); // leaf
    tree.remove(nodes[0]); // edge of the sequence
    tree.remove(tree.root); // root with two children
    verifyShape(tree.root, null);
    const remaining = toArray(tree);
    expect(remaining.length).toBe(7);
    expect(remaining).toEqual([...remaining].sort((a, b) => a - b));
    while (tree.size > 0) tree.remove(tree.first());
    expect(toArray(tree)).toEqual([]);
    expect(tree.root).toBeNull();
  });

  test("findFirst returns the leftmost match of a monotone predicate", () => {
    const tree = new BoundIndex();
    // Non-decreasing bounds with a duplicate run, like d1 block bounds
    const bounds = [10, 20, 20, 20, 30, 40];
    bounds.forEach((bound, i) => tree.append({ bound, seq: i }));
    expect(tree.findFirst((b) => b.bound >= 15).item.seq).toBe(1); // leftmost 20
    expect(tree.findFirst((b) => b.bound >= 20).item.seq).toBe(1); // duplicate run
    expect(tree.findFirst((b) => b.bound >= 10).item.seq).toBe(0);
    expect(tree.findFirst((b) => b.bound >= 35).item.seq).toBe(5);
    expect(tree.findFirst((b) => b.bound >= 41)).toBeNull();
  });
});

describe("BoundIndex balance and stress (seeded)", () => {
  test("stays height-balanced under append-only growth", () => {
    const tree = new BoundIndex();
    for (let i = 0; i < 2048; i += 1) tree.append(i);
    verifyShape(tree.root, null);
    // AVL height bound: ~1.44·log2(n); a plain linked chain would be 2048
    expect(tree.root.height).toBeLessThanOrEqual(17);
    expect(toArray(tree).length).toBe(2048);
  });

  test("random insertBefore/append/remove matches a reference array", () => {
    const rand = mulberry32(20260721);
    const tree = new BoundIndex();
    const reference = []; // parallel array of node handles, in sequence order
    let nextItem = 0;
    for (let op = 0; op < 5000; op += 1) {
      const roll = rand();
      if (roll < 0.55 || reference.length === 0) {
        // Insert at a random position (index == length appends at the end)
        const at = Math.floor(rand() * (reference.length + 1));
        const item = nextItem;
        nextItem += 1;
        const node =
          at === reference.length
            ? tree.append(item)
            : tree.insertBefore(reference[at], item);
        reference.splice(at, 0, node);
      } else {
        // Remove a random position
        const at = Math.floor(rand() * reference.length);
        tree.remove(reference[at]);
        reference.splice(at, 1);
      }
      expect(tree.size).toBe(reference.length);
    }
    verifyShape(tree.root, null);
    expect(toArray(tree)).toEqual(reference.map((node) => node.item));
    // Spot-check findFirst against the reference on the monotone predicate
    // "item >= threshold" after sorting the sequence is not applicable here
    // (items are insertion-ordered), so verify iteration from every node
    const fromMiddle = [];
    let node = reference[reference.length >> 1];
    for (; node !== null; node = tree.next(node)) fromMiddle.push(node.item);
    expect(fromMiddle).toEqual(
      reference.slice(reference.length >> 1).map((n) => n.item),
    );
  });

  test("interleaved churn keeps the AVL invariants at every step", () => {
    const rand = mulberry32(3141);
    const tree = new BoundIndex();
    const reference = [];
    let nextItem = 0;
    for (let op = 0; op < 400; op += 1) {
      if (rand() < 0.6 || reference.length === 0) {
        const at = Math.floor(rand() * (reference.length + 1));
        const node =
          at === reference.length
            ? tree.append(nextItem)
            : tree.insertBefore(reference[at], nextItem);
        reference.splice(at, 0, node);
        nextItem += 1;
      } else {
        const at = Math.floor(rand() * reference.length);
        tree.remove(reference[at]);
        reference.splice(at, 1);
      }
      verifyShape(tree.root, null);
      expect(toArray(tree)).toEqual(reference.map((node) => node.item));
    }
  });
});
