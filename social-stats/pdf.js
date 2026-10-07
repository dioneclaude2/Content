/* Social Stats → a real PDF document (vector text, proper tables), not a picture of the page.
 * Uses jsPDF + jspdf-autotable (loaded by the page). One builder per report:
 *   weekly / event  · mode "summary" (portrait, the founder version) or "full" (landscape, every table)
 *   costing         · totals, categories, influencers and every cost line
 */
import * as E from "./engine.js";

const INK = [20, 13, 17], MUTED = [110, 97, 104], DIM = [163, 150, 156], LINE = [234, 225, 218], TINT = [247, 241, 236];
const PINK = [255, 79, 139], GOOD = [17, 115, 75], BAD = [177, 2, 2], WARN = [138, 90, 0];

/* standard PDF fonts only know Western characters: drop emoji, straighten quotes */
const clean = s => String(s ?? "")
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ–—•…€]/g, "")
  .replace(/[ \t]+/g, " ").trim();
const F = {
  int: v => (v == null || !isFinite(v) ? "—" : Math.round(v).toLocaleString("en-US")),
  usd: v => (v == null || !isFinite(v) ? "—" : "$" + (Math.round(v * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })),
  pct: v => (v == null || !isFinite(v) ? "—" : (v * 100).toFixed(2) + "%"),
  big: v => (v == null ? "—" : v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1e4 ? (v / 1e3).toFixed(1) + "K" : F.int(v)),
  date: d => (d ? new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—"),
  dm: d => (d ? new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "—"),
};
const chg = c => c.change == null ? "—" : c.rate ? `${c.change >= 0 ? "+" : ""}${c.change.toFixed(2)} pp` : isFinite(c.change) ? `${c.change >= 0 ? "+" : ""}${(c.change * 100).toFixed(1)}%` : "new";
const STATUS = { "🟢": ["Better", GOOD], "🔴": ["Worse", BAD], "🟡": ["Flat", MUTED] };

/* ───────── page furniture ───────── */
function sheet(orientation) {
  const doc = new window.jspdf.jsPDF({ unit: "pt", format: "a4", orientation });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 40;
  const P = { doc, W, H, M, y: M, inner: W - 2 * M };
  P.ensure = h => { if (P.y + h > H - 46) { doc.addPage(); P.y = M; } };
  P.color = c => doc.setTextColor(...c);
  P.font = (size, style = "normal") => { doc.setFont("helvetica", style); doc.setFontSize(size); };

  P.header = (label, title, sub, accent = PINK) => {
    doc.setFillColor(...accent); doc.rect(0, 0, W, 6, "F");
    P.font(8, "bold"); P.color(PINK); doc.text("HELLO NANCY", M, P.y + 4, { charSpace: 1 });
    const bw = doc.getTextWidth("HELLO NANCY") + 11 * 1;                    // text width + letter spacing
    P.color(DIM); doc.text("·  SOCIAL STATS  ·  " + clean(label).toUpperCase(), M + bw + 6, P.y + 4, { charSpace: 0.6 });
    P.y += 30;
    P.font(24, "bold"); P.color(INK);
    for (const l of doc.splitTextToSize(clean(title), P.inner)) { doc.text(l, M, P.y); P.y += 26; }
    P.font(9); P.color(MUTED);
    for (const l of doc.splitTextToSize(clean(sub), P.inner)) { doc.text(l, M, P.y - 6); P.y += 12; }
    doc.setDrawColor(...accent); doc.setLineWidth(2); doc.line(M, P.y, W - M, P.y);
    P.y += 22;
  };
  P.h2 = text => {
    P.y += 8;
    P.ensure(44);
    P.font(9.5, "bold"); P.color(INK);
    doc.text(clean(text).toUpperCase(), M, P.y, { charSpace: 1 });
    doc.setDrawColor(...LINE); doc.setLineWidth(0.6); doc.line(M, P.y + 6, W - M, P.y + 6);
    P.y += 20;
  };
  P.para = (text, { size = 10, style = "normal", color = INK, gap = 6 } = {}) => {
    P.font(size, style); P.color(color);
    for (const l of doc.splitTextToSize(clean(text), P.inner)) { P.ensure(size + 4); doc.text(l, M, P.y); P.y += size * 1.35; }
    P.y += gap;
  };
  P.note = (label, text, tone = WARN) => {
    P.font(9); const lines = doc.splitTextToSize(clean(text), P.inner - 70);
    const h = lines.length * 12 + 14;
    P.ensure(h + 6);
    doc.setFillColor(...(tone === BAD ? [255, 207, 201] : tone === WARN ? [255, 241, 204] : TINT)); doc.roundedRect(M, P.y, P.inner, h, 6, 6, "F");
    P.font(7.5, "bold"); P.color(tone); doc.text(clean(label).toUpperCase(), M + 10, P.y + 16, { charSpace: 0.8 });
    P.font(9); doc.text(lines, M + 70, P.y + 16);
    P.y += h + 8;
  };
  /* key numbers: boxes, 4 per row; the "hero" one is dark */
  P.kpis = list => {
    const n = Math.min(4, list.length), gap = 8, w = (P.inner - gap * (n - 1)) / n, h = 64;
    for (let i = 0; i < list.length; i += n) {
      P.ensure(h + 8);
      list.slice(i, i + n).forEach(([k, v, s, hero], j) => {
        const x = M + j * (w + gap);
        if (hero) { doc.setFillColor(...INK); doc.roundedRect(x, P.y, w, h, 7, 7, "F"); }
        else { doc.setDrawColor(...LINE); doc.setLineWidth(0.8); doc.roundedRect(x, P.y, w, h, 7, 7, "S"); }
        P.font(7, "bold"); P.color(hero ? [220, 210, 215] : MUTED); doc.text(clean(k).toUpperCase(), x + 10, P.y + 15, { charSpace: 0.7 });
        P.font(18, "bold"); P.color(hero ? [255, 255, 255] : INK); doc.text(clean(v), x + 10, P.y + 38);
        P.font(7.5); P.color(hero ? [220, 210, 215] : MUTED);
        doc.text(doc.splitTextToSize(clean(s || ""), w - 18).slice(0, 2), x + 10, P.y + 51);
      });
      P.y += h + 8;
    }
  };
  /* one line of smaller numbers */
  P.strip = pairs => {
    P.ensure(28);
    doc.setFillColor(...TINT); doc.roundedRect(M, P.y, P.inner, 24, 6, 6, "F");
    let x = M + 12;
    for (const [k, v] of pairs) {
      P.font(8); P.color(MUTED); doc.text(clean(k), x, P.y + 15); x += doc.getTextWidth(clean(k)) + 5;
      P.font(8.5, "bold"); P.color(INK); doc.text(clean(v), x, P.y + 15); x += doc.getTextWidth(clean(v)) + 18;
    }
    P.y += 34;
  };
  /* a table; numeric columns right-aligned; rows can be {total} or {shade} */
  P.table = (head, rows, { num = [], widths = {}, font = 8.5, title, status, links, reach } = {}) => {
    if (title) P.h2(title);
    const body = rows.map(r => (Array.isArray(r) ? r : r.cells).map(c => clean(c)));
    const columnStyles = {};
    num.forEach(i => (columnStyles[i] = { halign: "right" }));
    // small tables: a readable first column instead of numbers stranded across the page
    if (head.length <= 4 && !Object.keys(widths).length) widths = { 0: P.inner * (head.length <= 2 ? 0.55 : 0.42) };
    Object.entries(widths).forEach(([i, w]) => (columnStyles[i] = { ...(columnStyles[i] || {}), cellWidth: w }));
    doc.autoTable({
      startY: P.y, head: [head.map(clean)], body, margin: { left: M, right: M, bottom: 46 },
      theme: "plain", tableWidth: "auto", rowPageBreak: "avoid",
      styles: { font: "helvetica", fontSize: font, cellPadding: { top: 4, bottom: 4, left: 5, right: 5 }, textColor: INK, lineColor: LINE, lineWidth: { bottom: 0.5 }, overflow: "linebreak", valign: "top" },
      headStyles: { fillColor: TINT, textColor: MUTED, fontStyle: "bold", fontSize: font - 1.5 },
      columnStyles,
      didParseCell: d => {
        if (d.section === "head") { if (num.includes(d.column.index)) d.cell.styles.halign = "right"; return; }
        if (d.section !== "body") return;
        const r = rows[d.row.index];
        if (r && !Array.isArray(r)) {
          if (r.total) { d.cell.styles.fontStyle = "bold"; d.cell.styles.fillColor = TINT; }
          if (r.shade) d.cell.styles.fillColor = [252, 247, 242];
          if (r.muted) d.cell.styles.textColor = MUTED;
        }
        if (reach != null && d.column.index === reach) {                  // organic green, boosted pink
          d.cell.styles.fontStyle = "bold";
          d.cell.styles.textColor = /^Organic/.test(d.cell.raw) ? GOOD : /^Boosted/.test(d.cell.raw) ? [194, 24, 91] : WARN;
        }
        if (status != null && d.column.index === status) {
          const s = Object.values(STATUS).find(([w]) => w === d.cell.raw);
          if (s) { d.cell.styles.textColor = s[1]; d.cell.styles.fontStyle = "bold"; }
        }
      },
      didDrawCell: d => {
        if (d.section !== "body" || !links) return;
        const url = links[d.row.index]?.[d.column.index];
        if (url) d.doc.link(d.cell.x, d.cell.y, d.cell.width, d.cell.height, { url });
      },
    });
    P.y = doc.lastAutoTable.finalY + 16;
  };
  /* simple Markdown (the pasted rundown): headings, bullets, tables, paragraphs */
  P.markdown = md => {
    const lines = String(md || "").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim();
      if (!l) continue;
      if (/^\|/.test(l)) {
        const block = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) block.push(lines[i++]);
        i--;
        const rows = block.filter(b => !/^\s*\|?\s*:?-{2,}/.test(b)).map(b => b.trim().replace(/^\||\|$/g, "").split("|").map(c => c.replace(/\*\*/g, "").trim()));
        if (rows.length) P.table(rows[0], rows.slice(1), { font: 8.5 });
        continue;
      }
      const h = l.match(/^#{1,4}\s+(.*)/);
      if (h) { P.ensure(30); P.font(10.5, "bold"); P.color(INK); doc.text(clean(h[1].replace(/\*\*/g, "")), M, P.y + 4); P.y += 18; continue; }
      const b = l.match(/^(?:[-*•]|\d+\.)\s+(.*)/);
      const text = clean((b ? b[1] : l).replace(/\*\*/g, "").replace(/\*/g, ""));
      P.font(9.5); P.color(INK);
      const wrapped = doc.splitTextToSize(text, P.inner - (b ? 14 : 0));
      for (const [k, w] of wrapped.entries()) {
        P.ensure(14);
        if (b && k === 0) doc.text("•", M + 2, P.y);
        doc.text(w, M + (b ? 14 : 0), P.y); P.y += 13;
      }
      P.y += 3;
    }
    P.y += 6;
  };
  P.finish = (footer) => {
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      P.font(7.5); P.color(DIM);
      doc.text(clean(footer), M, H - 24);
      doc.text(`Page ${i} of ${n}`, W - M, H - 24, { align: "right" });
    }
    return doc;
  };
  return P;
}

/* ───────── shared pieces ───────── */
const rundownHeadline = md => {
  if (!md) return "";
  const lines = md.split("\n").map(l => l.trim());
  const h = lines.findIndex(l => /^#+\s*headline/i.test(l));
  return ((h >= 0 ? lines.slice(h + 1) : lines).find(l => l && !/^#|^\|/.test(l)) || "").replace(/^[-*]\s+/, "").replace(/\*\*/g, "");
};
const topRows = (R, by) => {
  const list = by === "er"
    ? [...R.contentRows].filter(r => r.er != null).sort((a, b) => b.er - a.er).slice(0, 3)
    : [...R.contentRows].filter(r => r.views != null).sort((a, b) => b.views - a.views).slice(0, 3);
  return list;
};
function topTables(P, R) {
  for (const [title, by] of [["Top 3 posts by views", "views"], ["Top 3 posts by engagement rate", "er"]]) {
    const list = topRows(R, by);
    if (!list.length) { P.h2(title); P.para(by === "er" ? "Needs likes, comments, saves and shares per post — not in this data yet." : "No posts yet.", { color: MUTED, size: 9 }); continue; }
    P.table(["#", "Post", "Account", "Format", "Views", "Eng. rate", "Organic / boosted"],
      list.map((r, i) => [i + 1, (r.content || r.id).slice(0, 70), r.collab ? r.account : "Hello Nancy", r.format, F.int(r.views), F.pct(r.er), E.reachType(r).short]),
      { title, num: [0, 4, 5], widths: { 0: 18, 1: P.inner * 0.36 }, reach: 6, links: list.map(r => ({ 1: r.link })) });
  }
}
function compareTable(P, R, Pv, names, title) {
  if (!Pv) return;
  const all = E.compareReports(R, Pv);
  const list = names ? names.map(n => all.find(c => c.name === n)).filter(Boolean) : all;
  const f = c => v => v == null ? "—" : c.rate ? F.pct(v) : c.money ? F.usd(v) : F.int(v);
  P.table(["Metric", "This", clean(Pv.rep.name), "Change", "Status"],
    list.map(c => [c.name, f(c)(c.cur), f(c)(c.prev), chg(c), c.status ? STATUS[c.status][0] : "—"]),
    { title, num: [1, 2, 3], status: 4 });
}
function notes(P, R) {
  const items = [
    ...Object.values(R.missing).map(m => `Missing — need ${m.need}, from ${m.who}.`),
    ...R.flags.filter(f => f.level !== "info").map(f => f.text),
  ];
  P.h2("Data notes");
  const base = [
    `Data pulled ${F.date(R.dataDate)}. Engagement rate = (likes + comments + saves + shares) ÷ views. Instagram views include ad views; organic = views − ad views. Money in USD.`,
    ...items,
  ];
  for (const t of base) P.para("• " + t, { size: 8.5, color: MUTED, gap: 1 });
}

/* ───────── weekly ───────── */
function weekly(rep, R, Pv, mode, settings) {
  const full = mode === "full";
  const P = sheet(full ? "landscape" : "portrait");
  const T = R.T, A = R.account || {};
  const C = Pv ? Object.fromEntries(E.compareReports(R, Pv).map(c => [c.name, c])) : {};
  const ch = n => (C[n] && C[n].change != null ? ` · ${chg(C[n])} vs last week` : "");
  P.header("Weekly social report" + (full ? "" : " · summary"), rep.name,
    `${F.date(rep.start)} – ${F.date(rep.end)} · ${settings.account} · ${T.posts} posts · Instagram data pulled ${F.date(R.dataDate)}`);
  const head = rundownHeadline(rep.rundown) || `${T.posts} posts, ${F.int(T.postViews)} post views${C["Post views"]?.change != null ? ` (${chg(C["Post views"])} on the week before)` : ""}, ${F.pct(T.er)} engagement, ${F.usd(T.blendedCPM)} blended CPM.`;
  P.para(head, { size: 12, style: "italic", gap: 10 });
  P.kpis([
    ["Account views", A.views == null ? "—" : F.big(A.views), A.views == null ? "not entered" : `${F.pct(A.pctTarget)} of weekly target${ch("Account views")}`],
    ["Post views", F.big(T.postViews), `${T.posts} posts${ch("Post views")}`],
    ["Eng. rate", F.pct(T.er), `brand benchmark ${F.pct(R.bench)}${ch("Eng. rate (per view)")}`],
    ["Blended CPM", F.usd(T.blendedCPM), "cost per 1,000 views", true],
  ]);
  P.strip([["Ad spend", F.usd(T.adSpend)], ["Ads CPM", F.usd(T.adsCPM)], ["Net followers", A.netFollowers == null ? "—" : F.int(A.netFollowers)], ["Follows from posts", F.int(T.postFollows)], ["Profile visits", F.int(T.visits)]]);
  if (R.dominant) P.note("Heads up", `One ${R.dominant.collab ? "collab " : ""}post drove ${F.pct(R.dominant.views / T.postViews)} of the week's post views.${R.withoutCollabs ? ` Without collab posts: blended CPM ${F.usd(R.withoutCollabs.blendedCPM)}, eng. rate ${F.pct(R.withoutCollabs.er)}.` : ""}`);

  compareTable(P, R, Pv, full ? null : ["Account views", "Post views", "Eng. rate (per view)", "Blended CPM", "Ad spend (USD)", "Follows (from posts)"], "This week vs last week");
  const tot = T.totalViews || 1;
  P.table(["Views", "Count", "Share"], [["Organic", F.int(T.organicViews), F.pct(T.organicViews / tot)], ["Paid (ads)", F.int(T.paidViews), F.pct(T.paidViews / tot)], { total: true, cells: ["Total", F.int(T.totalViews), "100%"] }],
    { title: "Where the views came from", num: [1, 2] });
  P.table(["", "Posts", "Views", "Share of views", "Eng. rate"],
    [R.breakdown[0], R.breakdown[1]].map(g => [g.name, g.posts, F.int(g.views), F.pct(T.postViews ? g.views / T.postViews : null), F.pct(g.er)]),
    { title: "Nancy vs collab", num: [1, 2, 3, 4] });
  topTables(P, R);

  if (full) {
    P.table(["Format", "Posts", "Avg views", "Avg eng. rate"], R.formats.map(g => [g.name, g.posts, F.int(g.avgViews), F.pct(g.avgER)]), { title: "Format split", num: [1, 2, 3] });
    const rows = R.rows.map(r => ({ shade: r.kind === "extra", muted: r.adOnly, cells: [F.dm(r.date), r.adOnly && !r.post ? "—" : r.collab ? r.account : "Nancy", r.format, (r.adOnly ? "[ad] " : "") + (r.content || r.id).slice(0, 48), F.int(r.views), F.int(r.reach), F.int(r.likes), F.int(r.comments), F.int(r.saves), F.int(r.shares), F.pct(r.er), F.int(r.visits), F.int(r.follows), r.boosted ? "Yes" : "No", r.spend ? F.usd(r.spend) : "—", F.int(r.paid), F.int(r.organic), r.cpm == null ? "—" : F.usd(r.cpm)] }));
    rows.push({ total: true, cells: ["Total", "", "", "", F.int(T.totalViews), F.int(T.reach), F.int(T.likes), F.int(T.comments), F.int(T.saves), F.int(T.shares), F.pct(T.er), F.int(T.visits), F.int(T.postFollows), "", F.usd(T.adSpend), F.int(T.paidViews), F.int(T.organicViews), F.usd(T.adsCPM)] });
    P.table(["Date", "Account", "Format", "Post", "Views", "Reach", "Likes", "Comm.", "Saves", "Shares", "Eng.", "Visits", "Follows", "Boost", "Ad spend", "Paid", "Organic", "CPM"], rows,
      { title: "This week's posts", num: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17], font: 7, widths: { 3: 150 }, links: R.rows.map(r => ({ 3: r.link })) });
    campaigns(P, R);
  }
  if (rep.rundown) { P.h2("Rundown"); P.markdown(rep.rundown); }
  notes(P, R);
  return P.finish(`Weekly social report · ${rep.name} · ${F.date(rep.start)} – ${F.date(rep.end)}`);
}

function campaigns(P, R) {
  if (!R.campaigns.length) return;
  const rows = R.campaigns.map(c => [c.campaign.slice(0, 60), c.mixedCur ? "mixed" : `${c.currency} ${c.spend.toLocaleString("en-US", { maximumFractionDigits: 2 })}`, F.usd(c.usd), F.int(c.views), F.usd(c.cpm), F.pct(c.pctPaid), c.follows == null ? "—" : F.int(c.follows)]);
  rows.push({ total: true, cells: ["Total", "", F.usd(R.T.adSpend), F.int(R.T.paidViews), F.usd(R.T.adsCPM), "100%", R.T.adFollows == null ? "—" : F.int(R.T.adFollows)] });
  P.table(["Campaign", "Spend (original)", "Spend (USD)", "Views", "CPM", "% of paid views", "Follows"], rows, { title: "Ad spend by campaign", num: [1, 2, 3, 4, 5, 6] });
}

/* ───────── event ───────── */
function event(rep, R, Pv, mode) {
  const full = mode === "full";
  const P = sheet(full ? "landscape" : "portrait");
  const T = R.T, S = R.score;
  P.header("Event report" + (full ? "" : " · summary"), rep.name,
    `${F.date(rep.start)} – ${F.date(rep.end)} · ${R.durationDays} day${R.durationDays === 1 ? "" : "s"} · ${T.posts} event posts (${T.nancyPosts} Nancy, ${T.collabPosts} collab)${T.extra ? ` + ${T.extra} extra` : ""} · data pulled ${F.date(R.dataDate)}`);
  const head = rundownHeadline(rep.rundown) || (T.totalViews ? `${rep.name} reached ${F.int(T.totalViews)} views for ${F.usd(T.totalSpend)} — ${F.usd(T.blendedCPM)} per 1,000 views${T.er == null ? "" : `, with ${F.pct(T.er)} engagement`}.` : "No posts or ad data yet.");
  P.para(head, { size: 12, style: "italic", gap: 10 });
  P.kpis([
    ["Total spend", F.usd(T.totalSpend), "ads, influencers and event costs"],
    ["Total views", F.big(T.totalViews), `${F.pct(T.pctOrganic)} organic`],
    ["Blended CPM", F.usd(T.blendedCPM), "cost per 1,000 views, all spend", true],
    ["Eng. rate", F.pct(T.er), T.er == null ? "needs likes, comments, saves, shares" : `brand benchmark ${F.pct(R.bench)}`],
  ]);
  P.strip([["Ads CPM", F.usd(T.adsCPM)], ["Organic CPM", T.organicCPM == null ? "—" : F.usd(T.organicCPM)], ["Cost per follow", F.usd(T.costPerFollow)], ["Follows", T.adFollows == null && T.postFollows == null ? "—" : F.int((T.adFollows || 0) + (T.postFollows || 0))], ["Cost per engagement", F.usd(T.costPerEngagement)]]);

  const spend = T.totalSpend || 1;
  P.table(["", "USD", "Share"], [
    ["Influencers", T.influencerCost == null ? "Missing" : F.usd(T.influencerCost), T.influencerCost == null ? "—" : F.pct(T.influencerCost / spend)],
    ["Event costs", T.eventCost == null ? "Missing" : F.usd(T.eventCost), T.eventCost == null ? "—" : F.pct(T.eventCost / spend)],
    ["Ads", F.usd(T.adSpend), F.pct(T.adSpend / spend)],
    { total: true, cells: ["Total spend", F.usd(T.totalSpend), "100%"] },
  ], { title: "Where the money went", num: [1, 2] });
  const tot = T.totalViews || 1;
  P.table(["", "Views", "Share"], [["Organic", F.int(T.organicViews), F.pct(T.organicViews / tot)], ["Paid (ads)", F.int(T.paidViews), F.pct(T.paidViews / tot)], { total: true, cells: ["Total", F.int(T.totalViews), "100%"] }],
    { title: "Where the views came from", num: [1, 2] });
  topTables(P, R);
  compareTable(P, R, Pv, full ? null : ["Total spend (USD)", "Total views", "Blended CPM", "Eng. rate (per view)", "Cost per follow"], Pv ? `Against ${Pv.rep.name}` : "");

  if (full) {
    const ev = R.rows.map((r, i) => ({ shade: r.kind === "extra", muted: r.adOnly, cells: [i + 1, r.format, (r.content || r.id).slice(0, 60), r.collab ? r.account : r.adOnly ? "—" : "Nancy", r.boosted ? "Yes" : "No", r.spend ? F.usd(r.spend) : "—", F.int(r.views), F.int(r.organic), F.int(r.paid), r.cpm == null ? "—" : F.usd(r.cpm), { post: "", extra: "Extra post", separate: "Separate ad version", older: "Ads on older post", "other-event": "Ads on another event's post", adonly: "Ad only", campaign: "Campaign spend" }[r.kind] || ""] }));
    ev.push({ total: true, cells: ["", "", "Total spend", "", "", F.usd(T.adSpend), F.int(T.totalViews), F.int(T.organicViews), F.int(T.paidViews), F.usd(T.adsCPM), ""] });
    P.table(["#", "Format", "Post", "Account", "Boosted", "Spent (USD)", "Total views", "Organic", "Boosted views", "Boosted CPM", "Note"], ev,
      { title: "Event table", num: [0, 5, 6, 7, 8, 9], font: 7.5, widths: { 2: 200 }, links: R.rows.map(r => ({ 2: r.link })) });
    P.table(["", "Value"], [
      ["Total spend", F.usd(T.totalSpend)], ["Ads", F.usd(T.adSpend)], ["Event (non-ad)", T.nonAd == null ? "Missing" : F.usd(T.nonAd)],
      ["Total impressions (views)", F.int(T.totalViews)], ["Organic impressions", F.int(T.organicViews)], ["Boosted impressions", F.int(T.paidViews)],
      ["Organic CPM", T.organicCPM == null ? "blank — no event cost" : F.usd(T.organicCPM)], ["Ads CPM", T.adsCPM == null ? "N/A" : F.usd(T.adsCPM)], { total: true, cells: ["Blended CPM", F.usd(T.blendedCPM)] },
      ["Influencer cost per 1,000 collab views", F.usd(T.influencerPer1kCollab)],
    ], { title: "Total spend block", num: [1] });
    if (R.influencers.length) P.table(["Creator", "Deliverables", "Fee", "USD"], R.influencers.map(l => [l.creator, l.deliverables || "", `${l.currency} ${F.int(l.fee)}`, F.usd(l.usd)]), { title: "Influencer costs", num: [2, 3] });
    if (R.byCategory.length) P.table(["Event cost category", "Lines", "USD"], R.byCategory.map(c => [c.category, c.lines, F.usd(c.usd)]), { title: "Event costs by category", num: [1, 2] });
    campaigns(P, R);
    P.table(["", "Posts", "Views", "Reach", "Likes", "Comments", "Saves", "Shares", "Eng. rate"], R.breakdown.map(g => ({ total: g.name === "Total", cells: [g.name, g.posts, F.int(g.views), F.int(g.reach), F.int(g.likes), F.int(g.comments), F.int(g.saves), F.int(g.shares), F.pct(g.er)] })),
      { title: "Content performance", num: [1, 2, 3, 4, 5, 6, 7, 8] });
    P.table(["", ""], [
      ["Total views", `${F.int(T.totalViews)} — ${F.pct(T.pctPaid)} paid / ${F.pct(T.pctOrganic)} organic`],
      ["Total reach", `${F.int(S.reachNancy + S.reachCollab)} — Nancy ${F.int(S.reachNancy)} / collab ${F.int(S.reachCollab)}`],
      ["Total engagements", T.interactions == null ? "—" : `${F.int(T.interactions)} (${F.int(T.likes)} likes, ${F.int(T.comments)} comments, ${F.int(T.saves)} saves, ${F.int(T.shares)} shares)`],
      ["Eng. rate", `organic ${F.pct(S.erOrganic)} · boosted ${F.pct(S.erBoosted)} · Nancy ${F.pct(S.erNancy)} · collab ${F.pct(S.erCollab)}`],
      ["Content mix", `${F.pct(S.pctViewsNancy)} of views from Nancy posts · ${F.pct(S.pctEngCollab)} of engagements from collab posts`],
      ["Cost per engagement", F.usd(T.costPerEngagement)],
      ["Follows from ads", T.adFollows == null ? "—" : `${F.int(T.adFollows)} · ${F.usd(T.costPerFollow)} per follow`],
    ], { title: "Scorecard", widths: { 0: 150 } });
  }
  if (rep.rundown) { P.h2("Rundown"); P.markdown(rep.rundown); }
  notes(P, R);
  return P.finish(`Event report · ${rep.name} · ${F.date(rep.start)} – ${F.date(rep.end)}`);
}

/* ───────── costing ───────── */
function costing(rep, CR) {
  const P = sheet("portrait");
  const T = CR.T, Ev = CR.E, name = rep.eventName || CR.event?.name || rep.name;
  P.header("Costing report", name, `${F.date(rep.start)} – ${F.date(rep.end)} · ${T.lines} lines${CR.event ? ` · for the ${CR.event.name} event report` : ""} · money in USD`);
  P.kpis([
    ["Total cost", F.usd(T.total), "excludes ads", true],
    ["Influencers & models", F.usd(T.influencerCost), `${T.creators} ${T.creators === 1 ? "person" : "people"}`],
    ["Event costs", F.usd(T.eventCost), `${CR.eventCosts.length} lines`],
    ["Blended CPM", Ev ? F.usd(Ev.T.blendedCPM) : "—", Ev ? `with ${F.usd(Ev.T.adSpend)} ads · ${F.big(Ev.T.totalViews)} views` : "link an event report"],
  ]);
  for (const f of CR.flags.filter(f => f.level !== "info")) P.note(f.level === "bad" ? "Fix" : "Check", f.text, f.level === "bad" ? BAD : WARN);
  const total = T.total || 1;
  const cats = [{ category: "Influencers & models", usd: T.influencerCost, lines: CR.influencers.length }, ...CR.byCategory].filter(c => c.lines).sort((a, b) => b.usd - a.usd);
  P.table(["Category", "Lines", "USD", "Share"], [...cats.map(c => [c.category, c.lines, F.usd(c.usd), F.pct(c.usd / total)]), { total: true, cells: ["Total", T.lines, F.usd(T.total), "100%"] }], { title: "Where the money went", num: [1, 2, 3] });
  if (CR.influencers.length) {
    const rows = CR.influencers.map(l => [l.creator, l.deliverables || "", F.dm(l.date), `${l.currency} ${l.fee == null ? "—" : l.fee.toLocaleString("en-US")}`, F.usd(l.usd), l.invoiceNo || ""]);
    rows.push({ total: true, cells: ["Total", "", "", "", F.usd(T.influencerCost), ""] });
    P.table(["Creator / model", "Deliverables", "Date", "Fee", "USD", "Invoice #"], rows, { title: "Influencers & models", num: [3, 4], widths: { 1: 150 } });
  }
  if (CR.eventCosts.length) {
    const rows = [];
    for (const cat of E.COST_CATEGORIES) {
      const ls = CR.eventCosts.filter(l => l.category === cat);
      if (!ls.length) continue;
      rows.push({ shade: true, cells: [cat.toUpperCase(), "", "", "", "", F.usd(ls.reduce((a, l) => a + (l.usd || 0), 0)), ""] });
      for (const l of ls) rows.push(["", l.item || "", l.vendor || "", F.dm(l.date), `${l.currency} ${((l.qty == null ? 1 : l.qty) * (l.unit || 0)).toLocaleString("en-US", { maximumFractionDigits: 2 })}`, F.usd(l.usd), l.invoiceNo || ""]);
    }
    rows.push({ total: true, cells: ["Total", "", "", "", "", F.usd(T.eventCost), ""] });
    P.table(["Category", "Item", "Vendor", "Date", "Amount", "USD", "Invoice #"], rows, { title: "Event costs", num: [4, 5], font: 8, widths: { 0: 92, 1: 130 } });
  }
  if (Ev) P.table(["What it bought", ""], [
    ["Total spend (costs + ads)", F.usd(Ev.T.totalSpend)], ["Total views", F.int(Ev.T.totalViews)], ["Blended CPM", F.usd(Ev.T.blendedCPM)],
    ["Organic CPM", Ev.T.organicCPM == null ? "—" : F.usd(Ev.T.organicCPM)], ["Ads CPM", F.usd(Ev.T.adsCPM)],
    ["Influencer cost per 1,000 collab views", F.usd(Ev.T.influencerPer1kCollab)],
  ], { title: `${CR.event.name} — results`, num: [1] });
  return P.finish(`Costing report · ${name}`);
}

export function buildPdf({ rep, R, P, CR, mode, settings }) {
  if (rep.type === "costing") return costing(rep, CR);
  return rep.type === "week" ? weekly(rep, R, P, mode, settings) : event(rep, R, P, mode);
}
