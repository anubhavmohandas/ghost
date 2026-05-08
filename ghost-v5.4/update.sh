#!/usr/bin/env bash
# GHOST — pull latest changes from GitHub
# Usage: double-click or run  ./update.sh

set -e
cd "$(dirname "$0")"

echo ""
echo "👻 GHOST — Updater"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check git is available
if ! command -v git &>/dev/null; then
  echo "❌  git is not installed. Install it from https://git-scm.com and retry."
  exit 1
fi

# Check this is a git repo
if [ ! -d ".git" ]; then
  echo "❌  This folder is not a git repo. Clone from GitHub first:"
  echo "    git clone https://github.com/anubhavmohandas/GHOST.git"
  exit 1
fi

echo "📡  Fetching latest from origin/main ..."
git fetch origin

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "✅  Already up to date ($(git rev-parse --short HEAD))."
else
  git pull --ff-only origin main
  echo ""
  echo "✅  Updated to $(git rev-parse --short HEAD)"
  echo ""
  echo "📋  Changes:"
  git log --oneline "$LOCAL"..HEAD
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄  Reload the extension:"
echo "    Chrome  → chrome://extensions  → click the ↺ reload button next to GHOST"
echo "    Firefox → about:debugging      → click Reload"
echo ""
