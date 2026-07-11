#!/usr/bin/env bash
#
# Starts Firebase emulators with separate import/export paths to avoid
# "Resource busy" errors when exporting to a bind-mounted directory on macOS.
#
# Import:  ./seed        (bind-mounted to host ./firebase/seed)
# Export:   ./seed-export (internal container path, not bind-mounted)
# On exit:  sync ./seed-export -> ./seed
#

set -euo pipefail

IMPORT_DIR="./seed"
EXPORT_DIR="./seed-export"
PROJECT_ID="demo-sentient-archive"

sync_export_to_seed() {
    if [[ ! -f "${EXPORT_DIR}/firebase-export-metadata.json" ]]; then
        echo "No export data found in ${EXPORT_DIR}, skipping sync."
        return 0
    fi

    echo "Syncing emulator export to persistent storage (${IMPORT_DIR})..."

    # Clear bind-mounted contents without removing the mount point
    find "${IMPORT_DIR}" -mindepth 1 -delete 2>/dev/null || true

    cp -a "${EXPORT_DIR}/." "${IMPORT_DIR}/"
    echo "Export synced successfully to ${IMPORT_DIR}"
}

cleanup() {
    sync_export_to_seed
}

forward_signal() {
    echo "Received shutdown signal, forwarding to emulators..."
    if [[ -n "${firebase_pid:-}" ]]; then
        kill -TERM "${firebase_pid}" 2>/dev/null || true
        # Poll up to 25s so the EXIT trap still has time to sync within the
        # 30s stop_grace_period Docker allows before sending SIGKILL.
        local i=0
        while kill -0 "${firebase_pid}" 2>/dev/null && (( i < 25 )); do
            sleep 1
            (( i++ )) || true
        done
        kill -KILL "${firebase_pid}" 2>/dev/null || true
        wait "${firebase_pid}" 2>/dev/null || true
    fi
}

trap cleanup EXIT
trap forward_signal SIGTERM SIGINT

rm -rf "${EXPORT_DIR}"

args=("--export-on-exit=${EXPORT_DIR}" "--project" "${PROJECT_ID}")

if [[ -f "${IMPORT_DIR}/firebase-export-metadata.json" ]]; then
    echo "Importing emulator data from ${IMPORT_DIR}..."
    args=("--import=${IMPORT_DIR}" "${args[@]}")
else
    echo "No import data found in ${IMPORT_DIR}, starting with clean state."
fi

echo "Starting Firebase Emulators..."
firebase emulators:start "${args[@]}" &
firebase_pid=$!
wait "${firebase_pid}"
