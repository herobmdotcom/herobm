FROM docker.io/library/node:22-bookworm-slim

WORKDIR /app
COPY package*.json ./
COPY apps/sim-engine/package.json ./apps/sim-engine/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/sdk ./packages/sdk

RUN npm install

RUN cd /app/packages/sdk && npm run build

COPY apps/sim-engine ./apps/sim-engine
WORKDIR /app/apps/sim-engine
RUN npm run build

EXPOSE 3005
CMD ["npx", "ts-node", "--esm", "src/server/server.ts"]
