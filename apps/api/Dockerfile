FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache typst font-dejavu \
    && npm install -g npm@11

# Copy shared workspace package (file: dependency)
COPY packages/shared ./packages/shared

# Build API
WORKDIR /app/apps/api
COPY apps/api/package*.json ./
RUN npm ci

ENV NODE_ENV=production

COPY apps/api ./
RUN npm test
RUN npm run build
RUN npm prune --omit=dev

EXPOSE 3001

CMD ["node", "dist/main.js"]
