import { BMSSP } from "bmssp";

const myBMSSP = new BMSSP([
  [0, 1, 50],
  [1, 2, 75],
  [0, 2, 25],
]);

console.log(myBMSSP.graph);
