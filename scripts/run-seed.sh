#!/usr/bin/env bash
#
# run-seed.sh - Seed Firebase Emulators with test data
#
# This script:
# 1. Checks if emulators are running
# 2. Waits for emulators to be ready
# 3. Executes the seed script
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
EMULATOR_UI_URL="http://localhost:4000"
FIRESTORE_URL="http://localhost:8081"
AUTH_URL="http://localhost:9099"
MAX_WAIT_SECONDS=60
POLL_INTERVAL=2

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_emulator() {
    local url=$1
    local name=$2

    if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|302"; then
        return 0
    fi
    return 1
}

wait_for_emulators() {
    log_info "Waiting for Firebase Emulators to be ready..."

    local elapsed=0

    while [ $elapsed -lt $MAX_WAIT_SECONDS ]; do
        local ui_ready=false
        local firestore_ready=false
        local auth_ready=false

        # Check Emulator UI
        if check_emulator "$EMULATOR_UI_URL" "Emulator UI"; then
            ui_ready=true
        fi

        # Check Firestore (returns empty JSON when ready)
        if curl -s "$FIRESTORE_URL" >/dev/null 2>&1; then
            firestore_ready=true
        fi

        # Check Auth (returns JSON when ready)
        if curl -s "${AUTH_URL}/emulator/v1/projects/demo-sentient-archive/config" >/dev/null 2>&1; then
            auth_ready=true
        fi

        if [ "$ui_ready" = true ] && [ "$firestore_ready" = true ] && [ "$auth_ready" = true ]; then
            log_info "All emulators are ready!"
            return 0
        fi

        echo -n "."
        sleep $POLL_INTERVAL
        elapsed=$((elapsed + POLL_INTERVAL))
    done

    echo ""
    log_error "Timeout waiting for emulators after ${MAX_WAIT_SECONDS} seconds"
    return 1
}

# Main execution
main() {
    echo ""
    echo "=========================================="
    echo "  Firebase Emulator Seed Script"
    echo "=========================================="
    echo ""

    # Check if emulators are running
    log_info "Checking if emulators are running..."

    if ! curl -s -o /dev/null "$EMULATOR_UI_URL"; then
        log_error "Firebase Emulators don't appear to be running."
        log_error "Please start them first with: npm run emulators:start"
        log_error "Or: docker compose up -d"
        exit 1
    fi

    # Wait for all emulators to be fully ready
    if ! wait_for_emulators; then
        log_error "Failed to connect to emulators. Please check they are running correctly."
        exit 1
    fi

    echo ""
    log_info "Running seed script..."
    echo ""

    # Set environment variables for the seed script
    export FIRESTORE_EMULATOR_HOST="localhost:8081"
    export FIREBASE_AUTH_EMULATOR_HOST="localhost:9099"

    # Get the script directory
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

    # Run the seed script with tsx (better ESM support)
    cd "$PROJECT_DIR"
    npx tsx scripts/seed-emulator.ts

    echo ""
    log_info "Seed complete! Access the Emulator UI at: $EMULATOR_UI_URL"
}

main "$@"
