# Use Node.js with Playwright pre-installed
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

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
WORKDIR /app/UberEats-Image-Extractor
RUN npm ci --omit=dev

# Install scripts dependencies
WORKDIR /app/scripts/restaurant-registration
RUN npm ci --omit=dev

# Copy application code
WORKDIR /app
COPY UberEats-Image-Extractor/ ./UberEats-Image-Extractor/
COPY scripts/ ./scripts/

# Create directories for runtime files
RUN mkdir -p /app/extracted-menus /app/generated-code /tmp/csv-uploads

# Set working directory for the app
WORKDIR /app/UberEats-Image-Extractor

# Expose ports
EXPOSE 3007
EXPOSE 5007

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3007/api/health || exit 1

# Start the server
CMD ["node", "server.js"]