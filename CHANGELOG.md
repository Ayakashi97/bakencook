# Changelog

## [1.0.2-beta.1] - 2025-11-28
### Added
- Beta release channel support.
- Automated update scripts.
- Database backup scripts.
- Admin System UI for updates.


All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-11-28

### Added
-   **Versioning System**: Implemented a centralized versioning system using a `VERSION` file.
-   **Update System**: Added `scripts/update.sh` for automated updates and `scripts/backup_db.sh` for database backups.
-   **Admin UI**: Added a new "Updates & Version" tab in the Admin Server Management page to view the current version, changelog, and check for updates.
-   **API**: Added endpoints `/system/version`, `/system/changelog`, and `/system/check-update`.
-   **Database Migrations**: Integrated Alembic for database migrations.
-   **Documentation**: Added `docs/UPDATES.md` and updated `README.md` with update instructions.

### Changed
-   **Frontend**: Updated `AdminSystem.tsx` to include the new update management UI.
-   **Backend**: Updated `main.py` to include system endpoints.
