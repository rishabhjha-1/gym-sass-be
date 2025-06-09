#!/usr/bin/env bash
# exit on error
set -o errexit

# Install GraphicsMagick
apt-get update
apt-get install -y graphicsmagick

# Install npm dependencies
npm install

# Generate Prisma client
npx prisma generate

# Build the application
npm run build 