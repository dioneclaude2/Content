#!/usr/bin/env python3
"""Inline the slide thumbnails and the set data.

The strips have to render even where Drive is unreachable, so every thumbnail
ships as a data URI. Video playback still needs Drive — a frame cannot carry
the clip — so the player iframe stays a live URL.
"""
import base64, json, pathlib, sys

here = pathlib.Path(__file__).parent
SC = pathlib.Path("/private/tmp/claude-502/-Users-dione-Desktop-Content/45cb1241-63e0-47be-bf03-e170a95f33a6/scratchpad")
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else here / "build.html"

data = json.loads((SC / "carousels.json").read_text())
types = json.loads((SC / "types.json").read_text())
NAMES = {"Boat 1": "Boat 1", "c_": "Boat 3", "Girls in Boat 2": "Girls in Boat 2"}
ORDER = ["Boat 1", "Girls in Boat 2", "c_"]

sets, thumbs = [], {}
for key in ORDER:
    v = data[key]
    tag = key.replace(" ", "_")
    slides = []
    for n, s in enumerate(v["slides"], 1):
        f = SC / "cthumb" / f"{tag}_{n:02d}.jpg"
        if f.exists():
            thumbs[s["id"]] = "data:image/jpeg;base64," + base64.b64encode(f.read_bytes()).decode()
        slides.append({"id": s["id"], "t": s["t"], "ty": types[key][n - 1]})
    sets.append({"name": NAMES.get(key, key), "folder": v["folder"], "slides": slides})

mm = json.loads((SC / "minimic.json").read_text())
for m in mm:
    f = SC / m["poster"]
    if not f.exists():
        raise SystemExit("no poster: %s" % f)
    m["poster"] = "data:image/jpeg;base64," + base64.b64encode(f.read_bytes()).decode()
anat = "data:image/jpeg;base64," + base64.b64encode((SC / "mm" / "anat_big.jpg").read_bytes()).decode()

html = (here / "public" / "index.html").read_text()
missing = [s["id"] for st in sets for s in st["slides"] if s["id"] not in thumbs]
if missing:
    raise SystemExit("no thumbnail for: %s" % missing[:5])
html = (html.replace("__THUMBS__", json.dumps(thumbs), 1)
            .replace("__SETS__", json.dumps(sets), 1)
            .replace("__MM__", json.dumps(mm), 1)
            .replace("__ANAT__", anat, 1))

# the artifact host supplies doctype/head; drop ours and inline the wordmark
art = "\n".join(l for l in html.splitlines()
                if l.strip() not in ("<!DOCTYPE html>", '<meta charset="UTF-8">')
                and not l.startswith('<meta name="viewport"'))
logo = (here / "public" / "assets" / "nancy-logo-ink.svg").read_bytes()
art = art.replace('src="assets/nancy-logo-ink.svg"',
                  'src="data:image/svg+xml;base64,%s"' % base64.b64encode(logo).decode())
if "__" in art.replace("__NANCY", ""):
    leftover = [w for w in ("__THUMBS__", "__SETS__", "__MM__", "__ANAT__") if w in art]
    if leftover: raise SystemExit("unsubstituted: %s" % leftover)
out.write_text(art)
(here / "public" / "index.built.html").write_text(html)
print("artifact %s (%.1f MB) · %d thumbnails · %d sets · %d mini mic" %
      (out.name, out.stat().st_size / 1048576, len(thumbs), len(sets), len(mm)))
