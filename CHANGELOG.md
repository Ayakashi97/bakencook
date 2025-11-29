# Changelog

## [1.0.17] - 2025-11-29
### Changes
- feat: apply imported recipe data and enable review mode when import modal is closed after successful import
- feat: Update image import endpoint to accept language as form data.
- feat: Implement AI-powered recipe import from images with new backend endpoint and frontend UI.
- docs: Update Debian sudoers configuration for bakencook-backend restart to include `--no-ask-password` and rename the config file.

## [1.0.16] - 2025-11-29
### Changes
- feat: Update image import endpoint to accept language as form data.
- feat: Implement AI-powered recipe import from images with new backend endpoint and frontend UI.
- docs: Update Debian sudoers configuration for bakencook-backend restart to include `--no-ask-password` and rename the config file.

## [1.0.15] - 2025-11-29
### Changes
- refactor: Remove unused `PageHeader` imports, `duplicateRecipeId` prop, and `refetch` variable.
- refactor: Relocate German translation keys and remove unused `pending_approval`, `approve`, `verified` keys.
- feat: Implement linking ingredients to recipes in the backend and frontend UI, and update recipe fetching to include a limit.
- refactor: remove PageHeader component from AdminDashboard
- refactor: Replaced `PageHeader` with a combined tabs and actions layout, and set create recipe button size to small.
- feat: Add option to show past events in the planner list view
- feat: Calculate recipe end time based on duration for 'start' mode and correct event type mapping when editing schedules.
- refactor: Conditionally set Planer container height to fixed or minimum based on active tab.
- feat: Update 'add event' button text to 'Plan Recipe' and reposition it next to the tabs on the Planer page.
- feat: introduce timeline tab and refine planner UI with new view modes and translations
- feat: add Timeline component to Planer page for detailed visualization of recipe steps and custom events.
- feat: Implement success countdown and redirect after recipe import completion
- refactor: Move import redirect logic from interval to a dedicated effect.
- feat: Migrate recipe URL duplicate check to a POST endpoint with improved error handling and updated CORS origins.
- feat: Implement pre-import duplicate recipe check with detailed progress steps and integrated warning UI.
- feat: Add duplicate recipe import detection and UI, and replace API key regeneration confirmation with a modal.

## [1.0.14] - 2025-11-29
### Changes
- refactor: Relocate German translation keys and remove unused `pending_approval`, `approve`, `verified` keys.
- feat: Implement linking ingredients to recipes in the backend and frontend UI, and update recipe fetching to include a limit.
- refactor: remove PageHeader component from AdminDashboard
- refactor: Replaced `PageHeader` with a combined tabs and actions layout, and set create recipe button size to small.
- feat: Add option to show past events in the planner list view
- feat: Calculate recipe end time based on duration for 'start' mode and correct event type mapping when editing schedules.
- refactor: Conditionally set Planer container height to fixed or minimum based on active tab.
- feat: Update 'add event' button text to 'Plan Recipe' and reposition it next to the tabs on the Planer page.
- feat: introduce timeline tab and refine planner UI with new view modes and translations
- feat: add Timeline component to Planer page for detailed visualization of recipe steps and custom events.
- feat: Implement success countdown and redirect after recipe import completion
- refactor: Move import redirect logic from interval to a dedicated effect.
- feat: Migrate recipe URL duplicate check to a POST endpoint with improved error handling and updated CORS origins.
- feat: Implement pre-import duplicate recipe check with detailed progress steps and integrated warning UI.
- feat: Add duplicate recipe import detection and UI, and replace API key regeneration confirmation with a modal.

## [1.0.13] - 2025-11-29
### Changes
- feat: Introduce system configuration API and UI to conditionally enable/disable AI recipe import functionality.
- feat: Add new profile tab translations for settings and danger, and remove duplicate/redundant i18n keys.
- feat: Add i18n keys for email verification and profile settings, and remove backend request logging, validation handler, and verbose logging.
- feat: Add email verification for user settings, implement request logging and validation error handling, and update profile UI to support verification flow.
- feat: Mask sensitive API keys and passwords in admin settings API and add password visibility toggle to frontend.
- feat: Add language parameter to email settings and test endpoint, and make test recipient optional.
- feat: Add test email template, enhance SMTP configuration, improve system settings management, and enable file logging.
- feat: add i18n keys for debug mode settings
- feat: implement structured logging, add debug mode setting, and introduce security headers.
- feat: implement multi-language email templates and user language preference with database migration
- feat: Add `send_verification_email` helper and notify old email address upon account email change.
- feat: Add German translations for profile email confirmation and common terms
- refactor: extract `OverviewTab` into a separate component for better organization and reusability.
- feat: Implement email verification flow for profile email changes, including new UI, backend logic, and translations.
- feat: Implement email update functionality on the profile page and correct global search API endpoint.

## [1.0.12] - 2025-11-29
### Changes
- fix: improve latest tag retrieval by using Python for semantic version sorting
- feat: Install postgresql-client, enable direct pg_dump in Docker, and add --no-ask-password to systemctl restart.
- feat: add an option to promote beta versions to stable releases.
- chore: ignore backup directories and fetch the latest global tag in the release preparation script.

## [1.0.12-beta.1] - 2025-11-29
### Changes
- fix: improve latest tag retrieval by using Python for semantic version sorting
- feat: Install postgresql-client, enable direct pg_dump in Docker, and add --no-ask-password to systemctl restart.
- feat: add an option to promote beta versions to stable releases.
- chore: ignore backup directories and fetch the latest global tag in the release preparation script.

## [1.0.11] - 2025-11-29
### Changes
- feat: add an option to promote beta versions to stable releases.
- chore: ignore backup directories and fetch the latest global tag in the release preparation script.

## [1.0.11-beta.1] - 2025-11-29
### Changes
- feat: add interactive version bumping and release type selection to the prepare_release script.
- feat: Introduce `PROJECT_ROOT` environment variable for flexible path resolution and enhance Docker update and restart mechanisms.
- feat: Add proxy bypass for HTML requests in Vite dev server configuration
- feat: Explicitly set user enum role based on assigned role name and display admin navigation based on role or system permission.
- feat: mount VERSION file into backend service container
- feat: Install git in Dockerfile, mount versioning files in docker-compose, and add update check failed translation.
- feat: mount VERSION file to frontend service in docker-compose
- feat: add GNU Affero General Public License v3

## [1.0.10] - 2025-11-29
### Changes
- feat: Add proxy bypass for HTML requests in Vite dev server configuration
- feat: Explicitly set user enum role based on assigned role name and display admin navigation based on role or system permission.
- feat: mount VERSION file into backend service container
- feat: Install git in Dockerfile, mount versioning files in docker-compose, and add update check failed translation.
- feat: mount VERSION file to frontend service in docker-compose
- feat: add GNU Affero General Public License v3

## [1.0.9] - 2025-11-28
### Changes
- feat: add i18n keys for update restart messages and common saved state
- fix: Change system settings update channel API method from PUT to POST
- chore: update dependencies

## [1.0.9-beta.1] - 2025-11-28
### Changes
- feat: add i18n keys for update restart messages and common saved state
- fix: Change system settings update channel API method from PUT to POST
- chore: update dependencies

## [1.0.8] - 2025-11-28
### Changes
- chore: update dependencies

## [1.0.7] - 2025-11-28
### Changes
- chore: update dependencies

## [1.0.6] - 2025-11-28
### Changes
- feat: import `useEffect` hook and `Modal` component

## [1.0.2-beta.29] - 2025-11-28
### Changes
- feat: Implement retry logic with exponential backoff and specific 401 handling for user authentication.
- fix: Enhance update status polling by preventing stale closures, simplifying idle status detection, and assuming restart on network errors.
- feat: Add system restart detection and auto-refresh with a countdown during updates.
- fix: Remove trailing slashes from `/recipes` API endpoint paths in Planer and RecipeEdit.
- chore: externalize API version by importing it from a dedicated module
- docs: Refine setup documentation by distinguishing Docker from native installs and adding update/backup permission details.
- feat: Enhance system status UI with update channel selection, update process monitoring, and service health display.
- refactor: remove System Status tab and its component logic from Admin panel.
- fix: auto-scroll update log and improve service restart robustness

## [1.0.2-beta.28] - 2025-11-28
### Changes
- feat: Implement retry logic with exponential backoff and specific 401 handling for user authentication.
- fix: Enhance update status polling by preventing stale closures, simplifying idle status detection, and assuming restart on network errors.
- feat: Add system restart detection and auto-refresh with a countdown during updates.
- fix: Remove trailing slashes from `/recipes` API endpoint paths in Planer and RecipeEdit.
- chore: externalize API version by importing it from a dedicated module
- docs: Refine setup documentation by distinguishing Docker from native installs and adding update/backup permission details.
- feat: Enhance system status UI with update channel selection, update process monitoring, and service health display.
- refactor: remove System Status tab and its component logic from Admin panel.
- fix: auto-scroll update log and improve service restart robustness

## [1.0.2-beta.27] - 2025-11-28
### Changes
- fix: Enhance update status polling by preventing stale closures, simplifying idle status detection, and assuming restart on network errors.
- feat: Add system restart detection and auto-refresh with a countdown during updates.
- fix: Remove trailing slashes from `/recipes` API endpoint paths in Planer and RecipeEdit.
- chore: externalize API version by importing it from a dedicated module
- docs: Refine setup documentation by distinguishing Docker from native installs and adding update/backup permission details.
- feat: Enhance system status UI with update channel selection, update process monitoring, and service health display.
- refactor: remove System Status tab and its component logic from Admin panel.
- fix: auto-scroll update log and improve service restart robustness

## [1.0.2-beta.26] - 2025-11-28
### Changes
- fix: Enhance update status polling by preventing stale closures, simplifying idle status detection, and assuming restart on network errors.
- feat: Add system restart detection and auto-refresh with a countdown during updates.
- fix: Remove trailing slashes from `/recipes` API endpoint paths in Planer and RecipeEdit.
- chore: externalize API version by importing it from a dedicated module
- docs: Refine setup documentation by distinguishing Docker from native installs and adding update/backup permission details.
- feat: Enhance system status UI with update channel selection, update process monitoring, and service health display.
- refactor: remove System Status tab and its component logic from Admin panel.
- fix: auto-scroll update log and improve service restart robustness

## [1.0.2-beta.25] - 2025-11-28
### Changes
- fix: Enhance update status polling by preventing stale closures, simplifying idle status detection, and assuming restart on network errors.
- feat: Add system restart detection and auto-refresh with a countdown during updates.
- fix: Remove trailing slashes from `/recipes` API endpoint paths in Planer and RecipeEdit.
- chore: externalize API version by importing it from a dedicated module
- docs: Refine setup documentation by distinguishing Docker from native installs and adding update/backup permission details.
- feat: Enhance system status UI with update channel selection, update process monitoring, and service health display.
- refactor: remove System Status tab and its component logic from Admin panel.
- fix: auto-scroll update log and improve service restart robustness

## [1.0.2-beta.24] - 2025-11-28
### Changes
- feat: Add system restart detection and auto-refresh with a countdown during updates.
- fix: Remove trailing slashes from `/recipes` API endpoint paths in Planer and RecipeEdit.
- chore: externalize API version by importing it from a dedicated module
- docs: Refine setup documentation by distinguishing Docker from native installs and adding update/backup permission details.
- feat: Enhance system status UI with update channel selection, update process monitoring, and service health display.
- refactor: remove System Status tab and its component logic from Admin panel.
- fix: auto-scroll update log and improve service restart robustness

## [1.0.2-beta.23] - 2025-11-28
### Changes
- feat: Add system restart detection and auto-refresh with a countdown during updates.
- fix: Remove trailing slashes from `/recipes` API endpoint paths in Planer and RecipeEdit.
- chore: externalize API version by importing it from a dedicated module
- docs: Refine setup documentation by distinguishing Docker from native installs and adding update/backup permission details.
- feat: Enhance system status UI with update channel selection, update process monitoring, and service health display.
- refactor: remove System Status tab and its component logic from Admin panel.
- fix: auto-scroll update log and improve service restart robustness

## [1.0.2-beta.22] - 2025-11-28
### Changes
- fix: Remove trailing slashes from `/recipes` API endpoint paths in Planer and RecipeEdit.
- chore: externalize API version by importing it from a dedicated module
- docs: Refine setup documentation by distinguishing Docker from native installs and adding update/backup permission details.
- feat: Enhance system status UI with update channel selection, update process monitoring, and service health display.
- refactor: remove System Status tab and its component logic from Admin panel.
- fix: auto-scroll update log and improve service restart robustness

## [1.0.2-beta.21] - 2025-11-28
### Changes
- chore: externalize API version by importing it from a dedicated module
- docs: Refine setup documentation by distinguishing Docker from native installs and adding update/backup permission details.
- feat: Enhance system status UI with update channel selection, update process monitoring, and service health display.
- refactor: remove System Status tab and its component logic from Admin panel.
- fix: auto-scroll update log and improve service restart robustness

## [1.0.2-beta.19] - 2025-11-28
### Changes
- feat: Enhance system status UI with update channel selection, update process monitoring, and service health display.
- refactor: remove System Status tab and its component logic from Admin panel.
- fix: auto-scroll update log and improve service restart robustness

## [1.0.2-beta.19] - 2025-11-28
### Changes
- refactor: remove System Status tab and its component logic from Admin panel.
- fix: auto-scroll update log and improve service restart robustness

## [1.0.2-beta.18] - 2025-11-28
### Changes
- fix: make service restart in update script non-blocking
- fix: remove unused useEffect import
- fix: add missing translations and use modal for update confirmation

## [1.0.2-beta.17] - 2025-11-28
### Changes
- fix: remove unused useEffect import
- fix: add missing translations and use modal for update confirmation

## [1.0.2-beta.15] - 2025-11-28
### Changes
- fix: add missing translations and system settings endpoint
- feat: automate changelog generation from git history
- docs: update VITE_API_URL defaults and setup guide
- fix: remove aggressive https auto-upgrade for api url
- feat: add venv support and service restart to update script
- fix: resolve typescript errors in AdminSystem

## [1.0.2-beta.14] - 2025-11-28
### Changes
- feat: automate changelog generation from git history
- docs: update VITE_API_URL defaults and setup guide
- fix: remove aggressive https auto-upgrade for api url
- feat: add venv support and service restart to update script
- fix: resolve typescript errors in AdminSystem

## [1.0.2-beta.13] - 2025-11-28
### Added
- [TODO: Add your changes here]

## [1.0.2-beta.12] - 2025-11-28
### Added
- [TODO: Add your changes here]

## [1.0.2-beta.11] - 2025-11-28
### Added
- [TODO: Add your changes here]

## [1.0.2-beta.10] - 2025-11-28
### Added
- [TODO: Add your changes here]

## [1.0.2-beta.9] - 2025-11-28
### Added
- [TODO: Add your changes here]

## [1.0.2-beta.8] - 2025-11-28
### Added
- [TODO: Add your changes here]

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
