FROM node:24-alpine@sha256:d1b3b4da11eefd5941e7f0b9cf17783fc99d9c6fc34884a665f40a06dbdfc94f

WORKDIR /bmssp-js

RUN npm install bmssp@latest

COPY examples/main.mjs .

CMD ["node", "main.mjs"]
