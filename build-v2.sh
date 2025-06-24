#!/bin/bash
set -e

echo "🔧 Installing system dependencies..."
# Install minimal system dependencies
apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

echo "📦 Installing Python dependencies..."
# Install core dependencies first
pip install --no-cache-dir numpy==1.24.3 Pillow==9.5.0 requests==2.31.0

echo "🔧 Installing FastAPI..."
pip install --no-cache-dir fastapi==0.104.1 uvicorn[standard]==0.24.0 pydantic==2.5.0

echo "🔧 Installing OpenCV..."
pip install --no-cache-dir opencv-python-headless==4.8.1.78

echo "🔧 Installing dlib from PyPI..."
# Try to install dlib from PyPI (might have pre-compiled wheels)
pip install --no-cache-dir dlib==19.24.2

echo "🔧 Installing face-recognition..."
# Install face-recognition
pip install --no-cache-dir face-recognition==1.3.0

echo "✅ Build completed successfully!" 