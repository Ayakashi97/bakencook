# Bake'n'Cook Debian Setup Guide

This guide explains how to deploy Bake'n'Cook directly on a Debian or Ubuntu server without using Docker.

## Prerequisites

- A server running Debian 12/13 (Bookworm/Trixie) or Ubuntu 24.04 LTS.
- A standard user with `sudo` privileges (do not run as root).
- A domain pointing to your server (optional, but recommended).

## Installation

1.  **Prepare the System**
    First, install `git` and prepare the installation directory (e.g., `/opt/bakencook`).
    ```bash
    # Install Git
    sudo apt update
    sudo apt install -y git

    # Create directory and take ownership (so you don't need sudo for git)
    sudo mkdir -p /opt/bakencook
    sudo chown $USER:$USER /opt/bakencook
    ```

2.  **Clone the Repository**
    Now clone the code into the prepared directory.
    ```bash
    git clone https://github.com/Ayakashi97/bakencook.git /opt/bakencook
    cd /opt/bakencook
    ```

3.  **Optional: Configure Database Credentials**
    The installation script will automatically generate secure credentials. However, if you want to define your own database user or password:
    ```bash
    cp .env.example .env
    nano .env
    ```
    Edit `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` as desired. The script will use these values.

4.  **Run the Installation Script**
    The script will install all dependencies (Python, Node.js, Postgres, Nginx), configure the database (using your `.env` or generating one), and set up the services.
    It will ask for your `sudo` password when necessary.
    ```bash
    chmod +x scripts/*.sh
    ./scripts/install.sh
    ```

5.  **Check Configuration**
    The script automatically creates a `.env` file in the project root directory with the database connection string and a generated secret key. You can verify it if you wish:
    ```bash
    nano .env
    ```

6.  **Restart the Backend**
    To ensure all settings are applied:
    ```bash
    sudo systemctl restart bakencook-backend
    ```

7.  **Onboarding Wizard**
    Open your browser and navigate to `http://<your-server-ip>`.
    You will be greeted by the **Onboarding Wizard** where you can configure:
    *   Admin Account
    *   Application Name
    *   **Gemini API Key**
    *   SMTP Settings (Email)


## Updates

To update the application to the latest version:

```bash
cd /path/to/bakencook
./scripts/update.sh
```

This will pull the latest code, update dependencies, rebuild the frontend, and restart the services.

## Uninstallation

To remove the application and its configuration:

```bash
cd /path/to/bakencook
./scripts/uninstall.sh
```

**Note:** The script will ask if you want to delete the database. If you choose 'No', your data will be preserved.

## Troubleshooting

-   **Backend Logs:**
    ```bash
    sudo journalctl -u bakencook-backend -f
    ```
-   **Nginx Logs:**
    ```bash
    sudo tail -f /var/log/nginx/error.log
    ```
