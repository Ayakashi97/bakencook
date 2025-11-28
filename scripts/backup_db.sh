#!/bin/bash
set -e

# Configuration
BACKUP_DIR="../backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"
CONTAINER_NAME="bakencook-db-1" # Adjust to your actual container name
DB_USER="baker"
DB_NAME="bread_assist"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "Backing up database to $BACKUP_FILE..."

# Check if running in Docker
if command -v docker &> /dev/null && docker ps | grep -q "$CONTAINER_NAME"; then
    docker exec -t "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"
else
    # Try local pg_dump
    if command -v pg_dump &> /dev/null; then
        pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"
    else
        echo "Error: Could not find docker container or local pg_dump."
        exit 1
    fi
fi

echo "Backup complete: $BACKUP_FILE"
