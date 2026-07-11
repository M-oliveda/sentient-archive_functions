FROM node:24-alpine

# Install Java (required for Firestore emulator) and required tools
RUN apk add --no-cache openjdk21-jre curl bash

# Install Firebase CLI globally (pinned version for stability)
RUN npm install -g firebase-tools@latest

# Set working directory
WORKDIR /app

# Emulator helper scripts (import/export with separate paths)
COPY start-emulators.sh sync-seed-export.sh /app/
RUN chmod +x /app/start-emulators.sh /app/sync-seed-export.sh

# Expose emulator ports
EXPOSE 4000 5001 8080 9099 9199

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:4000 || exit 1

# Default command (overridden by docker-compose)
CMD ["/app/start-emulators.sh"]
