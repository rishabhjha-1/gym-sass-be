#!/bin/bash

# Deploy to Render with Cloudinary environment variables
echo "Deploying to Render with Cloudinary configuration..."

# Set environment variables for deployment
export CLOUDINARY_CLOUD_NAME="dine5j77j"
export CLOUDINARY_API_KEY="566956672923221"
export CLOUDINARY_API_SECRET="xl1gU5ZXVBsZKnZ_E1mgVe1vkow"

# Build the project
echo "Building project..."
npm run build

# Deploy to Render
echo "Deploying to Render..."
render deploy

echo "Deployment completed!"
echo "Make sure to set the following environment variables in your Render dashboard:"
echo "- CLOUDINARY_CLOUD_NAME: dine5j77j"
echo "- CLOUDINARY_API_KEY: 566956672923221"
echo "- CLOUDINARY_API_SECRET: xl1gU5ZXVBsZKnZ_E1mgVe1vkow" 