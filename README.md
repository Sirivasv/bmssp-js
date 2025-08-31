# BMSSP: Bounded Multi-Source Shortest Paths
[![codecov](https://codecov.io/gh/sirivasv/bmssp-js/branch/main/graph/badge.svg)](https://codecov.io/gh/sirivasv/bmssp-js)
[![npm version](https://img.shields.io/npm/v/bmssp.svg)](https://www.npmjs.com/package/bmssp)
[![Docker Image Version](https://img.shields.io/docker/v/sirivasv/bmssp-js?label=docker&sort=semver)](https://hub.docker.com/r/sirivasv/bmssp-js)
[![GitHub Repo stars](https://img.shields.io/github/stars/sirivasv/bmssp-js?style=social)](https://github.com/sirivasv/bmssp-js/stargazers)

This repository provides a community-driven JavaScript implementation of the Tsinghua Single Source Shortest Paths algorithm, based on the paper ["Breaking the Sorting Barrier for Directed Single-Source Shortest Paths"](https://dl.acm.org/doi/10.1145/3717823.3718179) by Duan Ran et al. from Tsinghua University.

BMSSP stands for Bounded Multi-Source Shortest Paths.

## Project Overview

- **Language:** JavaScript (ES Modules)
- **Goal:** Provide an easy-to-use, modern implementation of the algorithm, published to [npmjs.com](https://www.npmjs.com/).
- **Reference:** For more on ES modules, see the [MDN documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules).


## Installation

To install this package, you can use npm:

```bash
npm install bmssp
```

## Usage

To use this package, you can import it in your JavaScript code as follows:

```javascript
import { printMessage, processMessage } from "bmssp";

printMessage("Hello, World!");
processMessage("Hello, World!");
```

The file must use ECMAScript modules (ESM) syntax and have the `.mjs` file extension. Go to the `examples` directory for more usage examples.

### Using the docker image

You can also use the published docker image and run your tests (assuming a `mytest.mjs` in this example) in a pre-configured environment:

```bash
docker run -it -v ./mytest.mjs:/bmssp-js/mytest.mjs sirivasv/bmssp-js:latest node /bmssp-js/mytest.mjs
```

Other versions of the docker image can be found on [Docker Hub](https://hub.docker.com/r/sirivasv/bmssp-js/tags).

### Other Implementations in GitHub

https://github.com/search?q=bmssp&type=repositories

