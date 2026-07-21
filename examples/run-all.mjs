// Runs every example in order with a header between each. This is the
// default command of the Docker image (`docker run … sirivasv/bmssp-js`),
// and can be run directly after `npm install bmssp`: `node run-all.mjs`.

import { run as basic } from "./01-basic.mjs";
import { run as oracle } from "./02-dijkstra-oracle.mjs";
import { run as constantDegree } from "./03-constant-degree.mjs";
import { run as largerGraph } from "./04-larger-graph.mjs";
import { run as flexibleInputs } from "./05-flexible-inputs.mjs";
import { run as multiSource } from "./06-multi-source.mjs";

const examples = [
  ["01 · Basic shortest paths & path reconstruction", basic],
  ["02 · Validate against the Dijkstra oracle", oracle],
  ["03 · Opt-in constant-degree transform", constantDegree],
  ["04 · A larger generated grid graph", largerGraph],
  ["05 · Flexible graph inputs (Graph builder / adjacency)", flexibleInputs],
  ["06 · Multi-source & bounded runs", multiSource],
];

const rule = "─".repeat(64);
for (const [title, fn] of examples) {
  console.log(`\n${rule}\n  ${title}\n${rule}`);
  fn();
}
console.log(
  `\n${rule}\n  Done. Edit these files or mount your own — see the README.\n${rule}`,
);
