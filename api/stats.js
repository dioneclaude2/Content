/* Shared storage for Social Stats (posts, ad exports, reports, settings), so the
 * whole team works from one copy.
 *
 * Same Upstash Redis as /api/socials, separate hash. Each record is one field:
 *   ss.settings · ss.post.<shortcode> · ss.import.<id> · ss.report.<id>
 * Every value carries updatedAt; a write only lands if it is at least as new as
 * what's stored, so an old or blank copy in someone's browser can't overwrite
 * newer work. Deletes are tombstones ({deleted: true, updatedAt}).
 *
 *   GET  /api/stats                    -> { docs: { key: value, ... } }
 *   POST /api/stats  { docs: {k: v} }  -> { ok, stale: { key: storedValue } }
 *
 * If SOCIALS_PASSCODE is set, writes need it in the x-passcode header.
 */
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const HASH = "social-stats";
const KEY_OK = /^ss\.(settings|post\.[\w-]{5,40}|import\.[\w-]{4,40}|report\.[\w-]{4,40})$/;

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
  try {
    if (req.method === "GET") {
      const flat = (await redis(["HGETALL", HASH])) || [];
      const docs = {};
      for (let i = 0; i < flat.length; i += 2) {
        try { docs[flat[i]] = JSON.parse(flat[i + 1]); } catch { /* skip a corrupt field */ }
      }
      res.status(200).json({ docs });
      return;
    }
    if (req.method === "POST") {
      const pass = process.env.SOCIALS_PASSCODE;
      if (pass && req.headers["x-passcode"] !== pass) {
        res.status(401).json({ error: "passcode" });
        return;
      }
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const entries = Object.entries(body.docs || {});
      if (!entries.length || entries.length > 200) {
        res.status(400).json({ error: "docs" });
        return;
      }
      for (const [k, v] of entries) {
        if (!KEY_OK.test(k) || !v || typeof v !== "object" || !Number.isFinite(v.updatedAt)) {
          res.status(400).json({ error: "bad doc", key: k });
          return;
        }
        if (JSON.stringify(v).length > 900_000) {
          res.status(413).json({ error: "too large", key: k });
          return;
        }
      }
      const keys = entries.map(([k]) => k);
      const current = (await redis(["HMGET", HASH, ...keys])) || [];
      const write = [], stale = {};
      entries.forEach(([k, v], i) => {
        let old = null;
        try { old = current[i] ? JSON.parse(current[i]) : null; } catch { /* overwrite corrupt */ }
        if (old && (old.updatedAt || 0) > v.updatedAt) stale[k] = old;   // someone saved something newer
        else write.push(k, JSON.stringify(v));
      });
      if (write.length) await redis(["HSET", HASH, ...write]);
      res.status(200).json({ ok: true, stale });
      return;
    }
    res.status(405).json({ error: "method" });
  } catch (e) {
    res.status(502).json({ error: "store unavailable" });
  }
}
