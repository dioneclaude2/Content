/* Streams a Drive file's raw bytes through our own origin.
 *
 * Why this exists: Drive's direct-content URLs (uc?export=view, uc?export=
 * download, etc.) all send `Cross-Origin-Resource-Policy: same-site`, which
 * makes browsers refuse to load them in a <video src> tag from any other
 * origin -- confirmed by testing, not assumed. The /preview iframe is
 * exempt because iframe embedding is governed by frame-ancestors, not CORP,
 * which is why that's worked everywhere else on this site. A server-side
 * fetch isn't a browser, so CORP doesn't apply to it -- fetch here, hand it
 * back from our own domain, and the browser sees a same-origin video.
 *
 * Nothing is stored: every request streams live from Drive. That keeps the
 * "media stays on Drive, we only store links" rule intact.
 */
export default async function handler(req, res) {
  const id = req.query.id;
  if (!id || !/^[\w-]{15,}$/.test(id)) {
    res.status(400).json({ error: "missing or invalid id" });
    return;
  }

  const upstreamHeaders = {};
  if (req.headers.range) upstreamHeaders.Range = req.headers.range;

  let upstream;
  try {
    upstream = await fetch(`https://drive.google.com/uc?export=view&id=${id}`, {
      headers: upstreamHeaders,
      redirect: "follow",
    });
  } catch (e) {
    res.status(502).json({ error: "upstream fetch failed" });
    return;
  }

  if (!upstream.ok && upstream.status !== 206) {
    res.status(upstream.status).json({ error: `upstream returned ${upstream.status}` });
    return;
  }

  res.status(upstream.status);
  const passthrough = [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "last-modified",
    "etag",
  ];
  for (const h of passthrough) {
    const v = upstream.headers.get(h);
    if (v) res.setHeader(h, v);
  }
  /* Vercel's edge cache doesn't vary by Range by default -- caching a
     206 here means every later request, with whatever Range it actually
     asked for, gets served that one cached slice back regardless
     (confirmed: a HEAD-only warm-up request poisoned the cache for real
     video-element range requests afterward). Only full 200 responses
     are safe to cache; partial ones must bypass the edge entirely. */
  res.setHeader("Cache-Control", upstream.status === 206 ? "no-store" : "public, max-age=3600");

  if (!upstream.body) {
    res.end();
    return;
  }
  /* A manual reader.read()/res.write() loop ignores res.write()'s
     backpressure signal and stalls partway through on anything but a
     tiny file (confirmed: playback froze a few seconds in). Readable.
     fromWeb().pipe() handles backpressure correctly. */
  const { Readable } = await import("node:stream");
  Readable.fromWeb(upstream.body).pipe(res);
}
