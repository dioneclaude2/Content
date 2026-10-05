/* Shared storage for the Monster Mansion follow-up board, so Dione and Crystal
 * see the same tasks on every device.
 *
 * Same Upstash Redis store as api/socials.js. The whole board is one JSON doc
 * in its own key; the client keeps the newest copy by updatedAt and never lets
 * an empty doc replace one that has tasks.
 *
 *   GET  /api/mansion?p=<id>          -> { doc }  (doc is null until the first save)
 *   POST /api/mansion?p=<id>  { doc } -> saves the board
 *
 * If MANSION_PASSCODE is set, writes need it in the x-passcode header.
 */
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
/* ?p=<project id> picks the board; Monster Mansion keeps its original key. */
const keyFor = p => (!p || p === "monster-mansion" ? "monster-mansion:board" : `pm:board:${p}`);

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return (await r.json()).result;
}

const ORIGINS = /^https:\/\/(dioneclaude2\.github\.io|content[\w-]*\.vercel\.app)$/;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const origin = req.headers.origin || "";
  if (ORIGINS.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-passcode");
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (!URL_ || !TOKEN) {
    res.status(503).json({ error: "no-store" });
    return;
  }
  const p = String(req.query?.p || "monster-mansion");
  if (!/^[a-z0-9-]{1,48}$/.test(p)) {
    res.status(400).json({ error: "bad project" });
    return;
  }
  const KEY = keyFor(p);
  try {
    if (req.method === "GET") {
      const raw = await redis(["GET", KEY]);
      let doc = null;
      try { doc = raw ? JSON.parse(raw) : null; } catch { /* corrupt, treat as empty */ }
      res.status(200).json({ doc });
      return;
    }
    if (req.method === "POST") {
      const pass = process.env.MANSION_PASSCODE;
      if (pass && req.headers["x-passcode"] !== pass) {
        res.status(401).json({ error: "passcode" });
        return;
      }
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const doc = body.doc;
      if (!doc || !Array.isArray(doc.tasks) || typeof doc.updatedAt !== "number") {
        res.status(400).json({ error: "bad doc" });
        return;
      }
      const json = JSON.stringify(doc);
      if (json.length > 500_000) {
        res.status(413).json({ error: "too large" });
        return;
      }
      await redis(["SET", KEY, json]);
      res.status(200).json({ ok: true });
      return;
    }
    res.status(405).json({ error: "method" });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
