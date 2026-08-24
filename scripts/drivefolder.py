"""Read a public Drive folder listing with no credentials.

Drive's folder page renders a real HTML table -- one <tr> per child, carrying
the id in data-id and the folder's own ordering in aria-rowindex. No API key,
no OAuth, nothing to rotate or leak.

Folder vs file: a folder reports no size, so Drive labels it "Size not
available" where a file carries "Size: 3.2 MB". That is semantic rather than
cosmetic, unlike the icon class names, which are obfuscated and churn.
"""
import re, html, time, urllib.request, urllib.error

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")

class NotShared(Exception):
    """Folder is not readable without signing in (404/403 to an anonymous GET)."""

def fetch(fid, timeout=30, tries=3):
    url = f"https://drive.google.com/drive/folders/{fid}?hl=en"
    req = urllib.request.Request(url, headers={"User-Agent": UA,
                                               "Accept-Language": "en-US,en;q=0.9"})
    last = None
    for n in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code in (403, 404):
                raise NotShared(f"{fid}: HTTP {e.code} -- folder is not shared publicly")
            last = e
        except Exception as e:
            last = e
        time.sleep(1.5 * (n + 1))
    raise last

def parse(page):
    items = []
    for m in re.finditer(r'<tr [^>]*data-id="([^"]+)"[^>]*aria-rowindex="(\d+)"[^>]*>', page):
        fid, idx = m.group(1), int(m.group(2))
        end = page.find("</tr>", m.end())
        body = page[m.end():end]
        has_size = "Size: " in body
        txt = html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", body))).strip()
        name = re.sub(r"^(Video|Image|Audio|PDF|File)\s+", "", txt)
        name = re.sub(r"\s+(Shared|Owned by me|Download).*$", "", name).strip()
        items.append({"i": idx, "id": fid, "name": name,
                      "kind": "file" if has_size else "folder"})
    items.sort(key=lambda x: x["i"])
    return items

def read(fid):
    return parse(fetch(fid))

def read_tree(fid):
    """One level down: files stay files, subfolders come back with their slides.
    That is exactly the folder rule -- a FILE is a reel, a SUBFOLDER is a carousel."""
    out = []
    for it in read(fid):
        if it["kind"] == "folder":
            it = dict(it, slides=[c for c in read(it["id"]) if c["kind"] == "file"])
        out.append(it)
    return out

if __name__ == "__main__":
    import sys, json
    print(json.dumps(read_tree(sys.argv[1]), indent=1))
