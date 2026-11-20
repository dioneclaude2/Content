#!/bin/sh
# Publishes Social Stats (public/social-stats/) to the gh-pages branch, which GitHub Pages
# serves at https://dioneclaude2.github.io/Content/social-stats/.
# Each file's "?v=dev" imports are stamped with the commit, so browsers never mix a new
# page with an old cached engine.js / pdf.js.
set -e
cd "$(git rev-parse --show-toplevel)"
V=$(git rev-parse --short HEAD)
W=$(mktemp -d)
git fetch -q origin gh-pages
git worktree add -q "$W" origin/gh-pages
mkdir -p "$W/social-stats"
for f in index.html engine.js pdf.js sources.json; do
  git show "HEAD:public/social-stats/$f" | sed "s/?v=dev/?v=$V/g" > "$W/social-stats/$f"
done
for f in logo-circle.svg logo-wordmark-cream.svg; do git show "HEAD:public/social-stats/$f" > "$W/social-stats/$f"; done
cd "$W"
git add social-stats
if git diff --cached --quiet; then echo "gh-pages already up to date"; else
  git commit -qm "Publish Social Stats ($V)"
  git push -q origin HEAD:gh-pages
  echo "published $V"
fi
cd - >/dev/null
git worktree remove --force "$W"
