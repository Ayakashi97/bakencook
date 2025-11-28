#!/bin/bash
set -e

# Determine project root (assuming script is in project_root/scripts or similar)
PROJECT_DIR="$(dirname "$(realpath "$0")")/.."

# Load .env file if it exists
if [ -f "$PROJECT_DIR/.env" ]; then
    echo "Loading configuration from .env..."
    # Use set -a to automatically export variables, then set +a to disable
    set -a
    source "$PROJECT_DIR/.env"
    set +a
fi

# Configuration
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"
CONTAINER_NAME="${CONTAINER_NAME:-bakencook_db}" # Adjust to your actual container name
DB_USER="${POSTGRES_USER:-${DB_USER:-baker}}"
DB_PASSWORD="${POSTGRES_PASSWORD:-${DB_PASSWORD:-securepassword}}"
DB_NAME="${POSTGRES_DB:-${DB_NAME:-bakencook}}"
DB_HOST="${POSTGRES_HOST:-${DB_HOST:-localhost}}" # Host for local pg_dump connection

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "Backing up database to $BACKUP_FILE..."

# Check if running in Docker
if command -v docker &> /dev/null && docker ps | grep -q "$CONTAINER_NAME"; then
    docker exec -t "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"
else
    # Try local pg_dump
    if command -v pg_dump &> /dev/null; then
        echo "Using local pg_dump with password auth..."
        export PGPASSWORD="${DB_PASSWORD:-securepassword}"
        # Use -h localhost to force TCP and avoid Peer auth issues
        pg_dump -h localhost -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"
    else
        echo "Error: Could not find docker container or local pg_dump."
        exit 1
    fi
fi

echo "Backup complete: $BACKUP_FILE"
