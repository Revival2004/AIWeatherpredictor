#!/bin/bash

WORKSPACE="/home/runner/workspace"
PYTHON="${WORKSPACE}/.pythonlibs/bin/python3.11"

echo "[FarmPal] Starting ML service (sklearn ensemble)..."
cd "${WORKSPACE}/artifacts/api-server"
${PYTHON} -m gunicorn \
  --bind 0.0.0.0:5000 \
  --workers 2 \
  --daemon \
  --log-file /tmp/ml-service.log \
  --error-logfile /tmp/ml-error.log \
  ml.app:app \
  && echo "[FarmPal] ML service daemon started on port 5000" \
  || echo "[FarmPal] ML service failed to start — API will use rules fallback"

echo "[FarmPal] Starting API server on port 8080..."
cd "${WORKSPACE}"
exec node --enable-source-maps artifacts/api-server/dist/index.mjs
