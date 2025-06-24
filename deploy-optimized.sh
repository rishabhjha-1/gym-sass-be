#!/bin/bash

# Optimized deployment script for face recognition service
# This script reduces build size and optimizes for Render deployment

set -e

echo "🚀 Starting optimized deployment for face recognition service..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "face_recognition_service_light.py" ]; then
    print_error "face_recognition_service_light.py not found. Please run this script from the project root."
    exit 1
fi

print_status "Cleaning up build artifacts..."

# Clean up Python cache files
find . -type f -name "*.pyc" -delete
find . -type d -name "__pycache__" -delete
find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true

# Clean up virtual environments
rm -rf venv/ venv311/ .venv/ env/

print_status "Creating optimized requirements file..."

# Ensure we're using the lightweight requirements
if [ ! -f "requirements-light.txt" ]; then
    print_error "requirements-light.txt not found. Please create it first."
    exit 1
fi

print_status "Preparing for Render deployment..."

# Create a minimal .render directory for build optimization
mkdir -p .render

# Create a build script for Render
cat > .render/build.sh << 'EOF'
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
EOF

chmod +x .render/build.sh

print_status "Creating optimized render.yaml..."

# Use the optimized render configuration
if [ -f "render-optimized.yaml" ]; then
    cp render-optimized.yaml render.yaml
    print_status "Using optimized render configuration"
else
    print_warning "render-optimized.yaml not found, using existing render.yaml"
fi

print_status "Checking file sizes..."

# Show sizes of key files
echo "📊 File sizes:"
ls -lh face_recognition_service_light.py
ls -lh requirements-light.txt
ls -lh render.yaml

print_status "Deployment preparation complete!"

echo ""
echo "🎯 Next steps:"
echo "1. Commit your changes:"
echo "   git add ."
echo "   git commit -m 'Optimize face recognition service for smaller build size'"
echo ""
echo "2. Push to your repository:"
echo "   git push origin main"
echo ""
echo "3. Deploy on Render:"
echo "   - Go to your Render dashboard"
echo "   - Create a new Web Service"
echo "   - Connect your repository"
echo "   - Use the optimized configuration"
echo ""
echo "💡 Tips for further optimization:"
echo "- The optimized service uses the lightweight version (face_recognition_service_light.py)"
echo "- System dependencies are installed only when needed"
echo "- Python cache is disabled to save space"
echo "- Build artifacts are cleaned up automatically"

print_status "Optimized deployment script completed! 🎉" 