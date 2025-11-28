# Releasing a New Version

This guide describes how to release a new version of Bake'n'Cook using the automation script.

## Prerequisites

- Ensure you are on the branch you want to release from (usually `main` or a feature branch).
- Ensure your working directory is clean.

## Automated Release Steps

1.  **Run the preparation script:**
    Provide the new version number (e.g., `1.0.2` or `1.0.2-beta.1`).

    ```bash
    ./scripts/prepare_release.sh 1.0.2-beta.1
    ```

    This script will:
    - Create a new git branch `v<version>`.
    - Update `VERSION` file.
    - Update `frontend/package.json`.
    - Add a template entry to `CHANGELOG.md`.
    - Commit and push the branch to the remote repository.

2.  **Review and Edit Changelog (Optional):**
    The script adds a `[TODO]` entry to `CHANGELOG.md`. You should edit this file to reflect the actual changes.
    
    ```bash
    # Edit the file
    nano CHANGELOG.md
    
    # Commit the update (amend the previous commit to keep history clean)
    git add CHANGELOG.md
    git commit --amend --no-edit
    git push bakencook v1.0.2-beta.1 -f
    ```

3.  **Create GitHub Release:**
    - Go to: [https://github.com/Ayakashi97/bakencook/releases/new](https://github.com/Ayakashi97/bakencook/releases/new)
    - **Tag version**: Enter `v1.0.2-beta.1` (must match the version you used).
    - **Target**: Select the branch created by the script (e.g., `v1.0.2-beta.1`).
    - **Title**: `v1.0.2 Beta 1`
    - **Description**: Copy the content from your `CHANGELOG.md`.
    - **Pre-release**: Check this box if it is a beta/alpha version.
    - Click **Publish release**.

## Manual Steps (if script fails)

1.  Update `VERSION` file with new version.
2.  Update `frontend/package.json` version.
3.  Update `CHANGELOG.md`.
4.  `git checkout -b v<version>`
5.  `git add .`
6.  `git commit -m "chore: bump version to <version>"`
7.  `git push bakencook v<version>`
8.  Create Release on GitHub.
