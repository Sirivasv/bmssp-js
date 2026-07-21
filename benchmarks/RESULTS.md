# bmssp-js benchmark run

_Generated 2026-07-21T07:44:53.485Z · node v26.5.0 · darwin/arm64_

## Adjacency map vs linear scan (#45)

Graph: 20000 nodes, 80000 edges · 5000 random per-node edge lookups.

| method | median ms | per lookup µs |
| --- | --- | --- |
| linear scan (pre-#45) | 415.92 | 83.18 |
| adjacency map (#45) | 0.13 | 0.03 |

**Speedup: 3295.5x** faster per-node lookups with the map.

## Graph-shape scenarios — BMSSP vs Dijkstra (#170)

Algorithm time only: both sides consume the same prebuilt adjacency Map; `mismatches` must read 0 (outputs verified node-by-node every run).

| scenario | nodes | edges | construct ms | dijkstra ms | bmssp ms | ratio | mismatches | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sparse-random | 50000 | 150000 | 31.36 | 36.72 | 102.29 | 2.79x | 0 | m = O(n), degree 3 — the road-network regime |
| dense-random | 8000 | 256000 | 19.15 | 14.02 | 67.88 | 4.84x | 0 | avg degree 32 — edge-relaxation-bound |
| grid-4nbr | 40000 | 159200 | 14.44 | 18.70 | 76.75 | 4.10x | 0 | 200x200 lattice — large diameter, low degree |
| chain | 50000 | 49999 | 8.26 | 5.14 | 45.56 | 8.87x | 0 | single long path — worst-case depth |
| star | 50000 | 99998 | 10.55 | 35.21 | 307.51 | 8.73x | 0 | one hub, n-1 spokes — extreme degree skew (#182) |
| sparse-random-l4 | 300000 | 900000 | 183.69 | 419.20 | 1305.50 | 3.11x | 0 | n just past the topLevel 3→4 step at n = 2^18 (#182) |

## Comparison counts — the sorting barrier, measured (#170)

Comparisons between path lengths (the paper's cost metric), one exact run per side. On sparse graphs the ratio falls with n and crosses below 1.0 between n = 200k and n = 1M.

| case | nodes | edges | dijkstra cmps | bmssp cmps | ratio | mismatches |
| --- | --- | --- | --- | --- | --- | --- |
| sparse d3 n=50k | 50000 | 150000 | 1,653,644 | 1,976,506 | 1.20x | 0 |
| sparse d3 n=200k | 200000 | 600000 | 7,509,518 | 7,720,650 | 1.03x | 0 |
| sparse d3 n=1M | 1000000 | 3000000 | 42,809,732 | 42,123,299 | 0.98x | 0 |
| grid 700x700 | 490000 | 1957200 | 15,269,647 | 19,330,072 | 1.27x | 0 |
