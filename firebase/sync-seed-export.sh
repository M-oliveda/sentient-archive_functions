#!/usr/bin/env bash
#
# Manually export running emulator state and sync to the persistent bind mount.
#

set -euo pipefail

IMPORT_DIR="./seed"
EXPORT_DIR="./seed-export"
PROJECT_ID="demo-sentient-archive"

echo "Exporting emulator data to ${EXPORT_DIR}..."
rm -rf "${EXPORT_DIR}"
firebase emulators:export "${EXPORT_DIR}" --project "${PROJECT_ID}" --force

echo "Syncing export to persistent storage (${IMPORT_DIR})..."
find "${IMPORT_DIR}" -mindepth 1 -delete 2>/dev/null || true
cp -a "${EXPORT_DIR}/." "${IMPORT_DIR}/"

echo "Export synced successfully to ${IMPORT_DIR}"
