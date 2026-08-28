#!/usr/bin/env python3
"""Copy the built brand guide into the live site's output directory."""
import pathlib, shutil
here = pathlib.Path(__file__).parent
dest = here.parent / "public" / "brand-guide"
if dest.exists():
    shutil.rmtree(dest)
shutil.copytree(here / "public", dest)

# cleanUrls serves this page at /NAME with no trailing slash, so a relative
# "assets/..." resolves against the domain root and 404s — silently, in the
# case of @font-face. Rewrite to root-absolute for the published copy only;
# the source keeps relative paths, which is what the Artifact build inlines.
idx = dest / "index.html"
html = idx.read_text()
before = html.count("assets/")
html = html.replace("url('assets/", "url('/%s/assets/" % dest.name)
html = html.replace('src="assets/', 'src="/%s/assets/' % dest.name)
idx.write_text(html)
after = html.count('"assets/') + html.count("'assets/")
print("  rewrote %d relative asset paths -> /%s/assets/ (%d relative left)"
      % (before - after, dest.name, after))
files = sorted(p for p in dest.rglob("*") if p.is_file())
print("published %d files (%.0f KB) -> %s" % (len(files),
      sum(p.stat().st_size for p in files)/1024, dest.relative_to(here.parent)))
