#!/bin/bash

# Bake'n'Cook Update Script
# Run as a STANDARD USER (with sudo rights)

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[INFO] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

# Check for sudo rights
if ! sudo -v; then
    error "This script requires sudo privileges. Please run as a user with sudo access."
    exit 1
fi

PROJECT_DIR=$(pwd)
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

log "Starting update..."

# 1. Update Code
log "Pulling latest code..."
git pull origin main

# 2. Update Backend
log "Updating Backend..."
cd "$BACKEND_DIR"
./venv/bin/pip install -r requirements.txt

log "Restarting Backend Service..."
sudo systemctl restart bakencook-backend

# 3. Update Frontend
log "Updating Frontend..."
cd "$FRONTEND_DIR"
npm install
npm run build

# 4. Reload Nginx (Optional, but good practice)
log "Reloading Nginx..."
sudo systemctl reload nginx

log "Update Complete!"
