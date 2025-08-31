FROM node:24-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Mount src/ directory as a volume
VOLUME ["src/", "test/"]

# Default command (can be overridden)
CMD ["node", "test/main.js"]
