#!/bin/bash
# TrustChain LTO - Resolve Git Pull Conflict
# Helps resolve conflicts when pulling updates

set -e

echo "🔧 Resolving Git pull conflict..."

# Check current status
echo "📋 Current Git status:"
git status --short

echo ""
echo "Options:"
echo "1. Stash local changes and pull (recommended)"
echo "2. Discard local changes and pull (WARNING: loses local changes)"
echo "3. Commit local changes first, then pull"
echo ""
read -p "Choose option (1/2/3): " choice

case $choice in
    1)
        echo "📦 Stashing local changes..."
        git stash push -m "Local changes before pull $(date +%Y-%m-%d)"
        
        echo "⬇️  Pulling remote changes..."
        git pull
        
        echo "📋 Checking if stashed changes conflict..."
        if git stash list | head -1 | grep -q "stash@{0}"; then
            echo "💡 To apply stashed changes back:"
            echo "   git stash pop"
            echo ""
            echo "💡 To see what was stashed:"
            echo "   git stash show -p"
        fi
        ;;
    2)
        echo "⚠️  WARNING: This will discard local changes!"
        read -p "Are you sure? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            echo "🗑️  Discarding local changes..."
            git checkout -- scripts/instantiate-chaincode.sh scripts/setup-fabric-channel.sh
            
            echo "⬇️  Pulling remote changes..."
            git pull
        else
            echo "Aborted."
            exit 1
        fi
        ;;
    3)
        echo "📝 Committing local changes..."
        git add scripts/instantiate-chaincode.sh scripts/setup-fabric-channel.sh
        git commit -m "Local TLS certificate fixes"
        
        echo "⬇️  Pulling remote changes..."
        git pull
        
        echo "💡 If there are merge conflicts, resolve them manually:"
        echo "   git status"
        echo "   # Edit conflicted files"
        echo "   git add <files>"
        echo "   git commit"
        ;;
    *)
        echo "Invalid option. Aborted."
        exit 1
        ;;
esac

echo ""
echo "✅ Done!"
echo ""
echo "📋 Current status:"
git status --short

