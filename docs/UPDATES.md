# Updates & Versioning

## Versioning
Bake'n'Cook uses [Semantic Versioning](https://semver.org/).
The current version can be found in the `VERSION` file in the root directory.

## Updating the Application

### Automated Update (Recommended)
We provide a script to automate the update process. This script will:
1.  Backup your database.
2.  Pull the latest changes from Git.
3.  Update backend dependencies.
4.  Run database migrations.
5.  Rebuild the frontend.

**To run the update:**
```bash
./scripts/update.sh
```

**Note:** You may need to restart your application services (Docker containers or systemd services) after the update completes.

### Manual Update
If you prefer to update manually, follow these steps:

1.  **Backup Database:**
    ```bash
    ./scripts/backup_db.sh
    ```

2.  **Pull Changes:**
    ```bash
    git pull
    ```

3.  **Update Backend:**
    ```bash
    cd backend
    pip install -r requirements.txt
    alembic upgrade head
    ```

4.  **Update Frontend:**
    ```bash
    cd frontend
    npm install
    npm run build
    ```

5.  **Restart Services:**
    Restart your application server.

## Database Migrations
We use **Alembic** for database migrations.
-   Migrations are located in `backend/alembic/versions`.
-   The current database state is tracked in the `alembic_version` table.

## Backups
Database backups are stored in the `backups/` directory.
You can manually trigger a backup using:
```bash
./scripts/backup_db.sh
```
