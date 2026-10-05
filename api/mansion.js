/* Shared storage for the project boards (Monster Mansion and every new project),
 * so Dione and Crystal see the same tasks on every device.
 *
 * Same Upstash Redis store as api/socials.js. Each board is one JSON doc in its
 * own key; the client keeps the newest copy by updatedAt and never lets an
 * empty doc replace one that has tasks.
 *
 *   GET  /api/mansion?p=<id>                        -> { doc }  (null until the first save)
 *   POST /api/mansion?p=<id>  { doc }               -> saves the board
 *   GET  /api/mansion?p=<id>&emails=1               -> { emails: { owner: "d***@x.com" } }  (masked)
 *   POST /api/mansion?p=<id>&emails=1 { owner, email } -> sets one person's alert email ("" clears)
 *
 * Owner emails live in their own key and are never returned in full, so the
 * public board JSON doesn't carry them. If MANSION_PASSCODE is set, writes need
 * it in the x-passcode header.
 */
import { hasStore, redis, cors, PID_OK, boardKey, emailsKey, getEmails } from "./_board.js";

const mask = e => e.replace(/^(.).*(@.*)$/, "$1***$2");

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (!hasStore()) {
    res.status(503).json({ error: "no-store" });
    return;
  }
  const p = String(req.query?.p || "monster-mansion");
  if (!PID_OK.test(p)) {
    res.status(400).json({ error: "bad project" });
    return;
  }
  const pass = process.env.MANSION_PASSCODE;
  const writeOK = () => !pass || req.headers["x-passcode"] === pass;
  const body = () => (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {});
  try {
    if (req.query?.emails) {
      const emails = await getEmails(p);
      if (req.method === "GET") {
        res.status(200).json({ emails: Object.fromEntries(Object.entries(emails).map(([k, v]) => [k, mask(v)])) });
        return;
      }
      if (req.method === "POST") {
        if (!writeOK()) {
          res.status(401).json({ error: "passcode" });
          return;
        }
        const { owner, email } = body();
        if (!PID_OK.test(owner || "") || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
          res.status(400).json({ error: "bad email" });
          return;
        }
        if (email) emails[owner] = email.trim().toLowerCase();
        else delete emails[owner];
        await redis(["SET", emailsKey(p), JSON.stringify(emails)]);
        res.status(200).json({ ok: true });
        return;
      }
    }
    if (req.method === "GET") {
      const raw = await redis(["GET", boardKey(p)]);
      let doc = null;
      try { doc = raw ? JSON.parse(raw) : null; } catch { /* corrupt, treat as empty */ }
      res.status(200).json({ doc });
      return;
    }
    if (req.method === "POST") {
      if (!writeOK()) {
        res.status(401).json({ error: "passcode" });
        return;
      }
      const doc = body().doc;
      if (!doc || !Array.isArray(doc.tasks) || typeof doc.updatedAt !== "number") {
        res.status(400).json({ error: "bad doc" });
        return;
      }
      const json = JSON.stringify(doc);
      if (json.length > 500_000) {
        res.status(413).json({ error: "too large" });
        return;
      }
      await redis(["SET", boardKey(p), json]);
      res.status(200).json({ ok: true });
      return;
    }
    res.status(405).json({ error: "method" });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
