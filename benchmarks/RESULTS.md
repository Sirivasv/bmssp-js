# bmssp-js benchmark run

_Generated 2026-07-21T10:18:01.877Z · node v26.5.0 · darwin/arm64_

## Adjacency map vs linear scan (#45)

Graph: 20000 nodes, 80000 edges · 5000 random per-node edge lookups.

| method | median ms | per lookup µs |
| --- | --- | --- |
| linear scan (pre-#45) | 372.80 | 74.56 |
| adjacency map (#45) | 0.09 | 0.02 |

**Speedup: 4003.2x** faster per-node lookups with the map.

## Graph-shape scenarios — BMSSP vs Dijkstra (#170)

Algorithm time only: both sides consume the same prebuilt adjacency Map; `mismatches` must read 0 (outputs verified node-by-node every run).

| scenario | nodes | edges | construct ms | dijkstra ms | bmssp ms | ratio | mismatches | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sparse-random | 50000 | 150000 | 28.68 | 35.03 | 86.20 | 2.46x | 0 | m = O(n), degree 3 — the road-network regime |
| dense-random | 8000 | 256000 | 17.55 | 13.48 | 60.66 | 4.50x | 0 | avg degree 32 — edge-relaxation-bound |
| grid-4nbr | 40000 | 159200 | 12.18 | 17.68 | 69.64 | 3.94x | 0 | 200x200 lattice — large diameter, low degree |
| chain | 50000 | 49999 | 7.81 | 5.03 | 37.39 | 7.43x | 0 | single long path — worst-case depth |
| star | 50000 | 99998 | 9.09 | 28.82 | 130.66 | 4.53x | 0 | one hub, n-1 spokes — extreme degree skew (#182) |
| sparse-random-l4 | 300000 | 900000 | 166.84 | 365.42 | 1082.77 | 2.96x | 0 | n just past the topLevel 3→4 step at n = 2^18 (#182) |

## Comparison counts — the sorting barrier, measured (#170)

Comparisons between path lengths (the paper's cost metric), one exact run per side. On sparse graphs the ratio falls with n and is already below 1.0 at n = 50k (since #167's selection-based BlockList; it was ~n = 1M before).

| case | nodes | edges | dijkstra cmps | bmssp cmps | ratio | mismatches |
| --- | --- | --- | --- | --- | --- | --- |
| sparse d3 n=50k | 50000 | 150000 | 1,653,644 | 1,607,005 | 0.97x | 0 |
| sparse d3 n=200k | 200000 | 600000 | 7,509,518 | 5,763,228 | 0.77x | 0 |
| sparse d3 n=1M | 1000000 | 3000000 | 42,809,732 | 28,321,521 | 0.66x | 0 |
| grid 700x700 | 490000 | 1957200 | 15,269,647 | 17,061,608 | 1.12x | 0 |
