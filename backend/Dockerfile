FROM node:22-alpine

ENV NODE_ENV=production

WORKDIR /app/backend

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

RUN mkdir -p uploads/input uploads/outputs

EXPOSE 5000

CMD ["node", "src/server.js"]
