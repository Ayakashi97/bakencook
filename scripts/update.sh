#!/bin/bash
set -e

# Configuration
PROJECT_DIR="/home/baker/bakencook" # Adjust if needed, or use relative paths
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
BACKUP_DIR="$PROJECT_DIR/backups"

echo "Starting System Update..."

# 1. Backup Database
echo "Creating database backup..."
if [ -f "$PROJECT_DIR/scripts/backup_db.sh" ]; then
    bash "$PROJECT_DIR/scripts/backup_db.sh"
else
    echo "Warning: backup_db.sh not found. Skipping backup."
fi

# 2. Git Pull
echo "Pulling latest changes..."
cd "$PROJECT_DIR"
git pull

# 3. Update Backend
echo "Updating Backend..."
cd "$BACKEND_DIR"
# Install python dependencies
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
fi

# Run Migrations
echo "Running Database Migrations..."
# Check if alembic is initialized
if [ -f "alembic.ini" ]; then
    # If this is the first run, we might need to stamp the DB if it already exists
    # But for now, let's just upgrade
    alembic upgrade head
fi

# 4. Update Frontend
echo "Updating Frontend..."
cd "$FRONTEND_DIR"
# Install node dependencies
npm install
# Build frontend
npm run build

echo "Update completed successfully."
echo "Please restart the application services."
