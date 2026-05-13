#!/bin/bash
# 佛教经典电子书合集 - macOS Launch Script
# Double-click this file in Finder to start the doc viewer.
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
    echo "  Or via Homebrew: brew install node"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 14 ] 2>/dev/null; then
    echo "[Error] Node.js v14+ required. Current: $(node -v)"
    read -p "Press Enter to exit..."
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
echo "Starting server... Close this window or press Ctrl+C to stop."
echo ""

node Src/server.js --open
