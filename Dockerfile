FROM node:24-alpine

WORKDIR /bmssp-js

RUN npm install bmssp@latest

COPY examples/main.mjs .

CMD ["node", "main.mjs"]
