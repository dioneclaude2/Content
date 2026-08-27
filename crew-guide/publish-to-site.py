#!/usr/bin/env python3
"""Copy the built guide into the live site's output directory.

The guide is its own site and wants its own Vercel project. Until that project
exists, this publishes it as a self-contained folder under the existing
deployment, which auto-deploys from main. Nothing links to it from the events
index — it is an unlisted path that happens to share a domain.

Run this after editing crew-guide/public/, then commit and push.
"""
import pathlib, shutil, sys

here = pathlib.Path(__file__).parent
src  = here / "public"
dest = here.parent / "public" / "crew-guide"

if dest.exists():
    shutil.rmtree(dest)
shutil.copytree(src, dest)

files = sorted(p for p in dest.rglob("*") if p.is_file())
total = sum(p.stat().st_size for p in files)
print(f"published {len(files)} files ({total/1024:.0f} KB) -> {dest.relative_to(here.parent)}")
for p in files:
    print("  ", p.relative_to(dest))
