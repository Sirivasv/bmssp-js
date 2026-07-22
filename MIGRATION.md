# Migration guide

The runnable, always-green reference for everything here is the
[`examples/` gallery](examples/) — each file imports from the published `bmssp` package and
exercises exactly the public surface.

---

## Migrating from 2.x to 3.0

**TL;DR — one small breaking change: two public fields were removed.** 3.0.0 is a
**performance** release. Its single change to the public surface is the removal of two
`BMSSP` instance fields that were rarely used directly:

| Removed field (2.x) | Replacement (3.0) |
| --- | --- |
| `instance.graph` (copied `[from, to, weight][]` edge array) | Rebuild on demand from `instance.getEdges(id)` over `instance.nodeIDs`, or just keep the array you constructed the instance with. |
| `instance.adjacency` (`Map<id, [[to, weight], …]>`) | `instance.getEdges(id)` returns a node's `[to, weight]` edges (materialized from the CSR); build a Map yourself if you need one. |

**Why:** since 2.0's dense-index engine, the graph already lives as a CSR (compressed-sparse-row
typed arrays) — the single source of truth the algorithm actually runs on. The `graph` and
`adjacency` fields were an extra edge-array deep copy plus an adjacency `Map` built eagerly in
the constructor on top of it. Building the CSR **directly** from the input (#212) skips that
round-trip and **roughly halves construction time** (n = 500k / m = 1.5M: ~510 → ~240 ms
median). Everything else is unchanged — same distances, hops, predecessors, tie-break, and
every other public method and field.

**If you used `getEdges` already** (the supported edge accessor), nothing changes — it still
returns `[to, weight]` pairs and `[]` for unknown nodes; it just builds the array from the CSR
now. **If you fed `instance.graph` to the `dijkstra` oracle**, pass the edge array you built the
instance from instead (or `[...instance.nodeIDs].flatMap(f => instance.getEdges(f).map(([t, w]) => [f, t, w]))`).

The rest of the public surface — the four exports and every other `BMSSP` member — is
unchanged from 2.0 and still pinned by `test/publicApi.test.mjs`.

---

## Migrating from 1.x to 2.0

**TL;DR — there are no breaking changes to the documented public API.** Every program
written against the 1.x public surface keeps working unchanged on 2.0.0. The major version
marks a **stability commitment**: the public API below is now locked and covered by a
contract test (`test/publicApi.test.mjs`), so it can't drift by accident. The 2.0.0
milestone also consolidates the capabilities that landed additively across 1.1.x / 1.2.x
and the 2.0.0 pre-work.

## What's new since 1.0

All of these are **additive** — nothing you relied on was removed or changed shape:

- **Flexible graph inputs** (#172). `new BMSSP(input)` now accepts an edge array (as before),
  an adjacency `Map` (`Map<from, [[to, weight], …]>`), a plain adjacency object
  (`{ from: [[to, weight], …] }`, numeric-string keys coerced to numbers), or a new **`Graph`**
  builder. `Graph` is the only way to declare an **isolated vertex**
  (`new Graph().addEdge(0, 1, 50).addVertex(9)`). See
  [`examples/05-flexible-inputs.mjs`](examples/05-flexible-inputs.mjs).
- **Multi-source / bounded entrypoint** (#171). `calculateShortestPathsFrom(sources, { bound })`
  runs the paper's `BMSSP(l, B, S)` generalization from a set of sources with initial
  distances, optionally under a strict distance bound. See
  [`examples/06-multi-source.mjs`](examples/06-multi-source.mjs).
- **Dense-index engine** (#205). The interior was re-engineered onto typed-array labels and a
  CSR adjacency, roughly halving wall-clock — **no API change**.
- Earlier 1.x additions, now part of the locked surface: shortest-path reconstruction
  (`reconstructPath`, #169), the opt-in `constantDegreeTransform` (#164), constructor input
  validation (#165), deterministic tie-breaking (#163).

## The supported public API (locked as of 2.0.0)

`index.mjs` exports exactly four names:

| Export | What it is |
| --- | --- |
| `BMSSP` | The algorithm class (see its methods below). |
| `Graph` | Mutable input builder — `addVertex`, `addEdge`, `hasVertex`, `toNormalized`; mutators chain. |
| `dijkstra` | `dijkstra(graph, nodeIDs, source) → Map<id, distance>` — the reference oracle. |
| `constantDegreeTransform` | Opt-in degree-≤2 rewrite → `{ edges, copiesOf, originalOf, sourceCopy, collapse }`. |

Supported members of a `BMSSP` instance:

- **Methods:** `calculateShortestPaths(source)`, `calculateShortestPathsFrom(sources, { bound })`,
  `bmssp(l, B, S)` (advanced — the low-level bounded multi-source primitive, returns
  `{ bound, boundKey, vertices }`), `reconstructPath(target)`, `getEdges(nodeId)`.
- **Fields:** `shortestPaths` (`Map<id, distance>`), `nodeIDs` (`Set`), `hops` / `preds`
  (canonical tie-break mirror). _(2.0 also exposed `adjacency` and `graph`; both were
  **removed in 3.0** — see the 2.x → 3.0 section above.)_

## What is explicitly internal

Everything not listed above is an **implementation detail** and may change in a **minor**
release — using it was never a supported contract:

- The algorithm-internal modules, which are **not** re-exported from `index.mjs`: the Lemma 3.3
  block list, the indexed min-heap, `BaseCase`, `FindPivots`, the balanced-BST bound index, the
  linear-time selection, and the tie-break helpers.
- The `BMSSP` class's dense-index engine members: `csr`, `labels`, `ids`, `indexOf`,
  `bmsspIndex`, `syncLabelsIn`/`syncLabelsOut`, `boundToEngine`/`keyToPublic`, `normalizeSources`,
  `buildIndex`, `deriveParameters`, `initializeShortestPaths`, and the derived parameters
  `k` / `t` / `topLevel` / `ties`.

These carry `@internal` in their JSDoc. If you depended on any of them, pin to the exact
version you tested against and open an issue describing the use case — some may be worth
promoting to the public surface deliberately in a future minor.

## Version cadence

Since 2.0.0 the project follows [semver](https://semver.org/): a released version bumps on a
bug fix (patch) or a milestone-closing feature set (minor, or major for a milestone named after
a major version). Most merged PRs ship no release; their work reaches npm with the next
milestone-closing release.
