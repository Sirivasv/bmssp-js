# bmssp-js benchmark run

_Generated 2026-07-15T17:22:57.519Z · node v26.5.0 · darwin/arm64_

## Adjacency map vs linear scan (#45)

Graph: 20000 nodes, 80000 edges · 5000 random per-node edge lookups.

| method | median ms | per lookup µs |
| --- | --- | --- |
| linear scan (pre-#45) | 376.33 | 75.27 |
| adjacency map (#45) | 0.12 | 0.02 |

**Speedup: 3149.2x** faster per-node lookups with the map.

## Graph-shape scenarios (Dijkstra baseline)

| scenario | nodes | edges | construct ms | dijkstra ms | notes |
| --- | --- | --- | --- | --- | --- |
| sparse-random | 50000 | 150000 | 20.68 | 45.72 | m = O(n), degree 3 — the road-network regime |
| dense-random | 8000 | 256000 | 18.53 | 14.89 | avg degree 32 — edge-relaxation-bound |
| grid-4nbr | 40000 | 159200 | 13.84 | 26.18 | 200x200 lattice — large diameter, low degree |
| chain | 50000 | 49999 | 8.65 | 8.96 | single long path — worst-case depth |
| star | 50000 | 99998 | 14.46 | 38.45 | one hub, n-1 spokes — extreme degree skew |
