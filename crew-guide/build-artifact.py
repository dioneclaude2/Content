#!/usr/bin/env python3
"""Build the Artifact copy of the guide.

The Artifact host supplies <!doctype>/<head>/<body> and blocks requests to
external hosts, so relative asset URLs never resolve there. Strip our own
doctype/meta and inline the fonts and the logo as data URIs, otherwise the
type specimen silently falls back and shows the wrong faces.
Google Fonts is the one external host that is allowed, so Fraunces stays linked.
"""
import base64, json, pathlib, re, sys

here = pathlib.Path(__file__).parent
src = here / "public" / "index.html"
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else here / "artifact.html"
html = src.read_text()

drop = ("<!DOCTYPE html>", '<meta charset="UTF-8">')
html = "\n".join(l for l in html.splitlines()
                 if l.strip() not in drop and not l.startswith('<meta name="viewport"'))

def datauri(rel, mime):
    raw = (here / "public" / rel).read_bytes()
    return "data:%s;base64,%s" % (mime, base64.b64encode(raw).decode())

for name in ("Ultralight", "Regular", "Italic", "Ultrabold"):
    rel = "assets/PPEditorialNew-%s.otf" % name
    html = html.replace("url('%s')" % rel, "url('%s')" % datauri(rel, "font/otf"))

html = html.replace('src="assets/nancy-logo-cream.svg"',
                    'src="%s"' % datauri("assets/nancy-logo-cream.svg", "image/svg+xml"))

# The caption brain lives outside public/ so the deployed site can never serve
# it. Inject it here, into the private artifact copy only.
# The caption brain lives outside public/ so the deployed site can never serve
# it. Inject it only if the page still asks for it — the captions page no
# longer does, but the payload and this hook stay for when a tool needs them.
if "__NANCY_BRAIN__" in html:
    brain = (here / "brain" / "brain-data.json").read_text()
    html = html.replace('"__NANCY_BRAIN__"', brain, 1)
    if "__NANCY_BRAIN__" in html:
        raise SystemExit("brain placeholder still present after injection")

leftover = re.findall(r'(?:url\(\'|src=")assets/[^\'"]+', html)
if leftover:
    raise SystemExit("un-inlined asset refs remain: %s" % leftover)

out.write_text(html)
print("wrote %s (%.0f KB)" % (out, out.stat().st_size / 1024))
