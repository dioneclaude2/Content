#!/usr/bin/env python3
"""Re-sync the moodboards against Drive.

Why a command and not a live fetch on every page load:

  * Drive holds only id, name and order. Everything that makes the page worth
    reading -- captions, creator handles, palettes, TikTok embeds, shot lists --
    is authored here and exists nowhere in Drive. Any sync has to MERGE, never
    replace, so it can't be a dumb mirror.
  * A per-request fetch would put Drive's uptime, rate limits and HTML on the
    critical path of every visit. Drive changing its markup would take the live
    site down; here it only breaks this script, and the site keeps serving.

So: run this when files are added, read the diff, commit the result.

Edits are surgical -- it appends slide ids and reorders reels in place. It
never regenerates a MOODBOARD block, because that would throw away the
hand-authored captions and palettes sitting in it.

    python3 scripts/sync_drive.py           # dry run, prints the diff
    python3 scripts/sync_drive.py --write   # apply it
"""
import io, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import drivefolder as df

PUB = os.path.join(os.path.dirname(HERE), "public")
MONTHS = ["January","February","March","April","May","June","July",
          "August","September","October","November","December"]
M_FULL = {m: i + 1 for i, m in enumerate(MONTHS)}
M_ABBR = {m[:3]: i + 1 for i, m in enumerate(MONTHS)}


def live_date(name):
    m = re.search(r"([A-Z][a-z]+)\s+(\d{1,2}),\s*(\d{4})", name)
    return (int(m.group(3)) % 100, M_FULL.get(m.group(1), 0), int(m.group(2))) if m else None


def static_date(label):
    m = re.match(r"(\d{2})\s+([A-Za-z]{3})\s+(\d{2})", label)
    return (int(m.group(3)), M_ABBR.get(m.group(2), 0), int(m.group(1))) if m else None


def year_blocks(src):
    """Slice out each { year:"...", folderId:"..." ... } block, with offsets."""
    out = []
    for m in re.finditer(r'\{\s*year:"([^"]+)",\s*folderId:"([^"]+)"', src):
        depth, i = 0, m.start()
        while i < len(src):
            if src[i] == "{": depth += 1
            elif src[i] == "}":
                depth -= 1
                if depth == 0: break
            i += 1
        out.append({"year": m.group(1), "folder": m.group(2),
                    "start": m.start(), "end": i + 1, "text": src[m.start():i + 1]})
    return out


def carousels_in(block):
    """Each carousel's d-label and the span of its slides:[...] array."""
    out = []
    for m in re.finditer(r'\{\s*d:"([^"]+)"', block):
        sm = re.search(r"slides:\s*\[", block[m.start():])
        if not sm: continue
        s = m.start() + sm.end()
        depth, i = 1, s
        while i < len(block):
            if block[i] == "[": depth += 1
            elif block[i] == "]":
                depth -= 1
                if depth == 0: break
            i += 1
        out.append({"d": m.group(1), "slides_start": s, "slides_end": i,
                    "body": block[s:i]})
    return out


def slide_ids(body):
    """Slides come in two shapes -- a bare "fileId" string, or an object
    carrying caption/href/embed alongside the id. Matching any quoted 25+
    char id-shaped token catches both; URLs in the object form never contain
    a run that long without a / or . breaking it up."""
    return re.findall(r'"([A-Za-z0-9_-]{25,})"', body)


def sync(path, write=False):
    src = io.open(path, encoding="utf-8").read()
    changes, edits = [], []      # edits: (abs_start, abs_end, replacement)

    for yb in year_blocks(src):
        try:
            tree = df.read_tree(yb["folder"])
        except df.NotShared:
            changes.append(f"  {yb['year']}: folder is not shared publicly -- skipped, nothing verified")
            continue

        live_files = [x for x in tree if x["kind"] == "file"]
        live_dirs  = [x for x in tree if x["kind"] == "folder"]
        block = yb["text"]

        # --- reels: same files, wrong order -> reorder in place ---
        rm = re.search(r"reels:\s*\[", block)
        if rm:
            depth, i = 1, rm.end()
            while i < len(block):
                if block[i] == "[": depth += 1
                elif block[i] == "]":
                    depth -= 1
                    if depth == 0: break
                i += 1
            body = block[rm.end():i]
            entries = re.findall(r"\{[^{}]*fileId:\"([^\"]+)\"[^{}]*\}", body)
            full    = re.findall(r"\{[^{}]*fileId:\"[^\"]+\"[^{}]*\}", body)
            by_id   = dict(zip(entries, full))
            want    = [x["id"] for x in live_files if x["id"] in by_id]
            missing = [x for x in live_files if x["id"] not in by_id]
            if want and want != entries:
                indent = "\n          "
                new = indent + ("," + indent).join(by_id[k] for k in want) + "\n        "
                edits.append((yb["start"] + rm.end(), yb["start"] + i, new))
                changes.append(f"  {yb['year']}: reels reordered to match the folder ({len(want)} files)")
            for x in missing:
                changes.append(f"  {yb['year']}: NEW reel in Drive, not on site -- {x['name'][:56]}")

        # --- carousels: append slides that exist in Drive but not on the page ---
        smap = {static_date(c["d"]): c for c in carousels_in(block) if static_date(c["d"])}
        for d in live_dirs:
            key = live_date(d["name"])
            car = smap.get(key)
            if not car:
                changes.append(f"  {yb['year']}: NEW carousel in Drive, not on site -- {d['name'][:52]}")
                continue
            have = set(slide_ids(car["body"]))
            add  = [s for s in d["slides"] if s["id"] not in have]
            gone = [h for h in have if h not in {s["id"] for s in d["slides"]}]
            if gone:
                changes.append(f"  {yb['year']} {car['d']}: {len(gone)} slide(s) on site are no longer in Drive -- left alone, check by hand")
            if add:
                tail = car["body"].rstrip()
                sep  = "," if tail and not tail.endswith(",") else ""
                ind  = "\n              "
                new  = tail + sep + ind + ("," + ind).join(f'{{"id": "{s["id"]}"}}' for s in add) + "\n            "
                edits.append((yb["start"] + car["slides_start"], yb["start"] + car["slides_end"], new))
                changes.append(f"  {yb['year']} {car['d']}: +{len(add)} slide(s) from Drive")

    if not changes:
        changes.append("  already in sync")
    print(f"\n{os.path.basename(path)}")
    for c in changes: print(c)

    if write and edits:
        for a, b, rep in sorted(edits, key=lambda e: -e[0]):
            src = src[:a] + rep + src[b:]
        io.open(path, "w", encoding="utf-8").write(src)
        print(f"  -> wrote {len(edits)} edit(s)")
    return len(edits)


if __name__ == "__main__":
    write = "--write" in sys.argv
    n = sum(sync(os.path.join(PUB, f), write) for f in ("cancun.html", "us-open.html"))
    if n and not write:
        print("\nDry run. Re-run with --write to apply.")
