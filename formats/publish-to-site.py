#!/usr/bin/env python3
"""Copy the built one-pager into the live site's output directory.

build.py writes public/index.built.html with the thumbnails and set data
already inlined; that is what ships. cleanUrls serves the page at /NAME with
no trailing slash, so relative asset paths resolve against the domain root and
404 — rewrite them root-absolute for the published copy only.

Run build.py first, then this, then commit and push.
"""
import pathlib, shutil

here = pathlib.Path(__file__).parent
src  = here / "public"
dest = here.parent / "public" / "content-references"

built = src / "index.built.html"
if not built.exists():
    raise SystemExit("run build.py first — no index.built.html")

if dest.exists():
    shutil.rmtree(dest)
(dest / "assets").mkdir(parents=True)
shutil.copy(src / "assets" / "nancy-logo-ink.svg", dest / "assets" / "nancy-logo-ink.svg")

html = built.read_text()
for placeholder in ("__THUMBS__", "__SETS__", "__MM__", "__ANAT__"):
    if placeholder in html:
        raise SystemExit("unsubstituted: %s" % placeholder)
before = html.count('src="assets/')
html = html.replace('src="assets/', 'src="/%s/assets/' % dest.name)
(dest / "index.html").write_text(html)

files = sorted(p for p in dest.rglob("*") if p.is_file())
total = sum(p.stat().st_size for p in files)
print("published %d files (%.0f KB) -> %s  [%d asset paths rewritten]"
      % (len(files), total / 1024, dest.relative_to(here.parent), before))
