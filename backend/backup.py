import os
import shutil
import zipfile
import datetime
import subprocess
from database import engine, DATABASE_URL
from logger import logger

BACKUP_DIR = "backups"
STATIC_UPLOADS_DIR = "static/uploads"

def create_backup():
    """
    Creates a backup of the database and static uploads.
    Returns the path to the generated ZIP file.
    """
    os.makedirs(BACKUP_DIR, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"backup_{timestamp}"
    temp_dir = os.path.join(BACKUP_DIR, backup_filename)
    os.makedirs(temp_dir, exist_ok=True)

    try:
        # 1. Backup Database
        db_url = DATABASE_URL
        if "sqlite" in db_url:
            # SQLite: Copy file
            db_path = db_url.replace("sqlite:///", "")
            if os.path.exists(db_path):
                shutil.copy2(db_path, os.path.join(temp_dir, "database.db"))
            else:
                logger.warning(f"SQLite database file not found at {db_path}")
        elif "postgresql" in db_url:
            # PostgreSQL: pg_dump
            # Assumes pg_dump is in PATH and credentials are in URL or env
            # We need to parse the URL to get params or pass the URL to psql if possible
            # pg_dump can take a connection string
            dump_path = os.path.join(temp_dir, "database.sql")
            try:
                subprocess.run(
                    ["pg_dump", db_url, "-f", dump_path],
                    check=True,
                    env=os.environ.copy()
                )
            except subprocess.CalledProcessError as e:
                logger.error(f"pg_dump failed: {e}")
                raise Exception("Database backup failed")
        else:
            logger.warning("Unsupported database type for backup")

        # 2. Backup Uploads
        uploads_backup_path = os.path.join(temp_dir, "uploads")
        if os.path.exists(STATIC_UPLOADS_DIR):
            shutil.copytree(STATIC_UPLOADS_DIR, uploads_backup_path)
        else:
            os.makedirs(uploads_backup_path) # Create empty if not exists

        # 3. Create ZIP
        zip_path = os.path.join(BACKUP_DIR, f"{backup_filename}.zip")
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(temp_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, temp_dir)
                    zipf.write(file_path, arcname)

        return zip_path

    finally:
        # Cleanup temp dir
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

def restore_backup(zip_path):
    """
    Restores the database and uploads from a ZIP backup.
    WARNING: This overwrites existing data.
    """
    temp_dir = os.path.join(BACKUP_DIR, "restore_temp")
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)
    os.makedirs(temp_dir, exist_ok=True)

    try:
        # 1. Extract ZIP
        with zipfile.ZipFile(zip_path, 'r') as zipf:
            zipf.extractall(temp_dir)

        # 2. Restore Database
        db_url = DATABASE_URL
        if "sqlite" in db_url:
            db_path = db_url.replace("sqlite:///", "")
            backup_db_path = os.path.join(temp_dir, "database.db")
            if os.path.exists(backup_db_path):
                # Close connections? SQLite might be locked.
                # In a simple app, we might just overwrite.
                shutil.copy2(backup_db_path, db_path)
            else:
                raise Exception("No database.db found in backup")
        elif "postgresql" in db_url:
            backup_sql_path = os.path.join(temp_dir, "database.sql")
            if os.path.exists(backup_sql_path):
                # Drop and Re-create schema? Or just psql < file
                # Usually psql with clean option in dump is best, but here we just run it.
                # WARNING: This might fail if connections are open.
                try:
                    subprocess.run(
                        ["psql", db_url, "-f", backup_sql_path],
                        check=True,
                        env=os.environ.copy()
                    )
                except subprocess.CalledProcessError as e:
                    logger.error(f"psql restore failed: {e}")
                    raise Exception("Database restore failed")
            else:
                raise Exception("No database.sql found in backup")

        # 3. Restore Uploads
        backup_uploads_path = os.path.join(temp_dir, "uploads")
        if os.path.exists(backup_uploads_path):
            if os.path.exists(STATIC_UPLOADS_DIR):
                shutil.rmtree(STATIC_UPLOADS_DIR)
            shutil.copytree(backup_uploads_path, STATIC_UPLOADS_DIR)

    finally:
        # Cleanup
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
