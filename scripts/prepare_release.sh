#!/bin/bash

# Exit on error
set -e

# Check if version argument is provided
if [ -z "$1" ]; then
    echo "🔍 No version argument provided. Starting interactive mode..."
    
    # Get latest tag (globally, not just reachable)
    LAST_TAG=$(git tag --sort=-v:refname | head -n 1)
    if [ -z "$LAST_TAG" ]; then
        LAST_TAG="0.0.0"
    fi
    # Remove 'v' prefix if present
    VERSION_CLEAN=${LAST_TAG#v}
    
    # Parse version (Simple parsing assuming X.Y.Z format)
    IFS='.' read -r MAJOR MINOR PATCH_AND_SUFFIX <<< "$VERSION_CLEAN"
    # Separate Patch and Suffix (e.g. 10-beta.1)
    PATCH=${PATCH_AND_SUFFIX%%-*}
    
    echo "ℹ️  Current Version: $LAST_TAG (Parsed: $MAJOR.$MINOR.$PATCH)"
    
    # 1. Ask for Release Type
    echo ""
    echo "Select Release Type:"
    echo "  [0] Beta"
    echo "  [1] Stable"
    read -p "Choice (0/1): " RELEASE_TYPE_INPUT
    
    # Check if current version is beta
    IS_BETA=false
    if [[ "$PATCH_AND_SUFFIX" == *"-"* ]]; then
        IS_BETA=true
    fi

    # 2. Ask for Update Type
    echo ""
    echo "Select Update Type:"
    if [ "$IS_BETA" = true ]; then
        echo "  [0] Promote to Stable ($MAJOR.$MINOR.$PATCH)"
    fi
    echo "  [1] Hotfix (Patch $MAJOR.$MINOR.$((PATCH+1)))"
    echo "  [2] Minor  (Minor $MAJOR.$((MINOR+1)).0)"
    echo "  [3] Major  (Major $((MAJOR+1)).0.0)"
    read -p "Choice (0-3): " UPDATE_TYPE_INPUT
    
    # Calculate New Version
    NEXT_MAJOR=$MAJOR
    NEXT_MINOR=$MINOR
    NEXT_PATCH=$PATCH
    
    case $UPDATE_TYPE_INPUT in
        0)
            if [ "$IS_BETA" = false ]; then
                echo "❌ Cannot promote non-beta version."
                exit 1
            fi
            # Keep current version numbers, just strip beta (handled by forcing Stable type below)
            RELEASE_TYPE_INPUT="1" 
            ;;
        1)
            NEXT_PATCH=$((PATCH + 1))
            ;;
        2)
            NEXT_MINOR=$((MINOR + 1))
            NEXT_PATCH=0
            ;;
        3)
            NEXT_MAJOR=$((MAJOR + 1))
            NEXT_MINOR=0
            NEXT_PATCH=0
            ;;
        *)
            echo "❌ Invalid update type selected."
            exit 1
            ;;
    esac
    
    NEW_VERSION="$NEXT_MAJOR.$NEXT_MINOR.$NEXT_PATCH"
    
    if [ "$RELEASE_TYPE_INPUT" == "0" ]; then
        NEW_VERSION="${NEW_VERSION}-beta.1"
    fi
    
    echo ""
    echo "🎯 Target Version: $NEW_VERSION"
    read -p "Is this correct? (y/n): " CONFIRM
    if [[ "$CONFIRM" != "y" ]]; then
        echo "Aborted."
        exit 1
    fi
    
else
    NEW_VERSION=$1
fi
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
# 4. Update CHANGELOG.md (Prepend new entry)
echo "📄 Updating CHANGELOG.md..."
DATE=$(date +%Y-%m-%d)

# Find the last tag
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

if [ -z "$LAST_TAG" ]; then
    echo "No previous tag found. Getting all commits."
    COMMITS=$(git log --pretty=format:"- %s")
else
    echo "Getting commits since $LAST_TAG..."
    COMMITS=$(git log "$LAST_TAG"..HEAD --pretty=format:"- %s")
fi

# Filter out "chore: bump version" commits to avoid noise
COMMITS=$(echo "$COMMITS" | grep -v "chore: bump version")

# Create a temporary file with the new entry
cat <<EOF > changelog_temp.md
## [$NEW_VERSION] - $DATE
### Changes
$COMMITS

EOF
# Insert after the header (line 2)
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
