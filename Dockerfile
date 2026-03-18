# Use the official Node.js image.
# https://hub.docker.com/_/node
FROM node:20-slim AS builder

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
COPY package*.json ./

# Install dependencies including devDependencies for building.
RUN npm install

# Copy local code to the container image.
COPY . .

# Build the application.
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install only production dependencies.
RUN npm install --omit=dev

# Copy built assets from builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Expose the port the app runs on
EXPOSE 3000

# Run the web service on container startup.
CMD [ "npm", "start" ]
