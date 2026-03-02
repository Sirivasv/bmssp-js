FROM node:24-alpine@sha256:7fddd9ddeae8196abf4a3ef2de34e11f7b1a722119f91f28ddf1e99dcafdf114

WORKDIR /bmssp-js

RUN npm install bmssp@latest

COPY examples/main.mjs .

CMD ["node", "main.mjs"]
