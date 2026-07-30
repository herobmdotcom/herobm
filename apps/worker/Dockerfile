FROM node:22-bookworm-slim

WORKDIR /app

COPY apps/worker ./apps/worker
COPY packages/shared ./packages/shared
COPY packages/db-schema ./packages/db-schema
COPY package.json package-lock.json ./

WORKDIR /app/apps/worker
RUN npm install
RUN npm run build -w packages/shared
RUN npm run build -w packages/db-schema

EXPOSE 9090

CMD ["npm", "start"]
