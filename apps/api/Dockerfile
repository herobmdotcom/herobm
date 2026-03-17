FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache typst font-dejavu

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm test
RUN npm run build
RUN npm prune --omit=dev

EXPOSE 3001

CMD ["node", "dist/main.js"]
