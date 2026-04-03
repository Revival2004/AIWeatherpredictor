#!/bin/bash

# Detect Python — works on Replit AND Render/Linux servers
PYTHON=$(command -v python3.11 2>/dev/null \
  || command -v python3 2>/dev/null \
  || echo "/home/runner/workspace/.pythonlibs/bin/python3.11")

WORKSPACE="$(cd "$(dirname "$0")/../.." && pwd)"

echo "[FarmPal] Starting ML service (sklearn ensemble)..."
cd "${WORKSPACE}/artifacts/api-server"
${PYTHON} -m gunicorn \
  --bind 0.0.0.0:5000 \
  --workers 1 \
  --timeout 300 \
  --daemon \
  --log-file /tmp/ml-service.log \
  --error-logfile /tmp/ml-error.log \
  ml.app:app \
  && echo "[FarmPal] ML service daemon started on port 5000" \
  || echo "[FarmPal] ML service failed to start — API will use rules fallback"

echo "[FarmPal] Starting API server on port ${PORT:-8080}..."
cd "${WORKSPACE}"
exec node --enable-source-maps artifacts/api-server/dist/index.mjs
