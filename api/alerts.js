/* Email alerts from the project boards (not from Google Calendar).
 *
 *   GET /api/alerts?kind=weekly   Monday: this week's tasks, anything not done from before,
 *                                  upcoming (next 14 days) and overdue D-days
 *   GET /api/alerts?kind=daily    Daily: overdue tasks, tasks due in the next 2 days,
 *                                  D-days in the next 3 days and overdue D-days (sent only if any)
 *
 * Run by Vercel Cron (vercel.json). Each person gets only what's under their name
 * (D-days owned by everyone go to everyone). Emails come from pm:emails:<project>,
 * set on the board's By person view.
 *
 * Needs: RESEND_API_KEY, ALERT_FROM (a sender on a domain verified in Resend),
 * CRON_SECRET (Vercel sends it as a Bearer token). Add &dry=1 to preview without sending.
 */
import { hasStore, getBoard, getEmails, allProjects, isDone, ownedBy, priOf, personName, projectName, hkToday, addDays, fmt, esc, boardUrl, ddaysOf } from "./_board.js";

async function send(to, subject, html) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.ALERT_FROM, to: [to], subject, html }),
  });
  if (!r.ok) throw new Error(`resend ${r.status}: ${await r.text()}`);
}

const PILL = { p1: "#e2445c", p2: "#f2a01e", p3: "#579bfc" };
function row(doc, t, today) {
  const pr = priOf(t), late = t.date < today;
  return `<tr><td style="padding:8px 10px;border-bottom:1px solid #f0e6da;white-space:nowrap;font:12px monospace;color:${late ? "#e2445c" : "#8f7480"}">${fmt(t.date)}${late ? " · late" : ""}</td>
    <td style="padding:8px 4px;border-bottom:1px solid #f0e6da"><span style="background:${PILL[pr]};color:#fff;border-radius:4px;padding:1px 6px;font:700 10px sans-serif">${pr.toUpperCase()}</span></td>
    <td style="padding:8px 10px;border-bottom:1px solid #f0e6da;font:14px sans-serif;color:#1f1216">${esc(t.title)}<div style="font-size:12px;color:#8f7480">${esc(personName(doc, t.who))}${t.need ? " · Need: " + esc(t.need) : ""}</div></td></tr>`;
}
function wrap(title, intro, sections, link) {
  return `<div style="background:#faf3e6;padding:24px;font-family:Inter,Helvetica,Arial,sans-serif;color:#1f1216">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#ec2f8e,#ff5f7e 55%,#f7a8c8);color:#fff;padding:20px 24px">
      <div style="font:11px monospace;letter-spacing:.18em;text-transform:uppercase;opacity:.9">Nancy · Projects</div>
      <div style="font:400 26px Georgia,serif;margin-top:6px">${title}</div></div>
    <div style="padding:18px 24px"><p style="font-size:14px;color:#5e4b52;margin:0 0 14px">${intro}</p>${sections}
    <p style="margin:20px 0 4px"><a href="${link}" style="background:#ec2f8e;color:#fff;text-decoration:none;padding:10px 16px;border-radius:999px;font:600 13px sans-serif">Open the board →</a></p></div>
  </div></div>`;
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  if (!hasStore()) {
    res.status(503).json({ error: "no-store" });
    return;
  }
  const kind = req.query?.kind === "daily" ? "daily" : "weekly";
  const dry = req.query?.dry === "1" || !process.env.RESEND_API_KEY || !process.env.ALERT_FROM;
  const today = hkToday(), weekEnd = addDays(today, 6);

  /* Collect per email address across projects, so each person gets one email. */
  const inbox = {};
  const H = (txt, n, c) => `<div style="font:700 11px monospace;letter-spacing:.14em;color:${c};margin:12px 0 4px">${txt} · ${n}</div>`;
  const ddRow = (d, late) => `<tr><td style="padding:8px 10px;border-bottom:1px solid #f0e6da;font:12px monospace;color:${late ? "#e2445c" : "#00a862"};white-space:nowrap">${fmt(d.date)}${late ? " · late" : ""}</td><td style="padding:8px 10px;border-bottom:1px solid #f0e6da;font:14px sans-serif">🎯 ${esc(d.label)}</td></tr>`;
  for (const p of await allProjects()) {
    const doc = await getBoard(p);
    if (!doc?.tasks) continue;
    const emails = await getEmails(p);
    const name = projectName(p, doc);
    const ddays = ddaysOf(doc).filter(d => !d.done);
    for (const [owner, email] of Object.entries(emails)) {
      if (!email) continue;
      const mine = doc.tasks.filter(t => t.date && !t.note && !isDone(t) && ownedBy(t, owner)).sort((a, b) => a.date.localeCompare(b.date));
      const myDd = ddays.filter(d => ownedBy(d, owner)).sort((a, b) => a.date.localeCompare(b.date));
      const overdue = mine.filter(t => t.date < today);
      const soon = kind === "weekly" ? mine.filter(t => t.date >= today && t.date <= weekEnd) : mine.filter(t => t.date >= today && t.date <= addDays(today, 2));
      const ddLate = myDd.filter(d => d.date < today);
      const ddSoon = myDd.filter(d => d.date >= today && d.date <= addDays(today, kind === "weekly" ? 14 : 3));
      if (!overdue.length && !soon.length && !ddLate.length && !ddSoon.length) continue;
      const box = (inbox[email] ||= { who: doc.owners?.[owner]?.name || owner, parts: [], over: 0, soon: 0, dd: 0, link: boardUrl(p) });
      box.over += overdue.length + ddLate.length; box.soon += soon.length; box.dd += ddSoon.length;
      const table = list => `<table style="width:100%;border-collapse:collapse">${list.map(t => row(doc, t, today)).join("")}</table>`;
      const ddTable = (list, late) => `<table style="width:100%;border-collapse:collapse">${list.map(d => ddRow(d, late)).join("")}</table>`;
      box.parts.push(`<h3 style="font:400 20px Georgia,serif;margin:16px 0 6px">${esc(name)}</h3>
        ${ddLate.length ? H("OVERDUE D-DAYS", ddLate.length, "#e2445c") + ddTable(ddLate, true) : ""}
        ${ddSoon.length ? H(kind === "weekly" ? "D-DAYS · NEXT 2 WEEKS" : "D-DAYS · NEXT 3 DAYS", ddSoon.length, "#00a862") + ddTable(ddSoon, false) : ""}
        ${overdue.length ? H(kind === "weekly" ? "NOT DONE FROM BEFORE" : "OVERDUE", overdue.length, "#e2445c") + table(overdue) : ""}
        ${soon.length ? H(kind === "weekly" ? "THIS WEEK" : "DUE TODAY AND THE NEXT 2 DAYS", soon.length, "#ec2f8e") + table(soon) : ""}`);
    }
  }
  if (kind === "daily") for (const k of Object.keys(inbox)) if (!inbox[k].over && !inbox[k].soon && !inbox[k].dd) delete inbox[k];

  const sent = [];
  for (const [email, b] of Object.entries(inbox)) {
    const subject = kind === "weekly"
      ? `Your week: ${b.soon} task${b.soon === 1 ? "" : "s"}${b.over ? `, ${b.over} overdue` : ""}${b.dd ? `, ${b.dd} D-day${b.dd === 1 ? "" : "s"} coming` : ""} · ${fmt(today)}`
      : `${b.over ? `${b.over} overdue · ` : ""}${b.soon} due soon${b.dd ? ` · ${b.dd} D-day${b.dd === 1 ? "" : "s"} close` : ""} · ${fmt(today)}`;
    const intro = kind === "weekly"
      ? `Hi ${esc(b.who)}, here's what's under your name for ${fmt(today)} – ${fmt(weekEnd)}: this week's tasks, anything not done from before, and the D-days coming up.`
      : `Hi ${esc(b.who)}, today's check: what's overdue, what's due in the next 2 days, and any D-day that's close or past. Mark things done or move the date so the board stays true.`;
    const html = wrap(kind === "weekly" ? "Your week ahead." : "Today's check.", intro, b.parts.join(""), b.link);
    if (!dry) await send(email, subject, html);
    sent.push({ email: email.replace(/^(.).*(@.*)$/, "$1***$2"), subject });
  }
  res.status(200).json({ kind, today, dry, sent });
}
