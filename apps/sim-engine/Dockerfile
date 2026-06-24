FROM docker.io/library/node:22-bookworm-slim

WORKDIR /app
COPY package*.json ./
COPY apps/sim-engine/package.json ./apps/sim-engine/
RUN npm install

COPY apps/sim-engine ./apps/sim-engine
WORKDIR /app/apps/sim-engine
RUN npm run build

EXPOSE 3005
CMD ["npx", "ts-node", "--esm", "src/server/server.ts"]
