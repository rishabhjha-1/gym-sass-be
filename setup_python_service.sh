#!/bin/bash

echo "Setting up Python Face Recognition Service..."

# Check if Python 3.11 is installed
if ! command -v python3.11 &> /dev/null; then
    echo "Python 3.11 is required. Please install it first."
    echo "On macOS: brew install python@3.11"
    echo "On Ubuntu: sudo apt-get install python3.11"
    exit 1
fi

# Create virtual environment
echo "Creating virtual environment..."
python3.11 -m venv venv

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "Setup complete!"
echo ""
echo "To run the service:"
echo "1. Activate virtual environment: source venv/bin/activate"
echo "2. Run service: python face_recognition_service.py"
echo ""
echo "Or use Docker:"
echo "docker build -t face-recognition-service ."
echo "docker run -p 8000:8000 face-recognition-service" 