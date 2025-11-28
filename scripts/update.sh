#!/bin/bash
set -e

# Configuration
# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
# Load .env file if it exists
if [ -f "$PROJECT_DIR/.env" ]; then
    echo "Loading configuration from .env..."
    set -a
    source "$PROJECT_DIR/.env"
    set +a
fi

BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
BACKUP_DIR="$PROJECT_DIR/backups"

TARGET_VERSION="$1"

echo "Starting System Update..."
echo "Project Directory: $PROJECT_DIR"

# 1. Backup Database
echo "Creating database backup..."
if [ -f "$SCRIPT_DIR/backup_db.sh" ]; then
    bash "$SCRIPT_DIR/backup_db.sh"
else
    echo "Warning: backup_db.sh not found. Skipping backup."
fi

# 2. Git Update
echo "Fetching latest changes..."
cd "$PROJECT_DIR"
git fetch --tags

if [ -n "$TARGET_VERSION" ]; then
    echo "Checking out version: $TARGET_VERSION"
    git checkout "$TARGET_VERSION"
else
    echo "Pulling latest changes from current branch..."
    git pull
fi

# 3. Update Backend
echo "Updating Backend..."
cd "$BACKEND_DIR"

# Activate Virtual Environment if configured
if [ -n "$VENV_DIR" ] && [ -f "$VENV_DIR/bin/activate" ]; then
    echo "Activating virtual environment: $VENV_DIR"
    source "$VENV_DIR/bin/activate"
fi

# Install python dependencies
if [ -f "requirements.txt" ]; then
    echo "Installing Python dependencies..."
    python3 -m pip install -r requirements.txt
fi

# Run Migrations
echo "Running Database Migrations..."
# Check if alembic is initialized
if [ -f "alembic.ini" ]; then
    # If this is the first run, we might need to stamp the DB if it already exists
    # But for now, let's just upgrade
    echo "Upgrading database..."
    
    # Check if running in Docker and restart backend to clear locks
    if command -v docker &> /dev/null && docker ps | grep -q "bakencook_backend"; then
        echo "Restarting backend container to clear DB locks..."
        docker restart bakencook_backend
        echo "Waiting for backend to restart..."
        sleep 5
    fi

    python3 -m alembic upgrade head
fi

# 4. Update Frontend
echo "Updating Frontend..."
cd "$FRONTEND_DIR"
# Install node dependencies
npm install
# Build frontend
npm run build

echo "Update completed successfully."

# Restart Service if configured
if [ -n "$BACKEND_SERVICE_NAME" ]; then
    echo "Restarting service: $BACKEND_SERVICE_NAME..."
    if command -v systemctl &> /dev/null; then
        # Try without sudo first (e.g. user service)
        if systemctl restart "$BACKEND_SERVICE_NAME"; then
            echo "Service restarted (without sudo)."
        # Try with non-interactive sudo
        elif sudo -n systemctl restart "$BACKEND_SERVICE_NAME"; then
            echo "Service restarted (with sudo)."
        else
            echo "Warning: Could not restart service automatically."
            echo "Reason: 'sudo' requires a password or insufficient permissions."
            echo "To enable auto-restart, configure NOPASSWD in sudoers for this command:"
            echo "  $USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart $BACKEND_SERVICE_NAME"
            echo "Please restart '$BACKEND_SERVICE_NAME' manually to apply changes."
        fi
    else
        echo "Warning: systemctl not found. Cannot restart service automatically."
        echo "Please restart '$BACKEND_SERVICE_NAME' manually."
    fi
else
    echo "Please restart the application services."
fi
