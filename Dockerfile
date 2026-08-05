# Use official lightweight Node.js Alpine image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies first (leverages Docker cache)
COPY package*.json ./
RUN npm install

# Copy application source code
COPY . .

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Build Next.js application
RUN npm run build

# Expose port
EXPOSE 3000

# Start Next.js production server
CMD ["npm", "start"]