# Use Node.js with Playwright pre-installed
# Version must match playwright package in scripts/restaurant-registration/package.json
FROM mcr.microsoft.com/playwright:v1.54.0-jammy

# Set working directory
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV HEADLESS=true

# Copy package files first (for Docker layer caching)
COPY UberEats-Image-Extractor/package*.json ./UberEats-Image-Extractor/
COPY scripts/restaurant-registration/package*.json ./scripts/restaurant-registration/

# Install UberEats-Image-Extractor dependencies
# Note: --legacy-peer-deps needed for react-day-picker (requires React 18) with React 19
WORKDIR /app/UberEats-Image-Extractor
RUN npm ci --omit=dev --legacy-peer-deps

# Install scripts dependencies
WORKDIR /app/scripts/restaurant-registration
RUN npm ci --omit=dev --legacy-peer-deps

# Copy application code
WORKDIR /app
COPY UberEats-Image-Extractor/ ./UberEats-Image-Extractor/
COPY scripts/ ./scripts/

# Create directories for runtime files
RUN mkdir -p /app/extracted-menus /app/generated-code /tmp/csv-uploads

# Set working directory for the app
WORKDIR /app/UberEats-Image-Extractor

# Expose the port Railway will use (dynamic via $PORT env var)
# Railway ignores EXPOSE and uses PORT env var instead
EXPOSE 3007

# Note: Railway handles health checks via railway.json, not Docker HEALTHCHECK
# The health endpoint is at /api/health

# Start the server
CMD ["node", "server.js"]