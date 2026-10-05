/* Shared helpers for the project-board endpoints (mansion, calendar, alerts).
 * Files starting with _ are not routes on Vercel. */
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const hasStore = () => Boolean(URL_ && TOKEN);

export async function redis(cmd) {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return (await r.json()).result;
}

export const PID_OK = /^[a-z0-9-]{1,48}$/;
export const boardKey = p => (!p || p === "monster-mansion" ? "monster-mansion:board" : `pm:board:${p}`);
/* Owner emails are stored apart from the board, so the public board JSON never carries them. */
export const emailsKey = p => `pm:emails:${p || "monster-mansion"}`;

export async function getBoard(p) {
  const raw = await redis(["GET", boardKey(p)]);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export async function getEmails(p) {
  const raw = await redis(["GET", emailsKey(p)]);
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
/* Every stored board: Monster Mansion plus pm:board:* */
export async function allProjects() {
  const ids = ["monster-mansion"];
  let cursor = "0";
  do {
    const [next, keys] = await redis(["SCAN", cursor, "MATCH", "pm:board:*", "COUNT", "100"]);
    cursor = String(next);
    keys.forEach(k => ids.push(k.slice("pm:board:".length)));
  } while (cursor !== "0");
  return ids;
}

const ORIGINS = /^https:\/\/(dioneclaude2\.github\.io|content[\w-]*\.vercel\.app)$/;
export function cors(req, res, methods = "GET, POST, OPTIONS") {
  const origin = req.headers.origin || "";
  if (ORIGINS.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", methods);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-passcode");
  }
}

/* ---------- task helpers (mirror the board page) ---------- */
export const isDone = t => t.status === "Done" || t.status === "Approved";
export const ownedBy = (t, o) => !o || t.owner === o || t.owner === "all";
export const projectName = (p, doc) => doc?.config?.short || doc?.config?.name || (p === "monster-mansion" ? "Monster Mansion" : p);
/* P1 · Priority one = the specific days we aim for (the only items on calendars); tasks are T1–T3. */
export const PRI = { p1: "P1 · Priority one", t1: "T1 · Critical task", t2: "T2 · High", t3: "T3 · Normal" };
export const priOf = t => (PRI[t.priority] ? t.priority : "t3");
export const isP1 = t => priOf(t) === "p1" && !t.note;
export const personName = (doc, id) => doc?.people?.[id]?.name || id || "";

/* Dates in Hong Kong time, where the team works. */
export function hkToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong" }).format(new Date());
}
export function addDays(s, n) {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function fmt(s) {
  const d = new Date(`${s}T00:00:00Z`);
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const boardUrl = p => `https://dioneclaude2.github.io/Content/projects/board/?p=${p}`;

