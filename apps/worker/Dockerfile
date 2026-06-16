FROM node:22-bookworm-slim

WORKDIR /app

COPY apps/worker ./apps/worker

WORKDIR /app/apps/worker
RUN npm install

EXPOSE 9090

CMD ["npm", "start"]
