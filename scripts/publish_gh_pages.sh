#!/bin/sh
# Copies the Nancy Socials planner page to the gh-pages branch, which GitHub Pages
# serves at https://dioneclaude2.github.io/Content/nancy-socials/. The copy reads its
# data and syncs through the Vercel site, so only index.html needs publishing.
# Run after changing public/nancy-socials/index.html on main.
set -e
cd "$(git rev-parse --show-toplevel)"
W=$(mktemp -d)
git fetch -q origin gh-pages
git worktree add -q "$W" origin/gh-pages
git show HEAD:public/nancy-socials/index.html > "$W/nancy-socials/index.html"
cd "$W"
if git diff --quiet; then echo "gh-pages already up to date"; else
  git commit -qam "Publish Nancy Socials to GitHub Pages"
  git push -q origin HEAD:gh-pages
  echo "published"
fi
cd - >/dev/null
git worktree remove --force "$W"
