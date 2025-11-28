#!/bin/bash

# Bake'n'Cook Installation Script for Debian/Ubuntu
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
USER_NAME=$USER

log "Starting installation..."
log "Project Directory: $PROJECT_DIR"
log "User: $USER_NAME"

# 1. Install System Dependencies
log "Installing system dependencies..."
sudo apt-get update
sudo apt-get install -y python3-venv python3-pip nodejs npm postgresql nginx git acl

# 2. Configure Environment & Database
log "Configuring Environment..."
cd "$PROJECT_DIR"

if [ ! -f ".env" ]; then
    log "Creating .env from .env.example..."
    cp .env.example .env
    
    # Generate secure values
    DB_PASS=$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9')
    SECRET=$(openssl rand -hex 32)
    
    # Update .env
    sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$DB_PASS|" .env
    sed -i "s|SECRET_KEY=.*|SECRET_KEY=$SECRET|" .env
    sed -i "s|POSTGRES_USER=.*|POSTGRES_USER=bakencook|" .env
    
    # Construct and set fully expanded DATABASE_URL
    # Systemd does not expand variables, so we must write the full URL
    DB_URL="postgresql://bakencook:$DB_PASS@localhost/bakencook"
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=$DB_URL|" .env
    
    log ".env created with generated passwords."
else
    log ".env already exists. Using existing values."
fi

# FORCE FIXES for Local Install (in case .env was copied from docker or is old)
# 1. Fix Host (db -> localhost)
if grep -q "@db" .env; then
    log "Fixing database host in .env (db -> localhost)..."
    sed -i "s|@db|@localhost|" .env
fi

# 2. Fix Unexpanded Variables (Systemd doesn't support ${VAR})
if grep -q "\${" .env; then
    log "Fixing unexpanded variables in .env..."
    # Extract current values (assuming simple format)
    CURRENT_USER=$(grep "^POSTGRES_USER=" .env | cut -d '=' -f2)
    CURRENT_PASS=$(grep "^POSTGRES_PASSWORD=" .env | cut -d '=' -f2)
    CURRENT_DB=$(grep "^POSTGRES_DB=" .env | cut -d '=' -f2)
    
    # Construct new URL
    NEW_URL="postgresql://$CURRENT_USER:$CURRENT_PASS@localhost/$CURRENT_DB"
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=$NEW_URL|" .env
fi

if ! grep -q "VITE_API_URL" .env; then
    log "Adding VITE_API_URL to .env..."
    echo "VITE_API_URL=/api" >> .env
fi

# Load variables from .env
set -a
source "$PROJECT_DIR/.env"
set +a

log "Configuring Database '$POSTGRES_DB' for user '$POSTGRES_USER'..."

# Check if user exists, if not create
if ! sudo -u postgres psql -t -c '\du' | cut -d \| -f 1 | grep -qw "$POSTGRES_USER"; then
    sudo -u postgres psql -c "CREATE USER $POSTGRES_USER WITH PASSWORD '$POSTGRES_PASSWORD';"
    log "Database user '$POSTGRES_USER' created."
else
    # Update password just in case it changed in .env
    sudo -u postgres psql -c "ALTER USER $POSTGRES_USER WITH PASSWORD '$POSTGRES_PASSWORD';"
    log "Database user '$POSTGRES_USER' exists. Password updated to match .env."
fi

if ! sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "$POSTGRES_DB"; then
    sudo -u postgres psql -c "CREATE DATABASE $POSTGRES_DB OWNER $POSTGRES_USER;"
    log "Database '$POSTGRES_DB' created."
else
    log "Database '$POSTGRES_DB' already exists."
fi

# 3. Backend Setup
log "Setting up Backend..."
cd "$BACKEND_DIR"

if [ ! -d "venv" ]; then
    python3 -m venv venv
    log "Virtual environment created."
fi

# Install requirements (as current user)
./venv/bin/pip install -r requirements.txt

# Create Systemd Service
log "Creating Systemd Service..."
cat <<EOF | sudo tee /etc/systemd/system/bakencook-backend.service > /dev/null
[Unit]
Description=Bake'n'Cook Backend
After=network.target postgresql.service

[Service]
User=$USER_NAME
Group=$USER_NAME
WorkingDirectory=$BACKEND_DIR
EnvironmentFile=$PROJECT_DIR/.env
Environment="PATH=$BACKEND_DIR/venv/bin:/usr/bin"
ExecStart=$BACKEND_DIR/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable bakencook-backend
sudo systemctl restart bakencook-backend
log "Backend service started."

# 4. Frontend Setup
log "Setting up Frontend..."
cd "$FRONTEND_DIR"

# Install dependencies (as current user)
npm install

# Build (as current user)
log "Building Frontend..."
rm -rf dist
export VITE_API_URL="/api"
npm run build

# 5. Nginx Setup
log "Configuring Nginx..."
cat <<EOF | sudo tee /etc/nginx/sites-available/bakencook > /dev/null
server {
    listen 80;
    server_name _;

    # Frontend
    location / {
        root $FRONTEND_DIR/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        # Use upstream protocol if present (for reverse proxy), otherwise fallback to scheme would be ideal but requires map.
        # Given the user has a reverse proxy, we MUST pass the upstream proto.
        proxy_set_header X-Forwarded-Proto \$http_x_forwarded_proto;
        proxy_set_header X-Forwarded-Prefix /api;
    }
    
    # Static Files (Uploads)
    location /static/ {
        proxy_pass http://127.0.0.1:8000/static/;
        proxy_set_header Host \$host;
    }
    
    # Docs
    location /docs {
        proxy_pass http://127.0.0.1:8000/docs;
        proxy_set_header Host \$host;
    }
    
    location /openapi.json {
        proxy_pass http://127.0.0.1:8000/openapi.json;
        proxy_set_header Host \$host;
    }
}
EOF

# Enable Site
sudo ln -sf /etc/nginx/sites-available/bakencook /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and Reload Nginx
sudo nginx -t
sudo systemctl reload nginx

log "Installation Complete!"
log "You can now access the application at http://$(hostname -I | awk '{print $1}')"
log "IMPORTANT: Please check '$PROJECT_DIR/.env' to ensure the database URL is correct."
log "Then run 'sudo systemctl restart bakencook-backend' and visit the site to start the Onboarding Wizard."
