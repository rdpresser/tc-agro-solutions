# ==============================================================================
# Multi-stage Dockerfile for TC Agro Solutions Frontend POC
# ==============================================================================
# Stage 1: Build - Uses Node.js Alpine for minimal image size
# Stage 2: Runtime - Uses Nginx Alpine to serve static files
# Optimized for AKS deployment with best practices
# ==============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build Stage
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

# Base path for Vite build (default for k8s ingress)
ARG VITE_BASE_PATH=/agro/
ENV VITE_BASE_PATH=${VITE_BASE_PATH}

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./

# Install dependencies (clean install for reproducible builds)
RUN npm ci --only=production=false \
    && npm cache clean --force

# Copy application source code
COPY . .

# Build the application (base path driven by VITE_BASE_PATH)
RUN npm run build

# Verify build output exists
RUN ls -la dist/

# -----------------------------------------------------------------------------
# Stage 2: Production Runtime Stage
# -----------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

# Install curl for health checks (lightweight)
RUN apk add --no-cache curl

# Remove default nginx static assets and config
RUN rm -rf /usr/share/nginx/html/* \
    && rm /etc/nginx/conf.d/default.conf

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built application from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Create non-root user for security best practices
RUN addgroup -g 1001 -S appuser \
    && adduser -u 1001 -S appuser -G appuser \
    && chown -R appuser:appuser /usr/share/nginx/html \
    && chown -R appuser:appuser /var/cache/nginx \
    && chown -R appuser:appuser /var/log/nginx \
    && chown -R appuser:appuser /etc/nginx/conf.d \
    && touch /var/run/nginx.pid \
    && chown -R appuser:appuser /var/run/nginx.pid

# Switch to non-root user
USER appuser

# Expose port 8080 (non-privileged port for AKS compatibility)
EXPOSE 8080

# Health check configuration for Kubernetes probes
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/ || exit 1

# Labels for metadata and traceability
LABEL maintainer="TC Agro Solutions Team" \
      version="1.0" \
      description="TC Agro Solutions Dashboard POC - Frontend" \
      org.opencontainers.image.source="https://github.com/rdpresser/tc-agro-solutions"

# Start nginx in foreground mode
CMD ["nginx", "-g", "daemon off;"]
