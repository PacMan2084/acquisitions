FROM node:20-alpine

WORKDIR /usr/src/app

# Copy package metadata and install dependencies
COPY package*.json ./
RUN npm ci

# Copy application source
COPY . .

# Default to production mode inside the container
ENV NODE_ENV=production

# Expose the HTTP port used by the app
EXPOSE 3000

# Add this near the end, before CMD
RUN npx drizzle-kit generate || true

# Start the app using the npm start script
CMD ["sh", "-c", "npx drizzle-kit push --force && npm start"]
