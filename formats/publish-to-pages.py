#!/usr/bin/env python3
"""Publish the built one-pager to the public GitHub Pages site.

Pages serves the repo under /nancy-guides/, so every root-absolute path the
Vercel copy uses has to carry that prefix too. Run build.py first.
"""
import json, pathlib, shutil, sys

here = pathlib.Path(__file__).parent
SC = pathlib.Path("/private/tmp/claude-502/-Users-dione-Desktop-Content/45cb1241-63e0-47be-bf03-e170a95f33a6/scratchpad")
pages = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else SC / "pages"
dest = pages / "content-references"
BASE = "/nancy-guides/content-references/"

built = here / "public" / "index.built.html"
if not built.exists():
    raise SystemExit("run build.py first")

if dest.exists():
    shutil.rmtree(dest)
(dest / "assets").mkdir(parents=True)
(dest / "videos").mkdir()
(dest / "downloads").mkdir()

shutil.copy(here / "public" / "assets" / "nancy-logo-ink.svg", dest / "assets" / "nancy-logo-ink.svg")

clips = list(json.loads((SC / "minimic.json").read_text()))
for group in json.loads((SC / "highlights.json").read_text()).values():
    clips += group
for m in clips:
    shutil.copy(m["src"], dest / "videos" / m["file"])

for src in (json.loads((SC / "logos.json").read_text()),
            json.loads((SC / "cards.json").read_text())):
    for c in src["items"]:
        shutil.copy(c["src"], (dest / "downloads") / c["file"])
    shutil.copy(src["zip"], (dest / "downloads") / src["zipname"])


html = built.read_text()
for placeholder in ("__THUMBS__", "__SETS__", "__MM__", "__HL__", "__CARDS__",
                    "__ANAT__", "__VIDEOBASE__", "__CARDBASE__"):
    if placeholder in html:
        raise SystemExit("unsubstituted: %s" % placeholder)
n = html.count("/content-references/")
html = html.replace("/content-references/", BASE)
(dest / "index.html").write_text(html)

files = sorted(p for p in dest.rglob("*") if p.is_file())
total = sum(p.stat().st_size for p in files)
print("published %d files (%.0f MB) -> %s  [%d paths rebased to %s]"
      % (len(files), total / 1048576, dest, n, BASE))
