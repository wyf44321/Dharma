#!/bin/bash
# 佛教经典电子书合集 - Linux Launch Script
set -e
cd "$(dirname "$0")"

echo "=========================================="
echo "  佛教经典电子书合集"
echo "=========================================="

# Check Node.js
if ! command -v node &> /dev/null; then
    echo ""
    echo "[Error] Node.js is not installed."
    echo "Please install Node.js (v14+) from: https://nodejs.org/"
    echo ""
    exit 1
fi

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 14 ] 2>/dev/null; then
    echo "[Error] Node.js v14+ required. Current: $(node -v)"
    exit 1
fi

echo "[OK] Node.js $(node -v) detected"

# Install dependencies if needed
if [ ! -d "Src/node_modules" ]; then
    echo "[...] Installing dependencies..."
    (cd Src && npm install --silent)
    echo "[OK] Dependencies installed"
else
    echo "[OK] Dependencies already installed"
fi

echo ""
echo "Starting server... Press Ctrl+C to stop."
echo ""

node Src/server.js --open
