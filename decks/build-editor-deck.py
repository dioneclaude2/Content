#!/usr/bin/env python3
"""Inline the brand assets so the deck is self-contained.

Fonts, the logo and six real stills all become data URIs — nothing is fetched
at open time, so it renders the same on a founder's laptop as it does here.
"""
import base64, json, pathlib, sys

here = pathlib.Path(__file__).parent
root = here.parent
assets = root / "crew-guide" / "public" / "assets"
cache  = root / "crew-guide" / "brain" / "thumbcache"
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else here / "built.html"

def uri(path, mime):
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()

html = (here / "editor-team-proposal.html").read_text()

for token, name in [("__PPE_UL__", "PPEditorialNew-Ultralight.otf"),
                    ("__PPE_RG__", "PPEditorialNew-Regular.otf"),
                    ("__PPE_IT__", "PPEditorialNew-Italic.otf"),
                    ("__PPE_UB__", "PPEditorialNew-Ultrabold.otf")]:
    html = html.replace(token, uri(assets / name, "font/otf"), 1)

html = html.replace("__LOGO__", uri(assets / "nancy-logo-cream.svg", "image/svg+xml"), 1)

# six covers, chosen for variety across the events
picks = ["1Pp0dGZSwSKhCf7b-grc8w_VtSej_I-1G", "1S2xto7i4Em35WW2Savx5HlOdH0Xn_OEE",
         "14q2_91LbASxRy6f-97DDWL6PR9KFsCIO", "1p6_-bu0Erg9WS9P4r1Or_j_RqPXzJD9b",
         "1WJbRITn3X3x2a1d2wY6hbZrpqn7pWIvZ", "1lFNaRgJkUgXb9Mj8XA1LAG4IoDO1XuVh"]
strip = [uri(cache / f"{p}_w400.jpg", "image/jpeg") for p in picks]
html = html.replace("__STRIP__", json.dumps(strip), 1)

left = [t for t in ("__PPE_", "__LOGO__", "__STRIP__") if t in html]
if left:
    raise SystemExit("unsubstituted tokens: %s" % left)

out.write_text(html)
print("built %s (%.0f KB)" % (out.name, out.stat().st_size / 1024))
