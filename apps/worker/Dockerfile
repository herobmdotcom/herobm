FROM node:22-bookworm-slim

WORKDIR /app

COPY apps/worker ./apps/worker

WORKDIR /app/apps/worker
RUN apt-get update && apt-get install -y --no-install-recommends libfaketime && rm -rf /var/lib/apt/lists/*
RUN npm install

EXPOSE 9090

CMD ["npm", "start"]
