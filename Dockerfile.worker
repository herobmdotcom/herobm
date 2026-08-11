FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/db-schema/package.json ./packages/db-schema/
COPY apps/worker/package.json ./apps/worker/

WORKDIR /app
RUN npm install

WORKDIR /app
COPY packages/shared ./packages/shared
COPY packages/db-schema ./packages/db-schema
COPY apps/worker ./apps/worker

WORKDIR /app
RUN npm run build -w packages/shared
RUN npm run build -w packages/db-schema

EXPOSE 9090

WORKDIR /app/apps/worker
CMD ["npm", "start"]
