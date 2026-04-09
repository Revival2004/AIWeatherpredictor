#!/bin/bash
set -e

WORKSPACE="$(cd "$(dirname "$0")/../.." && pwd)"

echo "[FarmPal] Python ML service disabled for Render deployment."
echo "[FarmPal] Starting standalone API server on port ${PORT:-5000}..."
cd "${WORKSPACE}"
exec node artifacts/api-server/dist/index.js
