FROM node:24-alpine

WORKDIR /bmssp-js

RUN npm install bmssp

COPY examples/main.js .

CMD ["node", "main.js"]
