FROM node:20-alpine

# better-sqlite3 needs python3, make, and g++ to compile native bindings
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p data transcripts

CMD ["node", "src/index.js"]
