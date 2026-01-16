#!/bin/bash
# =============================================================================
# Deploy script for Mega CMS
# =============================================================================

set -e  # Stop on error

cd /var/www/mega-cms

echo "📥 Pulling latest changes..."
git pull origin main

cd multisite-cms

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building..."
npm run build

echo "🔄 Restarting PM2..."
pm2 restart mega-cms

echo "✅ Deploy complete!"
pm2 status