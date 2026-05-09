FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY tsconfig.json ./
COPY src ./src
RUN npm install typescript ts-node-dev --save-dev && npx tsc

# Create uploads directory
RUN mkdir -p /app/uploads

EXPOSE 4000
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
