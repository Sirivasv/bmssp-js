// Example 6 — multi-source and bounded runs (#171).
//
// Standalone: after `npm install bmssp` run `node 06-multi-source.mjs`.
// `calculateShortestPathsFrom(sources, { bound })` runs the paper's
// BMSSP(l, B, S) generalization directly: from a SET of sources, each with an
// initial distance, optionally under a strict distance bound B. Results land
// in `shortestPaths`, exactly like `calculateShortestPaths`.

import { BMSSP } from "bmssp";

export function run() {
  const g = new BMSSP([
    [0, 1, 2],
    [1, 2, 3],
    [5, 2, 1],
    [2, 3, 4],
  ]);

  const show = (label) => {
    const row = [...g.nodeIDs]
      .sort((a, b) => a - b)
      .map((n) => `${n}:${g.shortestPaths.get(n)}`)
      .join("  ");
    console.log(`  ${label.padEnd(34)} ${row}`);
  };

  // Nearest of several sources (each seeded at distance 0). Node 2 is reached
  // at 1 via 5->2, beating 0->1->2 = 5.
  g.calculateShortestPathsFrom([0, 5]);
  show("nearest-of-many [0, 5]");

  // Sources with explicit initial distances. Giving source 5 a head start of
  // 10 flips node 2 to the 0->1->2 route (5) instead.
  g.calculateShortestPathsFrom([
    [0, 0],
    [5, 10],
  ]);
  show("with initial distances 0:0, 5:10");

  // Bounded run: only vertices with distance < B are completed; everything
  // else (including BMSSP's above-B over-estimates) is reported as Infinity.
  g.calculateShortestPathsFrom([0], { bound: 4 });
  show("from [0] under bound B = 4");

  console.log(
    "\nSources accept a Map, an object { id: dist }, [id, dist] pairs, " +
      "or a\nbare array of ids (each seeded at distance 0). bound defaults " +
      "to Infinity.",
  );
}

import { fileURLToPath } from "node:url";
if (process.argv[1] === fileURLToPath(import.meta.url)) run();
