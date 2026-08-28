#!/usr/bin/env python3
"""Copy the built brand guide into the live site's output directory."""
import pathlib, shutil
here = pathlib.Path(__file__).parent
dest = here.parent / "public" / "brand-guide"
if dest.exists():
    shutil.rmtree(dest)
shutil.copytree(here / "public", dest)
files = sorted(p for p in dest.rglob("*") if p.is_file())
print("published %d files (%.0f KB) -> %s" % (len(files),
      sum(p.stat().st_size for p in files)/1024, dest.relative_to(here.parent)))
