# Backend Dockerfile - suitable for Render, Railway, or Docker hosting
FROM node:18-alpine
WORKDIR /app

# Install deps
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3001

# Runtime
CMD ["node", "dist/server.js"]
