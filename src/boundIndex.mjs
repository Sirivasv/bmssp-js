/**
 * Self-balancing (AVL) ordered sequence — the "balanced BST over block upper
 * bounds" of Lemma 3.3 (issue #167; replaces BlockList's plain-array bound
 * index, whose splice-based maintenance paid O(#blocks) per split/drop).
 *
 * BlockList keeps its d1 blocks with non-decreasing value bounds. This tree
 * stores that block sequence POSITIONALLY: a node's in-order position is its
 * sequence position, and the tree itself never compares items. Because the
 * bounds are monotone along the sequence, findFirst with a monotone
 * predicate binary-searches the sequence in O(log size) — the paper's bound
 * lookup — while insertBefore / append / remove stay O(log size) via AVL
 * rebalancing.
 *
 * Nodes are plain objects { item, parent, left, right, height } returned as
 * handles; callers keep the handle to later remove or iterate from it.
 */
class BoundIndex {
  constructor() {
    this.root = null;
    this.count = 0;
  }

  // Number of items currently stored
  get size() {
    return this.count;
  }

  // Drop every item
  clear() {
    this.root = null;
    this.count = 0;
  }

  // First node in sequence order, or null when empty
  first() {
    let node = this.root;
    if (node === null) return null;
    while (node.left !== null) node = node.left;
    return node;
  }

  // Last node in sequence order, or null when empty
  last() {
    let node = this.root;
    if (node === null) return null;
    while (node.right !== null) node = node.right;
    return node;
  }

  // In-order successor of a node, or null at the end of the sequence
  next(node) {
    if (node.right !== null) {
      let succ = node.right;
      while (succ.left !== null) succ = succ.left;
      return succ;
    }
    let child = node;
    let parent = child.parent;
    while (parent !== null && parent.right === child) {
      child = parent;
      parent = parent.parent;
    }
    return parent;
  }

  /**
   * Leftmost node whose item satisfies the predicate, or null when none
   * does. The predicate must be monotone along the sequence (a prefix of
   * false followed by a suffix of true) — with BlockList's non-decreasing
   * bounds, `(block) => compare(block.bound, value) >= 0` is exactly that.
   * O(log size).
   * @param {(item: *) => boolean} predicate
   * @returns {*} The matching node handle, or null
   */
  findFirst(predicate) {
    let node = this.root;
    let found = null;
    while (node !== null) {
      if (predicate(node.item)) {
        found = node;
        node = node.left;
      } else {
        node = node.right;
      }
    }
    return found;
  }

  /**
   * Insert an item at the end of the sequence. O(log size).
   * @returns {*} The new node handle
   */
  append(item) {
    const node = this.makeNode(item);
    if (this.root === null) {
      this.root = node;
    } else {
      const tail = this.last();
      tail.right = node;
      node.parent = tail;
      this.rebalance(tail);
    }
    this.count += 1;
    return node;
  }

  /**
   * Insert an item immediately before an existing node. O(log size).
   * @param {*} reference - Node handle the new item goes in front of
   * @returns {*} The new node handle
   */
  insertBefore(reference, item) {
    const node = this.makeNode(item);
    if (reference.left === null) {
      reference.left = node;
      node.parent = reference;
    } else {
      let pred = reference.left;
      while (pred.right !== null) pred = pred.right;
      pred.right = node;
      node.parent = pred;
    }
    this.count += 1;
    this.rebalance(node.parent);
    return node;
  }

  /**
   * Remove a node from the sequence. O(log size).
   * @param {*} node - Node handle previously returned by append/insertBefore
   */
  remove(node) {
    let start; // deepest structurally-changed node, where rebalancing begins
    if (node.left === null) {
      start = node.parent;
      this.replaceInParent(node, node.right);
    } else if (node.right === null) {
      start = node.parent;
      this.replaceInParent(node, node.left);
    } else {
      // Two children: splice out the in-order successor (which has no left
      // child) and put it in the removed node's place
      let succ = node.right;
      while (succ.left !== null) succ = succ.left;
      if (succ.parent === node) {
        start = succ;
      } else {
        start = succ.parent;
        this.replaceInParent(succ, succ.right);
        succ.right = node.right;
        succ.right.parent = succ;
      }
      this.replaceInParent(node, succ);
      succ.left = node.left;
      succ.left.parent = succ;
      succ.height = node.height;
    }
    node.parent = node.left = node.right = null;
    this.count -= 1;
    this.rebalance(start);
  }

  // Internal: fresh leaf node
  makeNode(item) {
    return { item, parent: null, left: null, right: null, height: 1 };
  }

  // Internal: make replacement take node's place under node's parent
  // (replacement may be null)
  replaceInParent(node, replacement) {
    const parent = node.parent;
    if (parent === null) {
      this.root = replacement;
    } else if (parent.left === node) {
      parent.left = replacement;
    } else {
      parent.right = replacement;
    }
    if (replacement !== null) replacement.parent = parent;
  }

  // Internal: height of a possibly-null subtree
  heightOf(node) {
    return node === null ? 0 : node.height;
  }

  // Internal: recompute a node's height from its children
  updateHeight(node) {
    node.height =
      1 + Math.max(this.heightOf(node.left), this.heightOf(node.right));
  }

  // Internal: left-minus-right height difference
  balanceOf(node) {
    return this.heightOf(node.left) - this.heightOf(node.right);
  }

  // Internal: walk from node to the root, updating heights and rotating
  // wherever the AVL invariant |balance| <= 1 broke (deletion can require a
  // rotation at every level; insertion at most one — the loop covers both)
  rebalance(node) {
    while (node !== null) {
      this.updateHeight(node);
      const balance = this.balanceOf(node);
      if (balance > 1) {
        if (this.balanceOf(node.left) < 0) this.rotateLeft(node.left);
        node = this.rotateRight(node);
      } else if (balance < -1) {
        if (this.balanceOf(node.right) > 0) this.rotateRight(node.right);
        node = this.rotateLeft(node);
      }
      node = node.parent;
    }
  }

  // Internal: standard AVL rotation; returns the subtree's new root
  rotateLeft(node) {
    const pivot = node.right;
    node.right = pivot.left;
    if (pivot.left !== null) pivot.left.parent = node;
    this.replaceInParent(node, pivot);
    pivot.left = node;
    node.parent = pivot;
    this.updateHeight(node);
    this.updateHeight(pivot);
    return pivot;
  }

  // Internal: mirror of rotateLeft
  rotateRight(node) {
    const pivot = node.left;
    node.left = pivot.right;
    if (pivot.right !== null) pivot.right.parent = node;
    this.replaceInParent(node, pivot);
    pivot.right = node;
    node.parent = pivot;
    this.updateHeight(node);
    this.updateHeight(pivot);
    return pivot;
  }
}

export { BoundIndex };
