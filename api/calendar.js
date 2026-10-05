/* Live calendar feed of D-days (the target days) for one person on one board.
 *
 *   GET /api/calendar?p=<project>&owner=<owner id>
 *
 * Subscribe in Google Calendar (Other calendars → From URL) and it refreshes by
 * itself. Only D-days go on calendars, never tasks: the person's own D-days plus
 * the ones owned by everyone, with reminders 3 days and 1 day before.
 */
import { hasStore, getBoard, PID_OK, ownedBy, projectName, addDays, boardUrl, ddaysOf } from "./_board.js";

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
    `SUMMARY:${E(summary)}`, `DESCRIPTION:${E(desc)}`, `URL:${url}`, "TRANSP:TRANSPARENT",
    ...alarms.flatMap(([trig, txt]) => ["BEGIN:VALARM", "ACTION:DISPLAY", `TRIGGER:${trig}`, `DESCRIPTION:${E(txt)}`, "END:VALARM"]),
    "END:VEVENT",
  ];
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nancy//Projects//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${E(name)} D-days${who ? " · " + E(who) : ""}`, "REFRESH-INTERVAL;VALUE=DURATION:PT4H", "X-PUBLISHED-TTL:PT4H"];
  for (const d of ddaysOf(doc).filter(d => !d.done && ownedBy(d, owner))) {
    const due = (doc.tasks || []).filter(t => t.date === d.date && !t.note).map(t => `• ${t.title}`).join("\n");
    L.push(...ev(`${p}-dday-${d.id}`, d.date, `🎯 ${d.label} · ${name}`,
      [`D-day. Owner: ${d.owner === "all" ? "Everyone" : doc.owners?.[d.owner]?.name || d.owner}`, due ? `Due that day:\n${due}` : "", `Board: ${url}`].filter(Boolean).join("\n\n"),
      [["-P3D", `3 days to ${d.label}`], ["-P1D", `Tomorrow: ${d.label}`]]));
  }
  L.push("END:VCALENDAR");
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=900");
  res.status(200).send(L.map(fold).join("\r\n"));
}
