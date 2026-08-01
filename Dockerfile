# Use official Bun runtime as base image
FROM oven/bun:1 AS base

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy configuration and source files
COPY config ./config
COPY src ./src

# Change ownership to non-root user
RUN chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e "fetch('http://localhost:5000/health').then(r => r.ok ? process.exit(0) : process.exit(1))" || exit 1

# Environment variables documentation
ENV NODE_ENV=production

# Labels for metadata (version set at build time from package.json)
LABEL maintainer="maptile-cache" \
      description="Map tile caching service with S3 backend" \
      org.opencontainers.image.source="https://github.com/Muromi-Rikka/maptile-cache" \
      org.opencontainers.image.version="1.1.5"

# Start the application
CMD ["bun", "run", "start"]