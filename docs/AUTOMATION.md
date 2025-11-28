# Automated Recipe Import & iOS Shortcuts

This guide explains how to use the Bake'n'Cook Automation API to import recipes automatically, for example, using iOS Shortcuts.

## Prerequisites

1.  **Account**: You need a registered account on your Bake'n'Cook instance.
2.  **API Key**: You need to generate an API Key.
    *   Go to your **Profile**.
    *   Click on the **API Access** tab.
    *   Click **Generate API Key**.
    *   Copy the key. You will need it for the automation.

## API Endpoints

The automation API is designed to be simple and secure. It requires **Basic Authentication** (your username and password) AND an **API Key** header.

### 1. Trigger Import

*   **URL**: `POST /api/automation/import`
*   **Headers**:
    *   `Content-Type: application/json`
    *   `X-API-Key: <YOUR_API_KEY>`
    *   `Authorization: Basic <BASE64_ENCODED_CREDENTIALS>` (Username:Password)
*   **Body**:
    ```json
    {
      "url": "https://example.com/recipe-page"
    }
    ```
*   **Response**:
    ```json
    {
      "id": "job-uuid",
      "status": "pending",
      "created_at": "..."
    }
    ```

### 2. Check Status

*   **URL**: `GET /api/automation/status/{job_id}`
*   **Headers**:
    *   `X-API-Key: <YOUR_API_KEY>`
    *   `Authorization: Basic <BASE64_ENCODED_CREDENTIALS>`
*   **Response** (Processing):
    ```json
    {
      "id": "job-uuid",
      "status": "processing"
    }
    ```
*   **Response** (Completed):
    ```json
    {
      "id": "job-uuid",
      "status": "completed",
      "recipe_id": "recipe-uuid"
    }
    ```

## iOS Shortcut Guide

You can create an iOS Shortcut to share a URL from Safari directly to your Bake'n'Cook instance.

### Step-by-Step Setup

1.  **Create New Shortcut**: Open the Shortcuts app and tap "+".
2.  **Accepts**: Set the shortcut to accept **URLs** from **Share Sheet**.
3.  **Get URL**: Add action "Get URL from Input".
4.  **Text (API Key)**: Add a "Text" action and paste your **API Key**.
5.  **Text (Credentials)**: Add a "Text" action with your `username:password`.
6.  **Base64 Encode**: Add "Base64 Encode" action (encode the credentials text).
7.  **Get Contents of URL (Trigger Import)**:
    *   **URL**: `https://localhost:5173/api/automation/import`
    *   **Method**: POST
    *   **Headers**:
        *   `Content-Type`: `application/json`
        *   `X-API-Key`: Select the "Text" variable with your API Key.
        *   `Authorization`: `Basic ` (type "Basic " manually) + Select the "Base64 Encoded" variable.
    *   **Request Body**: JSON
        *   Add field `url` -> Select "URL" (from input).
8.  **Get Dictionary Value**: Get `id` from the "Contents of URL" result.
9.  **Wait**: Add "Wait" action (e.g., 5-10 seconds) to allow processing.
10. **Get Contents of URL (Check Status)**:
    *   **URL**: `https://localhost:5173/api/automation/status/` + Select the `id` variable.
    *   **Method**: GET
    *   **Headers**: Same as above.
11. **Show Notification**:
    *   If `status` is `completed`, show "Recipe Imported!".
    *   If `status` is `failed`, show "Import Failed".

### Example Curl

```bash
# 1. Trigger Import
curl -X POST "https://your-instance.com/api/automation/import" \
     -H "Content-Type: application/json" \
     -H "X-API-Key: YOUR_API_KEY" \
     -u "username:password" \
     -d '{"url": "https://www.chefkoch.de/rezepte/..."}'

# Response: {"id": "job-123", ...}

# 2. Check Status
curl -X GET "https://your-instance.com/api/automation/status/job-123" \
     -H "X-API-Key: YOUR_API_KEY" \
     -u "username:password"
```
