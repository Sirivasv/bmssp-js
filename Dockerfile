FROM node:26-alpine@sha256:a2dc166a387cc6ca1e62d0c8e265e49ca985d6e60abc9fe6e6c3d6ce8e63f606

WORKDIR /bmssp-js

RUN npm install bmssp@latest

COPY examples/main.mjs .

CMD ["node", "main.mjs"]
