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

echo "🔧 Installing dlib from pre-compiled wheel..."
# Try to install dlib from pre-compiled wheel
pip install --no-cache-dir --no-deps https://github.com/sachadee/Dlib/releases/download/v19.22/dlib-19.22.99-cp311-cp311-linux_x86_64.whl

echo "🔧 Installing face-recognition..."
# Install face-recognition without dlib dependency
pip install --no-cache-dir --no-deps face-recognition==1.3.0

echo "✅ Build completed successfully!" 