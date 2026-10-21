#!/usr/bin/env bash
#
# Usage: scripts/deploy.sh <site> [firebase args...]     e.g. scripts/deploy.sh engx --dry-run
#
# Deploys one site's hosting. The Firebase project is the one whose .firebaserc
# "targets.<project>.hosting" names <site>; the target maps to the Firebase site id.
# Run by `SITE=<site> npm run deploy` (after predeploy builds).

set -eu

[ $# -gt 0 ] || { echo "usage: $0 <site> [firebase args...]" >&2; exit 1; }
site="$1"
shift

cd "$(dirname "$0")/.."

project=$(node -e '
  const [site] = process.argv.slice(1);
  const rc = JSON.parse(require("fs").readFileSync(".firebaserc", "utf8"));
  const hit = Object.entries(rc.targets ?? {}).find(([, t]) => t?.hosting?.[site]);
  if (hit) console.log(hit[0]);
' "$site")

[ -n "$project" ] || { echo "❌ No hosting target \"$site\" in .firebaserc" >&2; exit 1; }

echo "Deploying hosting:$site to project $project"
exec firebase deploy --only "hosting:$site" --config ./firebase.json -P "$project" "$@"
