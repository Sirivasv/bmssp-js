# Test Suite

This directory contains the comprehensive test suite for the BMSSP (Bidirectional Multi-Source Shortest Path) JavaScript implementation.

## Overview

The test suite includes:
- Unit tests for core algorithm functions
- Code coverage reports

## Test Structure

### Unit Tests
- **Location**: `main.test.mjs`
- **Framework**: Jest
- **Coverage**: Core algorithm functions, utility methods, error handling

## Datasets

### California Road Network
- **File**: `roadNet-CA.txt`
- **Source**: [Stanford Network Analysis Project (SNAP)](https://snap.stanford.edu/data/roadNet-CA.html)
- **Type**: Directed graph (each unordered pair of nodes is saved once)
- **Statistics**:
  - Nodes: 1,965,206
  - Edges: 5,533,214
- **Format**: Tab-separated values
  - Column 1: FromNodeId
  - Column 2: ToNodeId
- **Description**: Large-scale road network from California state, ideal for testing shortest path algorithms on realistic transportation graphs.

## Test Categories

### 1. Core Algorithm Tests
- BMSSP algorithm correctness
- Bidirectional search functionality
- Multi-source initialization
- Path reconstruction

### 2. Edge Cases
- Empty graphs
- Single node graphs
- Disconnected components
- Negative weights (if supported)

### 3. Performance Tests
- Large dataset processing
- Memory efficiency
- Scalability with different graph sizes

## Benchmarking

Performance benchmarks compare against standard Dijkstra's algorithm

Metrics to be tracked:
- Execution time
- Memory consumption
- Accuracy of results

## Contributing to Tests

When adding new tests:
1. Follow existing naming conventions
2. Include both positive and negative test cases
3. Add performance tests for new algorithms
4. Update documentation for new datasets
5. Ensure tests pass linting requirements
