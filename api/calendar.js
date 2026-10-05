/* Live calendar feed of P1 days (Priority one) for one person on one board.
 *
 *   GET /api/calendar?p=<project>&owner=<owner id>
 *
 * Subscribe in Google Calendar (Other calendars → From URL) and it refreshes by
 * itself. Only P1 items go on calendars, never ordinary tasks: the person's own
 * P1 days (Medusa teaser drops, giveaway opens, winners announced…), with
 * reminders 3 days and 1 day before.
 */
import { hasStore, getBoard, PID_OK, ownedBy, isDone, isP1, projectName, addDays, boardUrl } from "./_board.js";

const D = d => d.replace(/-/g, "");
const E = v => String(v ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const fold = l => {
  const ch = [...l], out = [];
  for (let i = 0; i < ch.length; i += 60) out.push((i ? " " : "") + ch.slice(i, i + 60).join(""));
  return out.join("\r\n");
};

export default async function handler(req, res) {
  const p = String(req.query?.p || "monster-mansion");
  const owner = req.query?.owner ? String(req.query.owner) : "";
  if (!PID_OK.test(p) || (owner && !PID_OK.test(owner))) {
    res.status(400).send("bad request");
    return;
  }
  if (!hasStore()) {
    res.status(503).send("no store");
    return;
  }
  const doc = await getBoard(p);
  if (!doc) {
    res.status(404).send("no board");
    return;
  }
  const name = projectName(p, doc);
  const who = owner ? doc.owners?.[owner]?.name || owner : "";
  const url = boardUrl(p);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const ev = (uid, date, summary, desc, alarms = []) => [
    "BEGIN:VEVENT", `UID:${uid}@nancy-projects`, `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${D(date)}`, `DTEND;VALUE=DATE:${D(addDays(date, 1))}`,
    `SUMMARY:${E(summary)}`, `URL:${url}`, "TRANSP:TRANSPARENT",
    ...alarms.flatMap(([trig, txt]) => ["BEGIN:VALARM", "ACTION:DISPLAY", `TRIGGER:${trig}`, `DESCRIPTION:${E(txt)}`, "END:VALARM"]),
    "END:VEVENT",
  ];
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nancy//Projects//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${E(name)} P1${who ? " · " + E(who) : ""}`, "REFRESH-INTERVAL;VALUE=DURATION:PT4H", "X-PUBLISHED-TTL:PT4H"];
  for (const t of (doc.tasks || []).filter(t => t.date && isP1(t) && !isDone(t) && ownedBy(t, owner))) {
    const ownerName = t.owner === "all" ? "Everyone" : doc.owners?.[t.owner]?.name || t.owner;
    L.push(...ev(`${p}-p1-${t.id}`, t.date, `P1 · ${t.title} · ${name}`,
      [`P1 · Priority one. Owner: ${ownerName}`, t.need ? `Need: ${t.need}` : "", t.give ? `Give: ${t.give}` : "", `Board: ${url}`].filter(Boolean).join("\n\n"),
      [["-P3D", `3 days to go: ${t.title}`], ["-P1D", `Tomorrow: ${t.title}`]]));
  }
  L.push("END:VCALENDAR");
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=900");
  res.status(200).send(L.map(fold).join("\r\n"));
}
