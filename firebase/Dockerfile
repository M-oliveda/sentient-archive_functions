FROM node:24-alpine

# Install Java (required for Firestore emulator) and required tools
RUN apk add --no-cache openjdk21-jre curl bash

# Install Firebase CLI globally (pinned version for stability)
RUN npm install -g firebase-tools@latest

# Set working directory
WORKDIR /app

# Expose emulator ports
EXPOSE 4000 5001 8080 9099 9199

# Create directory for emulator data (will be overridden by volume mount)
RUN mkdir -p seed-data

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:4000 || exit 1

# Default command (overridden by docker-compose)
CMD ["firebase", "emulators:start", "--import=./seed-data", "--export-on-exit", "--project", "demo-sentient-archive"]