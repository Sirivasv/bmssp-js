import { describe, test, expect } from "@jest/globals";
import { BMSSP } from "../index.mjs";
import fs from "fs";

let roadNetCA = (() => {
  let graph = [];
  const filePath = new URL("./roadNet-CA.txt", import.meta.url).pathname;
  const data = fs.readFileSync(filePath, "utf-8");
  data.split("\n").forEach((line) => {
    if (line.startsWith("#") || line.trim() === "") return;
    const [from, to] = line.trim().split(/\s+/).map(Number);
    if (!isNaN(from) && !isNaN(to)) {
      let min = 1,
        max = 1e8;
      let randomWeight = Math.floor(Math.random() * (max - min + 1)) + min;
      graph.push([from, to, randomWeight]);
    }
  });
  return graph;
})();

describe("BMSSP constructor", () => {
  test("initializes the graph correctly", () => {
    const myBMSSP = new BMSSP(roadNetCA);
    expect(myBMSSP.graph).toEqual(roadNetCA);
  });
});
