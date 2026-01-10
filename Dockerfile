# Base stage
FROM node:24-alpine AS base

WORKDIR /app

# Copy package files
COPY package*.json ./

# Development stage
FROM base AS development

# Copy entrypoint script
COPY docker-entrypoint-dev.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint-dev.sh

# Expose port and debug port
EXPOSE 3000 9222

# Set environment variables
ENV NODE_ENV=development

# Set entrypoint
ENTRYPOINT ["docker-entrypoint-dev.sh"]

# Start with watch mode
CMD ["sh", "-c", "npm run build && npm run start"]

# Builder stage
FROM base AS builder

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY src ./src
COPY types ./types
COPY scripts ./scripts

# Build TypeScript
RUN npm run build

# Production stage
FROM base AS production

# Install only production dependencies
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts ./scripts

# Use non-root user
USER node

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Start the application
CMD ["npm", "run", "start"]
