# Stage 1: Build Svelte frontend
FROM node:22-alpine AS frontend
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build
# Output lands at /build/internal/server/web/dist (vite outDir: '../internal/server/web/dist')

# Stage 2: Build Go binary
FROM golang:1.25-alpine AS builder
WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
# Copy full source first (includes any placeholder web/dist)
COPY . .
# Overwrite with the real frontend build from stage 1
COPY --from=frontend /build/internal/server/web/dist ./internal/server/web/dist
ENV CGO_ENABLED=0 GOOS=linux
RUN go build -trimpath -ldflags='-s -w' -o /out/meetinglog ./cmd/meetinglog

# Stage 3: Minimal distroless image
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /out/meetinglog /meetinglog
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["/meetinglog", "-healthcheck"]
ENTRYPOINT ["/meetinglog"]
