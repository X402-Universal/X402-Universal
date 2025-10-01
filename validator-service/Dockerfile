# Use the official Node.js image
FROM node:22.20.0

# Set the working directory
WORKDIR /app

# Copy the validator-service directory into the container
COPY validator-service/ .

# Install dependencies
RUN npm install

# Build the app (if using TypeScript)
RUN npm run build

# Expose the port
EXPOSE 3000

# Start the app
CMD ["npm", "start"]