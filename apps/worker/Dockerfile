FROM node:22-alpine

WORKDIR /app

COPY packages/erpnext-client ./packages/erpnext-client
COPY apps/worker ./apps/worker

WORKDIR /app/apps/worker
RUN npm install

EXPOSE 9090

CMD ["npm", "start"]
