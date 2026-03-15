#!/usr/bin/env bash
set -e

echo "Starting Redis..."
docker compose up -d redis

echo "Running migrations against 192.168.10.31..."
npx prisma migrate deploy

echo "Done! Run 'docker compose up -d --build app' to start the app."
