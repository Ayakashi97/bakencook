# Setup Guide

## Prerequisites
- **Docker** and **Docker Compose** installed.
- **Git** installed.
- A **Gemini API Key** (for AI features).

## Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd bakencook
    ```

2.  **Environment Configuration:**
    - Copy the example environment file (if available) or create a `.env` file in the root directory.
    - Required variables:
        ```env
        # Database
        POSTGRES_USER=baker
        POSTGRES_PASSWORD=securepassword
        POSTGRES_DB=bread_assist
        DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db/${POSTGRES_DB}

        # Security
        SECRET_KEY=<generate_secure_random_string>
        FIRST_USER_ADMIN=admin@example.com # Email of the first user to be automatically made admin

        # Scraper
        PLAYWRIGHT_WS_ENDPOINT=ws://playwright:3000

        # AI (Gemini)
        GEMINI_API_KEY=<your_gemini_api_key>

        # Frontend
        # Frontend API URL
        # For Docker/Nginx (Reverse Proxy): Use /api
        # For Local Dev (npm run dev): Use http://localhost:8000
        VITE_API_URL=/api
        ```

    ### VITE_API_URL Configuration
    - **Docker / Nginx / Production**: Set `VITE_API_URL=/api`. This allows the frontend to use relative paths, which are then routed by Nginx to the backend. This avoids Mixed Content issues (HTTP backend on HTTPS site).
    - **Local Development**: If running `npm run dev` and `uvicorn` separately without a proxy, set `VITE_API_URL=http://localhost:8000`.

    *Note: The **Gemini API Key** can be set here or configured later via the **Onboarding Wizard** or **Admin Dashboard**.*

3.  **Start with Docker:**
    ```bash
    docker-compose up --build -d
    ```
    - The application will be available at `http://localhost:5173` (Frontend).
    - The API will be available at `http://localhost:8000` (Backend).


