#!/bin/bash

# Exit on error
set -e

# Check if version argument is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <new_version>"
    echo "Example: $0 1.0.2-beta.1"
    exit 1
fi

NEW_VERSION=$1
CURRENT_BRANCH=$(git branch --show-current)

# Extract base version (e.g., 1.0.2 from 1.0.2-beta.1)
BASE_VERSION=$(echo "$NEW_VERSION" | cut -d'-' -f1)
BRANCH_NAME="v$BASE_VERSION"

# Detect Remote (prefer 'bakencook', fallback to 'origin')
REMOTE="origin"
if git remote | grep -q "bakencook"; then
    REMOTE="bakencook"
fi

echo "🚀 Preparing release for version: $NEW_VERSION"
echo "🌿 Target Branch: $BRANCH_NAME"
echo "📡 Using remote: $REMOTE"

# 1. Create or Checkout branch
if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
    echo "Checking out existing branch $BRANCH_NAME..."
    git checkout "$BRANCH_NAME"
else
    echo "Creating new branch $BRANCH_NAME..."
    git checkout -b "$BRANCH_NAME"
fi

# 2. Update VERSION file
echo "📝 Updating VERSION file..."
echo "$NEW_VERSION" > VERSION

# 3. Update frontend/package.json
echo "📦 Updating frontend/package.json..."
# Use sed to replace version. Mac requires '' for backup extension.
sed -i '' "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" frontend/package.json

# 4. Update CHANGELOG.md (Prepend new entry)
echo "📄 Updating CHANGELOG.md..."
DATE=$(date +%Y-%m-%d)
# Create a temporary file with the new entry
cat <<EOF > changelog_temp.md
## [$NEW_VERSION] - $DATE
### Added
- [TODO: Add your changes here]

EOF
# Insert after the header (line 2)
# Assuming line 1 is "# Changelog" and line 2 is empty or existing content
# We will insert after line 2 to keep the title
sed -i '' '2r changelog_temp.md' CHANGELOG.md
rm changelog_temp.md

# 5. Commit changes
echo "💾 Committing changes..."
git add VERSION frontend/package.json CHANGELOG.md
git commit -m "chore: bump version to $NEW_VERSION"

# 6. Push branch
echo "VX Pushing branch to $REMOTE..."
git push "$REMOTE" "$BRANCH_NAME"

echo "✅ Release branch pushed successfully!"
echo ""
echo "👉 Next Steps:"
echo "1. Open CHANGELOG.md and edit the TODO items for this release."
echo "2. Commit and push the changelog updates if you made changes:"
echo "   git add CHANGELOG.md && git commit --amend --no-edit && git push $REMOTE $BRANCH_NAME -f"
echo "3. Go to GitHub and create the release:"
echo "   https://github.com/Ayakashi97/bakencook/releases/new"
echo "   - Tag: v$NEW_VERSION"
echo "   - Target: $BRANCH_NAME"
echo "   - Title: v$NEW_VERSION"
