FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

ARG NEXT_PUBLIC_RELAY_URL
ARG NEXT_PUBLIC_CONTROL_SECRET
ENV NEXT_PUBLIC_RELAY_URL=$NEXT_PUBLIC_RELAY_URL
ENV NEXT_PUBLIC_CONTROL_SECRET=$NEXT_PUBLIC_CONTROL_SECRET

COPY . .
RUN npm run build

# Production image — installs only runtime deps, no standalone needed
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000
CMD ["npm", "start"]
