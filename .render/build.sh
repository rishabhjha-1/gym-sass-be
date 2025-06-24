#!/bin/bash
set -e

echo "🔧 Installing system dependencies..."
apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

echo "📦 Installing Python dependencies..."
pip install --no-cache-dir --compile -r requirements-light.txt

echo "✅ Build completed successfully!"
