#!/usr/bin/env bash
#
# Usage: scripts/link-shared.sh
#
# Spreads shared/www/* into every site: for each www_<site>/ (a folder holding an
# index.html) and each file in shared/www/, makes www_<site>/<file> a RELATIVE symlink
# to ../shared/www/<file>. The links are committed; git stores them as symlinks, and both
# firebase deploy and esbuild's dev server follow them. So each shared file has ONE copy.
#
# A link that is missing is created; one pointing elsewhere is fixed. A REAL file of that
# name is the site's own version and is left alone, with a note. Safe to re-run.
# Run by `npm run link` / `postinstall`, and by scripts/new-site.ts.

set -eu

cd "$(dirname "$0")/.."

for site in www_*; do
  [ -f "$site/index.html" ] || continue
  for src in shared/www/*; do
    [ -f "$src" ] || continue
    name=$(basename "$src")
    dest="$site/$name"
    target="../shared/www/$name"
    if [ -L "$dest" ]; then
      [ "$(readlink "$dest")" = "$target" ] && continue
      ln -sfn "$target" "$dest"
      echo "fixed  $dest -> $target"
    elif [ -e "$dest" ]; then
      echo "kept   $dest: a real file, the site's own version" >&2
    else
      ln -s "$target" "$dest"
      echo "linked $dest -> $target"
    fi
  done
done
