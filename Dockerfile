FROM node:24-alpine@sha256:01743339035a5c3c11a373cd7c83aeab6ed1457b55da6a69e014a95ac4e4700b

WORKDIR /bmssp-js

RUN npm install bmssp@latest

COPY examples/main.mjs .

CMD ["node", "main.mjs"]
