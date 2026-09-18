#!/usr/bin/env python3
"""Copy the built one-pager into the live site's output directory.

build.py writes public/index.built.html with the thumbnails and set data
already inlined; that is what ships. cleanUrls serves the page at /NAME with
no trailing slash, so relative asset paths resolve against the domain root and
404 — rewrite them root-absolute for the published copy only.

Run build.py first, then this, then commit and push.
"""
import json, pathlib, shutil

SC = pathlib.Path("/private/tmp/claude-502/-Users-dione-Desktop-Content/45cb1241-63e0-47be-bf03-e170a95f33a6/scratchpad")

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

vids = dest / "videos"
vids.mkdir()
clips = list(json.loads((SC / "minimic.json").read_text()))
for group in json.loads((SC / "highlights.json").read_text()).values():
    clips += group
for m in clips:
    shutil.copy(m["src"], vids / m["file"])

cards = json.loads((SC / "cards.json").read_text())
cdir = dest / "title-cards"
cdir.mkdir()
for c in cards["items"]:
    shutil.copy(c["src"], cdir / c["file"])
shutil.copy(cards["zip"], cdir / cards["zipname"])

html = built.read_text()
for placeholder in ("__THUMBS__", "__SETS__", "__MM__", "__HL__", "__CARDS__", "__ANAT__", "__VIDEOBASE__", "__CARDBASE__"):
    if placeholder in html:
        raise SystemExit("unsubstituted: %s" % placeholder)
before = html.count('src="assets/')
html = html.replace('src="assets/', 'src="/%s/assets/' % dest.name)
(dest / "index.html").write_text(html)

files = sorted(p for p in dest.rglob("*") if p.is_file())
total = sum(p.stat().st_size for p in files)
print("published %d files (%.0f KB) -> %s  [%d asset paths rewritten]"
      % (len(files), total / 1024, dest.relative_to(here.parent), before))
