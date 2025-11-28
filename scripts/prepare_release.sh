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

# Detect Remote (prefer 'bakencook', fallback to 'origin')
REMOTE="origin"
if git remote | grep -q "bakencook"; then
    REMOTE="bakencook"
fi

echo "🚀 Preparing release for version: $NEW_VERSION"
echo "📡 Using remote: $REMOTE"

# 1. Create new branch
echo "🌿 Creating release branch v$NEW_VERSION..."
git checkout -b "v$NEW_VERSION"

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
git push "$REMOTE" "v$NEW_VERSION"

echo "✅ Release branch pushed successfully!"
echo ""
echo "👉 Next Steps:"
echo "1. Open CHANGELOG.md and edit the TODO items for this release."
echo "2. Commit and push the changelog updates if you made changes:"
echo "   git add CHANGELOG.md && git commit --amend --no-edit && git push $REMOTE v$NEW_VERSION -f"
echo "3. Go to GitHub and create the release:"
echo "   https://github.com/Ayakashi97/bakencook/releases/new"
echo "   - Tag: v$NEW_VERSION"
echo "   - Target: v$NEW_VERSION"
echo "   - Title: v$NEW_VERSION"
