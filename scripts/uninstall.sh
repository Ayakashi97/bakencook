#!/bin/bash

# Bake'n'Cook Uninstall Script
# Run as a STANDARD USER (with sudo rights)

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[INFO] $1${NC}"
}

warn() {
    echo -e "${RED}[WARN] $1${NC}"
}

# Check for sudo rights
if ! sudo -v; then
    warn "This script requires sudo privileges. Please run as a user with sudo access."
    exit 1
fi

read -p "Are you sure you want to uninstall Bake'n'Cook? This will remove services and config. (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

log "Stopping services..."
sudo systemctl stop bakencook-backend
sudo systemctl disable bakencook-backend
sudo rm -f /etc/systemd/system/bakencook-backend.service
sudo systemctl daemon-reload

log "Removing Nginx config..."
sudo rm -f /etc/nginx/sites-enabled/bakencook
sudo rm -f /etc/nginx/sites-available/bakencook
sudo systemctl reload nginx

log "Cleaning up directories..."
# Optional: Remove venv and node_modules
# rm -rf backend/venv
# rm -rf frontend/node_modules

# Database Cleanup
# Load .env to get database details
if [ -f ".env" ]; then
    set -a
    source .env
    set +a
fi

# Set defaults if not found in .env
DB_NAME=${POSTGRES_DB:-bakencook}
DB_USER=${POSTGRES_USER:-bakencook}

# Database Cleanup
read -p "Do you want to DELETE the database '$DB_NAME' and user '$DB_USER'? (DATA WILL BE LOST) (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log "Deleting database and user..."
    
    # Check and delete Database
    if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
        sudo -u postgres psql -c "DROP DATABASE $DB_NAME;"
        log "Database '$DB_NAME' deleted."
    else
        warn "Database '$DB_NAME' not found."
    fi
    
    # Check and delete User
    if sudo -u postgres psql -t -c '\du' | cut -d \| -f 1 | grep -qw "$DB_USER"; then
        sudo -u postgres psql -c "DROP USER $DB_USER;"
        log "User '$DB_USER' deleted."
    else
        warn "User '$DB_USER' not found."
    fi
else
    log "Database and user were preserved."
    log "To delete them manually later:"
    log "  sudo -u postgres psql -c 'DROP DATABASE $DB_NAME;'"
    log "  sudo -u postgres psql -c 'DROP USER $DB_USER;'"
fi

log "Uninstallation Complete."
