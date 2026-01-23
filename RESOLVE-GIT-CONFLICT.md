# 🔧 Resolve Git Pull Conflict

## Problem

Git pull is failing because you have local changes to `scripts/check-fabric-usage.sh` that would be overwritten.

## Solution Options

### Option 1: Stash Your Changes (Recommended)

This saves your changes temporarily, pulls the update, then reapplies your changes:

```bash
# Save your local changes temporarily
git stash

# Pull the latest changes
git pull

# Reapply your changes (if needed)
git stash pop
```

**If there are conflicts after `git stash pop`:**
- Review the conflicts
- Keep your version or the remote version
- Or manually merge them

### Option 2: Commit Your Changes First

If you want to keep your changes:

```bash
# Add your changes
git add scripts/check-fabric-usage.sh

# Commit them
git commit -m "Fix check-fabric-usage.sh script bugs"

# Then pull (may need to merge)
git pull
```

### Option 3: Discard Your Local Changes

If you want to use the remote version instead:

```bash
# Discard local changes to this file
git checkout -- scripts/check-fabric-usage.sh

# Then pull
git pull
```

### Option 4: See What Changed

First, see what your local changes are:

```bash
# See your local changes
git diff scripts/check-fabric-usage.sh

# See what's in the remote
git diff HEAD origin/main scripts/check-fabric-usage.sh
```

---

## Recommended: Option 1 (Stash)

Since the script fixes are important, I recommend:

```bash
git stash
git pull
git stash pop
```

Then check if there are conflicts and resolve them if needed.
