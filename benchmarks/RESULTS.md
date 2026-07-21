# bmssp-js benchmark run

_Generated 2026-07-21T10:59:44.802Z · node v26.5.0 · darwin/arm64_

## Adjacency map vs linear scan (#45)

Graph: 20000 nodes, 80000 edges · 5000 random per-node edge lookups.

| method | median ms | per lookup µs |
| --- | --- | --- |
| linear scan (pre-#45) | 419.89 | 83.98 |
| adjacency map (#45) | 0.11 | 0.02 |

**Speedup: 3797.0x** faster per-node lookups with the map.

## Graph-shape scenarios — BMSSP vs Dijkstra (#170)

Algorithm time only: both sides consume the same prebuilt adjacency Map; `mismatches` must read 0 (outputs verified node-by-node every run).

| scenario | nodes | edges | construct ms | dijkstra ms | bmssp ms | ratio | mismatches | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sparse-random | 50000 | 150000 | 26.20 | 37.11 | 103.34 | 2.78x | 0 | m = O(n), degree 3 — the road-network regime |
| dense-random | 8000 | 256000 | 24.04 | 16.98 | 43.95 | 2.59x | 0 | avg degree 32 — edge-relaxation-bound |
| grid-4nbr | 40000 | 159200 | 15.55 | 19.50 | 65.93 | 3.38x | 0 | 200x200 lattice — large diameter, low degree |
| chain | 50000 | 49999 | 10.18 | 6.59 | 43.18 | 6.55x | 0 | single long path — worst-case depth |
| star | 50000 | 99998 | 14.03 | 31.86 | 133.82 | 4.20x | 0 | one hub, n-1 spokes — extreme degree skew (#182) |
| sparse-random-l4 | 300000 | 900000 | 186.52 | 414.21 | 1031.01 | 2.49x | 0 | n just past the topLevel 3→4 step at n = 2^18 (#182) |

## Comparison counts — the sorting barrier, measured (#170)

Comparisons between path lengths (the paper's cost metric), one exact run per side. On sparse graphs the ratio falls with n and is already below 1.0 at n = 50k (since #167's selection-based BlockList; it was ~n = 1M before).

| case | nodes | edges | dijkstra cmps | bmssp cmps | ratio | mismatches |
| --- | --- | --- | --- | --- | --- | --- |
| sparse d3 n=50k | 50000 | 150000 | 1,653,644 | 1,578,336 | 0.95x | 0 |
| sparse d3 n=200k | 200000 | 600000 | 7,509,518 | 5,694,788 | 0.76x | 0 |
| sparse d3 n=1M | 1000000 | 3000000 | 42,809,732 | 28,034,859 | 0.65x | 0 |
| grid 700x700 | 490000 | 1957200 | 15,269,647 | 16,859,030 | 1.10x | 0 |
