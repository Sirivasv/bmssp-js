# Tsinghua Single Source Shortest Paths algorithm

This is a repository containing implementation varieties based on the paper written by Duan Ran et. al. from Tsinghua University.
"Breaking the Sorting Barrier for Directed Single-Source Shortest Paths".

https://dl.acm.org/doi/10.1145/3717823.3718179

BMSSP - Bounded multi-source shortest paths.

## Abstract

We give a deterministic O(mlog2/3n)-time algorithm for single-source shortest paths (SSSP) on directed graphs with real non-negative edge weights in the comparison-addition model. This is the first result to break the O(m+nlogn) time bound of Dijkstra’s algorithm on sparse graphs, showing that Dijkstra’s algorithm is not optimal for SSSP.

## Development Details

This project is mainly focused in implementations in C++ (std=c++20) and Javascript (in order to be published to npmjs.com via github Actions). It would be interesting to do the same to publish via pypi.org or crates.io.

### Other Implementations

Rust:
  - https://github.com/lucas-montes/bmssp - Available as a crate to pull.

Java:
  - https://github.com/PatrickDiallo23/BMSSP-Java

Python:
  - https://github.com/sidharthpunathil/fastest-shortest-path-algo-poc
  - https://github.com/simpsonresearch/tsinghua_benchmarks/tree/main
