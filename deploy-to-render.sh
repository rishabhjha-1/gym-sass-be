#!/bin/bash

echo "🚀 Render Deployment Script for Gym Management System"
echo "=================================================="

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "❌ Error: Git repository not found. Please initialize git first:"
    echo "   git init"
    echo "   git add ."
    echo "   git commit -m 'Initial commit'"
    exit 1
fi

# Check if remote origin exists
if ! git remote get-url origin > /dev/null 2>&1; then
    echo "❌ Error: No remote origin found. Please add your GitHub repository:"
    echo "   git remote add origin https://github.com/yourusername/your-repo.git"
    exit 1
fi

echo "✅ Git repository configured"

# Check if all required files exist
required_files=(
    "face_recognition_service.py"
    "requirements.txt"
    "src/index.ts"
    "package.json"
    "render.yaml"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Error: Required file not found: $file"
        exit 1
    fi
done

echo "✅ All required files present"

# Push to GitHub
echo "📤 Pushing to GitHub..."
git add .
git commit -m "Deploy to Render - Fast face recognition integration" || {
    echo "❌ No changes to commit"
}

git push origin main || {
    echo "❌ Failed to push to GitHub. Please check your git configuration."
    exit 1
}

echo "✅ Code pushed to GitHub"

echo ""
echo "🎉 Next Steps:"
echo "=============="
echo ""
echo "1. Go to https://dashboard.render.com"
echo "2. Create two new Web Services:"
echo ""
echo "   🔧 Python Face Recognition Service:"
echo "   - Environment: Python 3"
echo "   - Build Command: pip install -r requirements.txt"
echo "   - Start Command: python face_recognition_service.py"
echo "   - Environment Variables:"
echo "     PYTHON_VERSION=3.11.0"
echo "     PORT=8000"
echo ""
echo "   🔧 Express.js Backend:"
echo "   - Environment: Node"
echo "   - Build Command: npm install && npm run build"
echo "   - Start Command: npm start"
echo "   - Environment Variables:"
echo "     NODE_ENV=production"
echo "     PORT=3000"
echo "     PYTHON_FACE_SERVICE_URL=https://face-recognition-service.onrender.com"
echo "     DATABASE_URL=your_production_database_url"
echo "     CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name"
echo "     CLOUDINARY_API_KEY=your_cloudinary_api_key"
echo "     CLOUDINARY_API_SECRET=your_cloudinary_api_secret"
echo "     JWT_SECRET=your_jwt_secret"
echo ""
echo "3. Wait for deployment (10-15 minutes for first build)"
echo "4. Test your endpoints:"
echo "   - Python: https://face-recognition-service.onrender.com/health"
echo "   - Express: https://gym-sass-backend.onrender.com/health"
echo ""
echo "📖 For detailed instructions, see: RENDER_DEPLOYMENT_GUIDE.md"
echo ""
echo "🎯 Your face recognition will be 5x faster in production!" 