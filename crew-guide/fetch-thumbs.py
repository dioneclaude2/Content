#!/usr/bin/env python3
"""Download Drive thumbnails once into a local cache.

The Artifact build inlines these as data URIs so the examples render with no
external request at all. Nothing is uploaded by hand — the ids come from the
shared folder and the bytes come straight from Drive.
Cached on disk, so a rebuild costs nothing.
"""
import json, pathlib, sys, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

here = pathlib.Path(__file__).parent
cache = here / "brain" / "thumbcache"
cache.mkdir(parents=True, exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0"}

COVER_W, SLIDE_W = 400, 600

def grab(fid, w):
    dest = cache / f"{fid}_w{w}.jpg"
    if dest.exists() and dest.stat().st_size > 0:
        return dest, False
    url = f"https://drive.google.com/thumbnail?id={fid}&sz=w{w}"
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=45) as r:
        data = r.read()
    if not data.startswith(b"\xff\xd8"):
        raise ValueError(f"{fid}: not a JPEG ({len(data)} bytes)")
    dest.write_bytes(data)
    return dest, True

def main():
    d = json.loads((here / "brain" / "drive-examples.json").read_text())
    jobs = []
    for items in d.values():
        for it in items:
            jobs.append(((it["cover"] if it["t"] == "carousel" else it["id"]), COVER_W))
            for sid in it.get("slides", []):
                jobs.append((sid, SLIDE_W))
    jobs = [j for j in jobs if j[0]]
    got = new = 0
    fails = []

    def one(job):
        fid, w = job
        for attempt in range(3):
            try:
                return grab(fid, w)
            except Exception as e:
                if attempt == 2:
                    return e
        return None

    with ThreadPoolExecutor(max_workers=12) as pool:
        for job, res in zip(jobs, pool.map(one, jobs)):
            if isinstance(res, Exception):
                fails.append(f"{job[0]}@w{job[1]}: {type(res).__name__} {res}")
            else:
                got += 1
                new += 1 if res[1] else 0
    total = sum(p.stat().st_size for p in cache.glob("*.jpg"))
    print(f"{got}/{len(jobs)} cached ({new} newly fetched), {total/1024/1024:.1f} MB on disk")
    for f in fails:
        print("  FAILED", f)
    return 1 if fails else 0

if __name__ == "__main__":
    sys.exit(main())
