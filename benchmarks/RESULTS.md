# bmssp-js benchmark run

_Generated 2026-07-21T08:24:31.434Z · node v26.5.0 · darwin/arm64_

## Adjacency map vs linear scan (#45)

Graph: 20000 nodes, 80000 edges · 5000 random per-node edge lookups.

| method | median ms | per lookup µs |
| --- | --- | --- |
| linear scan (pre-#45) | 417.98 | 83.60 |
| adjacency map (#45) | 0.12 | 0.02 |

**Speedup: 3471.1x** faster per-node lookups with the map.

## Graph-shape scenarios — BMSSP vs Dijkstra (#170)

Algorithm time only: both sides consume the same prebuilt adjacency Map; `mismatches` must read 0 (outputs verified node-by-node every run).

| scenario | nodes | edges | construct ms | dijkstra ms | bmssp ms | ratio | mismatches | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sparse-random | 50000 | 150000 | 30.04 | 42.90 | 95.82 | 2.23x | 0 | m = O(n), degree 3 — the road-network regime |
| dense-random | 8000 | 256000 | 16.88 | 14.83 | 69.64 | 4.70x | 0 | avg degree 32 — edge-relaxation-bound |
| grid-4nbr | 40000 | 159200 | 13.26 | 16.00 | 67.33 | 4.21x | 0 | 200x200 lattice — large diameter, low degree |
| chain | 50000 | 49999 | 8.04 | 6.08 | 44.65 | 7.35x | 0 | single long path — worst-case depth |
| star | 50000 | 99998 | 11.67 | 37.70 | 144.11 | 3.82x | 0 | one hub, n-1 spokes — extreme degree skew (#182) |
| sparse-random-l4 | 300000 | 900000 | 184.34 | 419.21 | 1246.14 | 2.97x | 0 | n just past the topLevel 3→4 step at n = 2^18 (#182) |

## Comparison counts — the sorting barrier, measured (#170)

Comparisons between path lengths (the paper's cost metric), one exact run per side. On sparse graphs the ratio falls with n and crosses below 1.0 between n = 200k and n = 1M.

| case | nodes | edges | dijkstra cmps | bmssp cmps | ratio | mismatches |
| --- | --- | --- | --- | --- | --- | --- |
| sparse d3 n=50k | 50000 | 150000 | 1,653,644 | 1,976,506 | 1.20x | 0 |
| sparse d3 n=200k | 200000 | 600000 | 7,509,518 | 7,720,650 | 1.03x | 0 |
| sparse d3 n=1M | 1000000 | 3000000 | 42,809,732 | 42,123,299 | 0.98x | 0 |
| grid 700x700 | 490000 | 1957200 | 15,269,647 | 19,330,072 | 1.27x | 0 |
