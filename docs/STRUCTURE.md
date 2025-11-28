# Project Structure

## Overview
The project is a full-stack web application built with a Python FastAPI backend and a React (TypeScript) frontend. It uses PostgreSQL as the database.

## Directory Structure

### `backend/`
Contains the Python FastAPI application.
- **`main.py`**: Entry point of the application and API route definitions.
- **`models.py`**: SQLAlchemy database models.
- **`schemas.py`**: Pydantic models for request/response validation.
- **`auth.py`**: Authentication logic (JWT, password hashing).
- **`database.py`**: Database connection and session management.
- **`scraper.py`**: Logic for scraping recipes from URLs using Playwright.
- **`ai_parser.py`**: Integration with Gemini API for parsing recipe text.
- **`email_utils.py`**: Email sending functionality.
- **`seed_data.py`**: Initial data seeding (ingredients, units).

### `frontend/`
Contains the React application built with Vite.
- **`src/`**: Source code.
- **`components/`**: Reusable UI components.
- **`pages/`**: Top-level page components corresponding to routes.
- **`context/`**: React Context definitions (e.g., AuthContext).
- **`hooks/`**: Custom React hooks.
- **`lib/`**: Utility functions and API client.
    - **`api.ts`**: API client and request handling.
- **`i18n.ts`**: Internationalization configuration.
- **`public/`**: Static assets.

### `docs/`
Documentation files.
- `SETUP.md`: Installation and setup instructions.
- `USAGE.md`: User manual.
- `ADMIN.md`: Administration guide.
- `STRUCTURE.md`: This file.

## Key Technologies
- **Backend**: Python, FastAPI, SQLAlchemy, Pydantic, Playwright (for scraping).
- **Frontend**: TypeScript, React, Vite, TailwindCSS, Shadcn UI.
- **Database**: PostgreSQL.
- **Containerization**: Docker, Docker Compose.
