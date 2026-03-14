# Stage 1: Builder
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src ./src
COPY migrations ./migrations
COPY scripts ./scripts
COPY public ./public

# Stage 2: Runtime
FROM node:22-alpine AS runner
RUN apk add --no-cache mysql-client

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/public ./public
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENV NODE_ENV=production

ENTRYPOINT ["./docker-entrypoint.sh"]
