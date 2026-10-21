#!/usr/bin/env bash
#
# Usage: scripts/release-all.sh     (npm run release-all)
#
# Releases every sibling repo this one pins, pins the new tags here and redeploys every site:
#
#   1. Release ../arrmatura-books and each site's content repo (../<site>; they share the name).
#      HEAD already tagged with its package.json version → that tag is reused. Otherwise the
#      version is bumped (patch; a version still untagged is released as is), the repo is built
#      if it has a `build` script, then the commit and the tag are pushed. The tag keeps the
#      repo's style, `1.2.3` or `v1.2.3`, taken from its nearest tag.
#   2. Pin the tags here: the arrmatura-books URLs in cml/ and each `gen:index:<site>` in
#      package.json, then regenerate each site's index.html (gen:index reads jsDelivr).
#   3. Deploy every site.
#
# A target must be a clean checkout of main that is not behind origin. Stops at the first error;
# re-running is safe, since released repos are reused.

set -eu

cd "$(dirname "$0")/.."

# release <dir>: releases the repo if HEAD is not released yet; prints the tag naming HEAD.
release() (
  set -eu # command substitution drops -e
  cd "$1"
  name=$(basename "$1")

  [ "$(git rev-parse --abbrev-ref HEAD)" = main ] || { echo "❌ $name: not on main" >&2; exit 1; }
  [ -z "$(git status --porcelain)" ] || { echo "❌ $name: dirty tree — commit or stash first" >&2; exit 1; }
  git fetch --quiet origin main
  git merge-base --is-ancestor origin/main HEAD || { echo "❌ $name: behind origin/main — pull first" >&2; exit 1; }

  prefix=$(git describe --tags --abbrev=0 2>/dev/null | grep -o '^v' || true)
  version=$(node -p 'require("./package.json").version')
  tag="$prefix$version"

  if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
    if [ "$(git rev-list -n 1 "$tag")" = "$(git rev-parse HEAD)" ]; then
      echo "✅ $name: $tag is current" >&2
      echo "$tag"
      exit 0
    fi
    version=$(npm version patch --no-git-tag-version | tr -d v)
    tag="$prefix$version"
  fi

  npm run build --if-present >&2
  git add -A
  git diff --cached --quiet || git commit --quiet -m "$version"
  git push --quiet origin main
  git tag -a "$tag" -m "$version"
  git push --quiet origin "$tag"
  echo "✅ $name: released $tag" >&2
  echo "$tag"
)

sites=$(node -p 'Object.keys(require("./package.json").scripts).filter((k) => k.startsWith("gen:index:")).map((k) => k.slice(10)).join(" ")')

# 1. Release, before anything here changes.
books=$(release ../arrmatura-books)
tags=""
for site in $sites; do
  tags="$tags $(release "../$site")"
done

# 2. Pin.
perl -pi -e "s#(arrmatura-books@)[^/]+/#\${1}$books/#g" cml/head.xml cml/html.xml
set -- $tags
for site in $sites; do
  perl -pi -e "s#(/$site/)[^/]+/#\${1}$1/# if /\"gen:index:$site\"/" package.json
  shift
  npm run "gen:index:$site"
done

# 3. Deploy.
for site in $sites; do
  SITE="$site" npm run deploy
done
