#!/usr/bin/env bash
#
# Usage: scripts/bump-version.sh [path-to-version-file]
#   defaults to ./www/version (relative to cwd, i.e. the app dir)
#
# Bumps the integer cache-busting version in a `version` file.
# The service worker reads `/version` to derive its cache name, so bumping
# this on deploy invalidates stale client caches.

set -eu

file="${1:-./www/version}"

# No version file yet — start from 0.
current=$(cat "$file" 2>/dev/null | tr -dc '0-9')
current=$((10#${current:-0}))
next=$((current + 1))

printf '%s' "$next" > "$file"
echo "Bumped version: $current → $next ($file)"
