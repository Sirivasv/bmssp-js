# 06 — Milestones Roadmap

<!-- SYNCED-FROM-GITHUB: 2026-07-16 (RKB after #40 implementation; PR #178 open, bump to 0.18.0 riding in it) -->
<!-- Current released version: 0.17.0; 0.18.0 bumped in open PR #178 (tag+release after merge) -->

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
  above, **make GitHub match this roadmap**, using the just-refreshed knowledge base + code as
  the source of truth:
  - **Existing open issues** (yours or the user's) may be **edited** (title/description),
    **closed** (done/obsolete/superseded), **re-scoped/split/merged**, or **moved** to another
    milestone as new learnings dictate.
  - **Milestones** are adjusted the same way — reason forward about versioning and update the
    **current version** (from `package.json`), the **number and scope of the next one or two
    minor-version milestones**, and the **next major-version milestone** (titles, descriptions,
    and which issues belong to each — adding or removing issues as needed).
  Outward-facing writes (creating/editing/closing milestones or issues) are **confirmed with the
  user first, one ask per edit**. See the "Forward-looking version plan" section for the working
  proposal. **The agent co-owns this roadmap**: every RKB after real progress should proactively
  propose issue/milestone improvements from the session's learnings (see `../CLAUDE.md`), rather
  than waiting for the user to request them.

---

## Current state (as synced)

- **Package version:** `0.17.0` (pre-1.0; the algorithm is not yet functional end-to-end).
  The `0.17.0` tag + GitHub Release are published (npm + Docker Hub CD fired).
- **Active milestone:** **`1.0.0` — "Have a first functional version of the whole algorithm."**
  - GitHub progress: **8 closed / 3 open** issues (PR #177 merged, so #41 now counts closed).
  - The 3 open issues (#40, #43, #44) are the remaining algorithm pieces from §02–§03.
- **Just merged:** **#41 — indexed binary MinHeap — PR #177 is now on `main`** (commit
  `7e36afc`). See `05-codebase-map.md` for the shipped `src/heap.mjs` API
  (`insert` / `extractMin` / `decreaseKey` / `has` / `peekMin`). With #41 done, **#40
  (BaseCase) is fully unblocked** — both its dependencies (#41 heap, #45 adjacency) are in.

## Milestone `1.0.0` — issues → paper

| # | Title | What it is (paper) | Labels | Depends on | Status |
|---|---|---|---|---|---|
| **45** | Add a map of arrays for edges of each node | Adjacency map so edge lookups aren't O(m). §05 | help wanted · good first issue | — | ✅ merged (PR #160) |
| **41** | Implement a priority heap | Binary min-heap for the base case (Alg 2). §03-A | help wanted · good first issue | — | ✅ merged (PR #177) |
| **40** | Implement the base case of the bmssp algorithm | `BaseCase(B, S)` bounded mini-Dijkstra. **Alg 2**, §02 | help wanted | #41 | 🔶 PR open |
| **42** | Implement Lema 3.3 data structure | Block-based partial-sort list `D`. **Lemma 3.3**, §03-B | help wanted | — | ✅ merged (PR #175) |
| **44** | Implement the findingPivots function | `FindPivots(B, S)` frontier shrink. **Alg 1**, §02 | help wanted | #45 (helpful) | ⬜ open |
| **43** | Implement main bmssp algorithm | `BMSSP(l, B, S)` recursion + `k,t`. **Alg 3**, §02 | help wanted | #40, #42, #44 | ⬜ open |

### Closed (context)
`#36` main `calculateShortestPaths` (currently delegates to Dijkstra — placeholder) ·
`#35` Dijkstra oracle + BMSSP-vs-Dijkstra test · `#28` `shortestPaths` output map (∞ init) ·
`#27` `nodeIDs` vertex index · `#24` datasets research (roadNet-CA).

## Recommended build order (within 1.0.0)

Leaves first; two independent tracks converge on the main recursion:

```
Track A (base case):     #45 adjacency map ─┬─▶ #41 heap ─▶ #40 BaseCase ─┐   (#45 ✅, #41 ✅)
Track B (recursion core):    (✅ done)       └─▶ #44 FindPivots ───────────┼─▶ #43 BMSSP main
                                                #42 BlockList (✅ done) ───┘
```

1. ~~**#45** adjacency map~~ — ✅ **done (PR #160):** `this.adjacency: Map<nodeId, [to,w][]>`
   + `getEdges()`, built in the constructor. Unblocks #40 and #44.
2. ~~**#42** block-list `D`~~ — ✅ **done (PR #175):** `src/blockList.mjs` + 18 tests
   (§03-B contracts incl. seeded stress). Bound index is a sorted array for now (#167).
3. ~~**#41** binary min-heap~~ — ✅ **done (PR #177):** `src/heap.mjs` indexed `MinHeap`
   (insert/extractMin/decreaseKey/has) + 16 tests; version 0.17.0 released. Unblocks #40.
4. **#40** BaseCase — 🔶 **PR open:** `src/baseCase.mjs` `baseCase(B, S, dHat, adjacency, k)`
   + 13 tests (incl. seeded oracle stress); bump to 0.18.0. Unblocks the level-0 leg of #43.
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

## Forward-looking version plan (created on GitHub)

> These milestones and their issues were created on GitHub during an `RKB` two-way sync
> (after user confirmation). All four milestones now exist; keep this section reconciled with
> GitHub going forward.

### `1.0.0` (milestone #1) — first end-to-end functional BMSSP
Issues #40–#45. #45 done (PR #160), #42 done (PR #175), #41 done (PR #177); #40, #43, #44
open. See the tables above.

### `1.1.0` (milestone #2) — correctness hardening
| # | Issue | Labels |
|---|---|---|
| 161 | Property/fuzz tests: BMSSP vs Dijkstra on random graphs | enhancement · help wanted |
| 162 | Edge-case tests: disconnected graphs and unreachable nodes | enhancement · help wanted |
| 163 | Deterministic tie-breaking for equal-length paths (Assumption 2.1) | enhancement · help wanted |
| 164 | Optional constant-degree transform (in/out-degree ≤ 2) | enhancement · help wanted |
| 165 | Input validation for the BMSSP constructor | good first issue · help wanted |
| 166 | JSDoc / API docs for the new modules | documentation · good first issue |

### `1.2.0` (milestone #3) — performance & ergonomics
| # | Issue | Labels |
|---|---|---|
| 167 | Restore Lemma 3.3's exact asymptotics in BlockList (balanced-BST bound index + linear-time selection) | enhancement · help wanted |
| 168 | Adjacency and relaxation micro-optimizations | enhancement · help wanted |
| 169 | Optional shortest-path reconstruction (`Pred[]` → paths) | enhancement · help wanted |
| 170 | BMSSP-vs-Dijkstra benchmark comparison | enhancement · help wanted |

_Note:_ the seeded **benchmark harness already landed early** with #45 (`benchmarks/`,
`npm run bench`); #170 just adds the BMSSP column once #43 is done.

_RKB 2026-07-16 (post #40) — issue bodies updated on GitHub:_ #44 rewritten as a full
FindPivots spec (signature mirroring `baseCase`, early exit, tight-edge forest, tie caveat,
test plan); #43 gained the concrete wiring contract (baseCase/BlockList APIs, `k`/`t`
derivation, workload guard, definition of done); #163 gained the two tie manifestations
found in #40 (settled-vertex guard vs zero-weight cycles; forest-DAG ambiguity in
FindPivots); #169 noted that `Pred[]` must be wired into all three relaxation sites.
Milestone slicing unchanged — 1.0.0 (#44 → #43 after #40 merges) still the right shape.

_RKB 2026-07-15 (post #42/#41) — issue bodies updated on GitHub:_ #167 widened to both
BlockList shortcuts (bound index **and** sort-based median selection); #168 widened with the
indexed-vs-lazy **heap strategy** benchmark/consolidation; #166 re-scoped to the older doc
surface (new modules ship with JSDoc already); #173 gained the explicit internal-vs-public
exposure decision (BlockList/MinHeap are not re-exported from `index.mjs`).

### `2.0.0` (milestone #4) — API-breaking generalization
| # | Issue | Labels |
|---|---|---|
| 171 | Public multi-source / bounded BMSSP entrypoint | enhancement · help wanted |
| 172 | Typed / flexible graph inputs | enhancement · help wanted |
| 173 | Stabilize the public API surface for 1.0 → 2.0 | documentation · enhancement |

---

## Release mechanics (version bump per closed issue)

Closing an issue bumps the package version and, after the PR merges, ships a release:

1. **In the PR that closes the issue** — `npm version minor --no-git-tag-version` (keeps
   `package.json` + `package-lock.json` in sync; historical cadence is a **minor** `0.N.0` bump
   per issue). The `1.0.0` milestone close is the `major` bump to `1.0.0`.
2. **After the user confirms the merge** — tag `main` with the bare version (no `v` prefix) and
   `gh release create` it; publishing the release fires `publish.yml` → **npm + Docker Hub**.

Full procedure + exact commands live in **`../CLAUDE.md` → "Version bump & release"**. The
release step is an outward-facing publish and is **gated on explicit user confirmation**.

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
