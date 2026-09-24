/* Shared storage for Nancy Socials, so the week plan, team and event notes
 * are the same on every device.
 *
 * Backed by Upstash Redis over its REST API (plain fetch, no SDK). Vercel's
 * Upstash integration injects KV_REST_API_URL / KV_REST_API_TOKEN; the
 * UPSTASH_REDIS_REST_* names are accepted too. Everything lives in one hash,
 * one field per client key (ns.team, ns.mnotes, ns.week3.<monday>).
 *
 *   GET  /api/socials                 -> { docs: { key: value, ... } }
 *   POST /api/socials  { key, value } -> saves one key (value null deletes it)
 *
 * If SOCIALS_PASSCODE is set, writes need it in the x-passcode header.
 */
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const HASH = "nancy-socials";
const KEY_OK = /^ns\.(team|mnotes|week3\.\d{4}-\d{2}-\d{2})$/;

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return (await r.json()).result;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
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
      const { key, value } = body;
      if (!KEY_OK.test(key || "")) {
        res.status(400).json({ error: "bad key" });
        return;
      }
      const json = value == null ? null : JSON.stringify(value);
      if (json && json.length > 500_000) {
        res.status(413).json({ error: "too large" });
        return;
      }
      await (json == null ? redis(["HDEL", HASH, key]) : redis(["HSET", HASH, key, json]));
      res.status(200).json({ ok: true });
      return;
    }
    res.status(405).json({ error: "method" });
  } catch (e) {
    res.status(502).json({ error: "store unavailable" });
  }
}
