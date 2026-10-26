#!/usr/bin/env bash
# Render Build Script for ContentFlow AI Single-Service Deployment
# Compiles React Vite SPA and sets up FastAPI backend with Neon PostgreSQL migrations

set -o errexit

echo "=================================================="
echo "==> [Step 1/3] Building React Frontend SPA..."
echo "=================================================="
cd frontend
npm install --no-audit --no-fund
npm run build
cd ..

echo "=================================================="
echo "==> [Step 2/3] Installing Python Dependencies..."
echo "=================================================="
cd backend
pip install --upgrade pip
pip install -r requirements.txt

echo "=================================================="
echo "==> [Step 3/3] Applying Neon PostgreSQL Migrations..."
echo "=================================================="
alembic upgrade head

echo "=================================================="
echo "==> Build Succeeded! ContentFlow AI is ready to start."
echo "=================================================="
