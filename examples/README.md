# bmssp examples

A small gallery of standalone, copy-pasteable examples for the [`bmssp`](https://www.npmjs.com/package/bmssp)
package. Each file imports from the published package (`import { … } from "bmssp"`),
so after `npm install bmssp` you can run any of them directly:

```bash
node 01-basic.mjs
```

Or run the whole gallery at once (this is also the Docker image's default command):

```bash
node run-all.mjs
```

| File | Shows |
| --- | --- |
| [`01-basic.mjs`](01-basic.mjs) | `calculateShortestPaths()` and `reconstructPath()` on a tiny digraph |
| [`02-dijkstra-oracle.mjs`](02-dijkstra-oracle.mjs) | Validating BMSSP against the exported reference `dijkstra` oracle |
| [`03-constant-degree.mjs`](03-constant-degree.mjs) | The opt-in, distance-preserving `constantDegreeTransform` |
| [`04-larger-graph.mjs`](04-larger-graph.mjs) | Building a larger grid graph programmatically and timing a run |
| [`05-flexible-inputs.mjs`](05-flexible-inputs.mjs) | The four accepted input shapes (edge array / adjacency `Map` / object / `Graph` builder) and isolated vertices |
| [`06-multi-source.mjs`](06-multi-source.mjs) | `calculateShortestPathsFrom()` — nearest-of-many, custom initial distances, and bounded runs |
| [`run-all.mjs`](run-all.mjs) | Runs every example above in order |

## Running without installing (Docker)

The published image bundles these examples in a pre-configured Node environment:

```bash
docker run --rm sirivasv/bmssp-js:latest          # runs run-all.mjs
docker run --rm sirivasv/bmssp-js:latest node examples/01-basic.mjs
```

Mount your own script to run it in the same environment:

```bash
docker run --rm -v "$PWD/mine.mjs:/bmssp-js/mine.mjs" sirivasv/bmssp-js:latest node mine.mjs
```

See the [repository README](../README.md) for the full API reference.
