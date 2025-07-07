#!/bin/bash

# Build script for production deployment
set -e

echo "🔧 Starting build process..."

# Check Node.js version
echo "📋 Node.js version: $(node --version)"
echo "📋 NPM version: $(npm --version)"

# Clean install dependencies
echo "📦 Installing dependencies..."
npm ci

# Generate Prisma client
echo "🗄️  Generating Prisma client..."
npx prisma generate --schema=src/prisma/schema.prisma

# Build TypeScript
echo "🔨 Building TypeScript..."
npx tsc

# Verify build output
echo "✅ Verifying build output..."
if [ ! -f "dist/index.js" ]; then
    echo "❌ Build failed: dist/index.js not found"
    exit 1
fi

echo "🎉 Build completed successfully!" 