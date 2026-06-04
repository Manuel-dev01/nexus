#!/bin/bash
set -e
cd frontend
echo "=== Installing dependencies ==="
npm install --include=dev
echo "=== Building ==="
npx vite build
echo "=== Build complete ==="
ls -la build/
