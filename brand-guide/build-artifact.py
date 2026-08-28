#!/usr/bin/env python3
"""Build the Artifact copy of the brand guide.

Same contract as the crew guide's: the host supplies doctype/head/body and
blocks external hosts, so strip our own wrappers and inline the fonts, the
logo and the Drive thumbnails as data URIs. Thumbnails come from the crew
guide's cache, so nothing is downloaded twice.
"""
import base64, json, pathlib, re, sys

here = pathlib.Path(__file__).parent
src  = here / "public" / "index.html"
out  = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else here / "artifact.html"
html = src.read_text()

drop = ("<!DOCTYPE html>", '<meta charset="UTF-8">')
html = "\n".join(l for l in html.splitlines()
                 if l.strip() not in drop and not l.startswith('<meta name="viewport"'))

def datauri(rel, mime):
    return "data:%s;base64,%s" % (mime, base64.b64encode((here / "public" / rel).read_bytes()).decode())

for name in ("Ultralight", "Regular", "Italic", "Ultrabold"):
    rel = "assets/PPEditorialNew-%s.otf" % name
    html = html.replace("url('%s')" % rel, "url('%s')" % datauri(rel, "font/otf"))
html = html.replace('src="assets/nancy-logo-cream.svg"',
                    'src="%s"' % datauri("assets/nancy-logo-cream.svg", "image/svg+xml"))

cache = here.parent / "crew-guide" / "brain" / "thumbcache"
if cache.exists():
    thumbs = {}
    for f in sorted(cache.glob("*_w*.jpg")):
        thumbs[f.name.rsplit("_w", 1)[0]] = "data:image/jpeg;base64," + base64.b64encode(f.read_bytes()).decode()
    if thumbs:
        html = html.replace("const THUMBS = {};", "const THUMBS = " + json.dumps(thumbs) + ";", 1)
        print("  inlined %d thumbnails" % len(thumbs))

leftover = re.findall(r'(?:url\(\'|src=")assets/[^\'"]+', html)
if leftover:
    raise SystemExit("un-inlined asset refs remain: %s" % leftover)

out.write_text(html)
print("wrote %s (%.0f KB)" % (out, out.stat().st_size / 1024))
