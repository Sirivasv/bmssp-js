# 06 — Milestones Roadmap

<!-- SYNCED-FROM-GITHUB: 2026-07-15 (RKB refresh) -->
<!-- Current package version: 0.15.0 -->

Maps GitHub **milestones** and **issues** (Sirivasv/bmssp-js) to the paper's building blocks,
with a dependency-aware build order. This is the "intent" side of the knowledge base (what to
build next); `05-codebase-map.md` is the "reality" side (what exists now).

## 🔄 How this file stays current (this file is DYNAMIC)

- **Session start — read-only reconciliation.** Pull live milestones + issues via `gh` and
  update the markdown below to match GitHub. Do **not** write to GitHub here.
  ```bash
  gh api repos/Sirivasv/bmssp-js/milestones --jq '.[] | {number,title,state,description,open_issues,closed_issues}'
  gh issue list --repo Sirivasv/bmssp-js --state open  --limit 100 --json number,title,milestone,labels
  gh issue list --repo Sirivasv/bmssp-js --state closed --limit 100 --json number,title,milestone
  ```
- **On-demand `RKB` (`revitalize_knowledge_base`) — two-way sync.** In addition to the read
  above, **make GitHub match this roadmap**: reconcile milestone titles/descriptions and issue
  descriptions via `gh`, and reason forward about versioning:
  - the **current version** (from `package.json`),
  - the **next one or two minor-version milestones**, and
  - the **next major-version milestone**,
  proposing which issues each should contain.
  Outward-facing writes (creating/editing milestones or issues) are **confirmed with the user
  first**. See the "Forward-looking version plan" section for the working proposal.

---

## Current state (as synced)

- **Package version:** `0.15.0` (pre-1.0; the algorithm is not yet functional end-to-end).
- **Active milestone:** **`1.0.0` — "Have a first functional version of the whole algorithm."**
  - GitHub progress: **5 closed / 6 open** issues (issue #45 is implemented but its PR #160 is
    not merged yet, so GitHub still counts it open).
  - The 6 open issues (#40–#45) are exactly the algorithm pieces from §02–§03.
- **In flight:** **#45 — adjacency map — implemented in PR #160** (`feat/45-adjacency-map`),
  awaiting merge. See `05-codebase-map.md` for the shipped `this.adjacency` / `getEdges` API.

## Milestone `1.0.0` — issues → paper

| # | Title | What it is (paper) | Labels | Depends on | Status |
|---|---|---|---|---|---|
| **45** | Add a map of arrays for edges of each node | Adjacency map so edge lookups aren't O(m). §05 | help wanted · good first issue | — | ✅ PR #160 (open) |
| **41** | Implement a priority heap | Binary min-heap for the base case (Alg 2). §03-A | help wanted · good first issue | — | ⬜ open |
| **40** | Implement the base case of the bmssp algorithm | `BaseCase(B, S)` bounded mini-Dijkstra. **Alg 2**, §02 | help wanted | #41 | ⬜ open |
| **42** | Implement Lema 3.3 data structure | Block-based partial-sort list `D`. **Lemma 3.3**, §03-B | help wanted | — | ⬜ open |
| **44** | Implement the findingPivots function | `FindPivots(B, S)` frontier shrink. **Alg 1**, §02 | help wanted | #45 (helpful) | ⬜ open |
| **43** | Implement main bmssp algorithm | `BMSSP(l, B, S)` recursion + `k,t`. **Alg 3**, §02 | help wanted | #40, #42, #44 | ⬜ open |

### Closed (context)
`#36` main `calculateShortestPaths` (currently delegates to Dijkstra — placeholder) ·
`#35` Dijkstra oracle + BMSSP-vs-Dijkstra test · `#28` `shortestPaths` output map (∞ init) ·
`#27` `nodeIDs` vertex index · `#24` datasets research (roadNet-CA).

## Recommended build order (within 1.0.0)

Leaves first; two independent tracks converge on the main recursion:

```
Track A (base case):     #45 adjacency map ─┬─▶ #41 heap ─▶ #40 BaseCase ─┐   (#45 ✅ done)
Track B (recursion core):    (✅ done)       └─▶ #44 FindPivots ───────────┼─▶ #43 BMSSP main
                                                #42 BlockList ─────────────┘
```

1. ~~**#45** adjacency map~~ — ✅ **done (PR #160):** `this.adjacency: Map<nodeId, [to,w][]>`
   + `getEdges()`, built in the constructor. Unblocks #40 and #44.
2. **#41** binary min-heap — standalone, unit-testable (or reuse `dijkstra.mjs`'s lazy heap).
   **← recommended next (leaf on Track A).**
3. **#42** block-list `D` — standalone; biggest/riskiest; do early in isolation (§03-B tests).
4. **#40** BaseCase — needs #41 (+ #45 ✅). Test vs. a plain bounded Dijkstra from `x`.
5. **#44** FindPivots — needs relaxation + adjacency (#45 ✅). Test both branches (`|W|>k|S|`
   and forest roots).
6. **#43** BMSSP main — wires #40+#42+#44 with `k`/`t`; replaces the Dijkstra delegation in
   `calculateShortestPaths`. **Definition of done:** BMSSP computes distances via the paper's
   method and the "BMSSP vs Dijkstra" test still passes for every node.

### Parameter derivation (for #43)
```js
const n = this.nodeIDs.size;
const logn = Math.log2(n);
const k = Math.max(1, Math.floor(logn ** (1 / 3)));
const t = Math.max(1, Math.floor(logn ** (2 / 3)));
const topLevel = Math.ceil(logn / t);   // top call: BMSSP(topLevel, Infinity, new Set([source]))
```
Clamp `k`,`t` to `≥ 1` for tiny graphs; correctness must not depend on the asymptotic regime.

---

## Forward-looking version plan (working proposal — refine/apply on `RKB`)

> This is the agent's reasoned proposal for milestones beyond `1.0.0`. On `RKB`, reconcile it
> with GitHub (create/adjust milestones + issues) **after user confirmation**. Currently only
> `1.0.0` exists on GitHub; everything below is proposed, not yet created.

- **`1.0.0` (current, exists):** first end-to-end functional BMSSP matching Dijkstra. Issues
  #40–#45.
- **`1.1.0` (proposed minor):** correctness hardening — property/fuzz tests vs. Dijkstra on
  random graphs, disconnected-graph & tie-breaking edge cases, the constant-degree transform
  as an option, input validation, and JSDoc/API docs for the new modules.
- **`1.2.0` (proposed minor):** performance & ergonomics — swap the block-list bound index for
  a real balanced BST, adjacency/relaxation micro-optimizations, optional path reconstruction
  (`Pred[]` → paths). _Note:_ a seeded **benchmark harness already landed early** with #45
  (`benchmarks/`, `npm run bench`) — once #43 is done it gains a BMSSP column and becomes the
  BMSSP-vs-Dijkstra comparison this milestone was going to build.
- **`2.0.0` (proposed major):** API-breaking generalization — public multi-source / bounded
  entrypoint (expose `BMSSP(l, B, S)`-style calls), typed graph inputs, and a stabilized
  public API surface (possible signature changes to `BMSSP` constructor / methods).

When applying on `RKB`: set milestone descriptions to the one-liners above, and file/assign
the issues implied by each bullet, keeping labels consistent with the existing repo
conventions (`help wanted`, `good first issue`).

---

## Definition of done for `1.0.0`

- `calculateShortestPaths(source)` computes distances **via BMSSP** (not by calling
  `dijkstra`), and the "BMSSP vs Dijkstra" test in `test/main.test.mjs` passes for every node.
- Each sub-piece (#40/#41/#42/#44/#45) ships with focused unit tests.
- `npm run lint` clean; ESM + Prettier style preserved.

## Testing tips
- Small hand-built graphs with known distances for unit tests; `roadNet-CA.txt` for the big
  equivalence test.
- Any `BMSSP(l, B, S)` call's completed vertices+distances must equal
  `{ v : d_dijkstra(v) < B', shortest path visits S }`.
- Break distance ties deterministically (Assumption 2.1, §01) so `Pred[]` stays a tree.
