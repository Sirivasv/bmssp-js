FROM node:26-alpine@sha256:143494b1da2945f061539253adc65e4f1569ddf07da2d384c022c791a9d90a4a

LABEL org.opencontainers.image.title="bmssp-js" \
      org.opencontainers.image.description="Pre-configured playground for the bmssp package — runs the bundled examples." \
      org.opencontainers.image.source="https://github.com/Sirivasv/bmssp-js" \
      org.opencontainers.image.licenses="MPL-2.0"

WORKDIR /bmssp-js

# Install the published package. `--omit=dev` keeps the image lean; there is
# no application package.json here — bmssp is the only dependency.
RUN npm install --omit=dev bmssp@latest

# Bundle the example gallery (imports from the installed `bmssp` package).
COPY examples/ ./examples/

# Default: run every example in order. Override with e.g.
#   docker run --rm sirivasv/bmssp-js node examples/01-basic.mjs
CMD ["node", "examples/run-all.mjs"]
