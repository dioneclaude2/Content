/* Social Stats engine: parsing, ad matching and every report calculation.
 *
 * Pure functions only (no DOM, no storage), so the page and the tests share one
 * copy of the maths. Rules come from the Hello Nancy reporting context (Oct 2026):
 *   - engagement rate is per VIEW: (likes + comments + saves + shares) ÷ views
 *   - Instagram views already include ad views: organic = views − paid
 *   - paid views are ad VIEWS, never impressions
 *   - money is USD with the FX rate stored on the report
 *   - nothing is estimated: a number that can't be worked out is null and the
 *     report prints "Missing — need …" for it
 */

export const DEFAULT_SETTINGS = {
  fx: { USD: 1, HKD: 1 / 7.8, GBP: 1.348754, MXN: 0.058412, CNY: 0.14915, EUR: 1.08, SGD: 0.74 },
  target: { views: 40_000_000, period: "month" },
  benchmark: 0.019,
  cpmRange: [4, 17],
  account: "@hellonancy_official",
};

export const EVENT_COLOURS = {
  "ASAP HK": ["#ffe599", "#fff2cc"],
  "US Open": ["#9fc5e8", "#cfe2f3"],
  Cancun: ["#b6d7a8", "#d9ead3"],
  LFW: ["#d5a6bd", "#ead1dc"],
  Pink: ["#ffb3cf", "#ffe0ec"],
  Grey: ["#d9d9d9", "#f3f3f3"],
};

export const COST_CATEGORIES = [
  "Merch & giveaways", "Team meals & event expenses", "Hotel / accommodation", "General logistics",
  "Flights / transportation", "Venue & production", "Decor", "Other",
];

const PERIOD_DAYS = { week: 7, month: 30.4375, quarter: 91.3125 };

/* ───────── small helpers ───────── */

export const r2 = x => (x == null || !isFinite(x) ? null : Math.round(x * 100) / 100);
const sum = (a, f = x => x) => a.reduce((s, x) => s + (f(x) || 0), 0);
const div = (a, b) => (a == null || b == null || !b ? null : a / b);
const per1k = (cost, views) => (cost == null || !views ? null : (cost / views) * 1000);

/** "1,234" · "$1,234.50" · "1.2K" · "3M" · "12%" → number. Blank → null. */
export function num(v) {
  if (v == null) return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  let s = String(v).trim().replace(/[\s,]/g, "").replace(/^(US|HK|S|A|C|MX)?\$/i, "").replace(/^[£€¥]/, "");
  if (!s || s === "-" || s === "—" || /^n\/?a$/i.test(s)) return null;
  let mult = 1;
  const suf = s.match(/([kmb])$/i);
  if (suf) { mult = { k: 1e3, m: 1e6, b: 1e9 }[suf[1].toLowerCase()]; s = s.slice(0, -1); }
  if (s.endsWith("%")) { s = s.slice(0, -1); mult /= 100; }
  const n = Number(s);
  return isFinite(n) ? n * mult : null;
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = n => String(n).padStart(2, "0");
const ymd = (y, m, d) => (y > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : null);

/** Any common date spelling → "YYYY-MM-DD". Slashes are read month-first (US), unless the first number is over 12. */
export function toDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return ymd(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/))) {
    let [a, b, y] = [+m[1], +m[2], +m[3]];
    if (y < 100) y += 2000;
    return a > 12 ? ymd(y, b, a) : ymd(y, a, b);
  }
  if ((m = s.match(/^([a-z]{3,4})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/i)) && MONTHS[m[1].toLowerCase()]) return ymd(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);
  if ((m = s.match(/^(\d{1,2})\s+([a-z]{3,4})[a-z]*\.?,?\s+(\d{4})/i)) && MONTHS[m[2].toLowerCase()]) return ymd(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
  return null;
}

export function addDays(date, n) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 864e5);

/* ───────── table parsing ───────── */

/** Pasted Google Sheets (tabs) or a CSV file → { headers, rows: [{header: cell}] }. */
export function parseTable(text) {
  const rows = parseRows(text);
  if (!rows.length) return { headers: [], rows: [] };
  const headers = rows[0].map(h => h.trim());
  return {
    headers,
    rows: rows.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()]))),
  };
}

/** Every non-blank row as an array of cells (tabs, commas or semicolons; quoted cells may hold newlines). */
export function parseRows(text) {
  text = String(text || "").replace(/^﻿/, "").replace(/\r\n?/g, "\n").trim();
  if (!text) return [];
  const first = text.split("\n")[0];
  const delim = first.includes("\t") ? "\t" : first.split(";").length > first.split(",").length ? ";" : ",";
  const out = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"' && cell === "") q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); out.push(row); row = []; cell = ""; }
    else cell += c;
  }
  row.push(cell); out.push(row);
  return out.filter(r => r.some(c => c.trim()));
}

/** Find the column whose header matches one of the patterns (first pattern wins). */
function col(headers, ...patterns) {
  for (const p of patterns) {
    const h = headers.find(h => p.test(h.trim().toLowerCase()));
    if (h) return h;
  }
  return null;
}

/* ───────── Instagram ids ───────── */

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Shortcode from a post link (instagram.com/reel/<code>/), a bare shortcode, or an Instagram media pk. */
export function shortcode(v) {
  if (!v) return null;
  const s = String(v).trim();
  const m = s.match(/instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([\w-]{5,})/i);
  if (m) return m[1];
  if (/^\d{15,}(_\d+)?$/.test(s)) {           // media pk ("3456…_789"): base-64 encode it
    try {
      let n = BigInt(s.split("_")[0]), out = "";
      while (n > 0n) { out = B64[Number(n % 64n)] + out; n /= 64n; }
      return out || null;
    } catch { return null; }
  }
  if (/^[\w-]{8,14}$/.test(s) && !/^\d+$/.test(s)) return s;
  return null;
}

/* ───────── input mapping ───────── */

const NANCY = /hello\s*nancy|hellonancy/i;

function normFormat(v) {
  const s = String(v || "").toLowerCase();
  if (/reel|video/.test(s)) return "Reel";
  if (/carou|album|slide/.test(s)) return "Carousel";
  if (/stor/.test(s)) return "Story";
  if (/image|photo|static|post/.test(s)) return "Image";
  return v ? String(v).trim() : "";
}
const yes = v => /^(y|yes|true|1|✓|✔|boosted)$/i.test(String(v || "").trim());

/** Organic person's pasted post table → posts plus problems found. */
export function mapPosts(table) {
  const H = table.headers;
  const c = {
    date: col(H, /^date/, /posted/),
    account: col(H, /^account/, /^handle/, /creator/),
    format: col(H, /^format/, /^type/),
    content: col(H, /^content/, /caption/, /^title/),
    link: col(H, /^link/, /url/, /permalink/),
    postId: col(H, /post id/, /media id/),
    views: col(H, /^views?$/, /^views/, /^plays/),
    reach: col(H, /^reach/, /accounts reached/),
    likes: col(H, /^likes?/),
    comments: col(H, /^comments?/),
    saves: col(H, /^saves?/, /saved/),
    shares: col(H, /^shares?/),
    visits: col(H, /profile visit/, /^visits/),
    follows: col(H, /^follows?/, /follow/),
    boosted: col(H, /boost/, /ran as (an )?ad/, /^ad\??$/, /paid/),
    collab: col(H, /^collab/),
  };
  const errors = [];
  if (!c.link) errors.push("No Link column — every post needs its Instagram link.");
  if (!c.views) errors.push("No Views column.");
  const posts = [];
  table.rows.forEach((r, i) => {
    const code = shortcode(r[c.link]) || shortcode(r[c.postId]);
    if (!code && /^total/i.test(Object.values(r)[0] || "")) return;
    if (!code) { if (Object.values(r).some(Boolean)) errors.push(`Row ${i + 2}: no usable Instagram link.`); return; }
    const account = (r[c.account] || "").trim();
    const collab = c.collab ? yes(r[c.collab]) : /collab/i.test(account) || (!!account && !NANCY.test(account));
    posts.push({
      id: code,
      link: (r[c.link] || "").trim() || `https://www.instagram.com/p/${code}/`,
      igId: c.postId ? (r[c.postId] || "").trim() : "",
      account: account || "Hello Nancy",
      collab,
      format: normFormat(r[c.format]),
      content: (r[c.content] || "").trim(),
      date: toDate(r[c.date]),
      boosted: c.boosted ? yes(r[c.boosted]) : null,
      snap: {
        views: num(r[c.views]), reach: num(r[c.reach]), likes: num(r[c.likes]), comments: num(r[c.comments]),
        saves: num(r[c.saves]), shares: num(r[c.shares]), visits: num(r[c.visits]), follows: num(r[c.follows]),
      },
    });
  });
  const missingCols = ["reach", "likes", "comments", "saves", "shares", "visits", "follows", "boosted", "date"].filter(k => !c[k]);
  return { posts, errors, missingCols, columns: c };
}

/** Merge freshly pasted posts into stored ones. Each pull date keeps its own snapshot. */
export function mergePosts(existing, incoming, pulledOn, tag) {
  const out = {};
  for (const p of incoming) {
    const old = existing[p.id] || { id: p.id, snaps: {}, tags: [] };
    const keep = (a, b) => (a !== "" && a != null ? a : b);
    out[p.id] = {
      ...old,
      link: keep(p.link, old.link), igId: keep(p.igId, old.igId), account: keep(p.account, old.account),
      collab: p.collab, format: keep(p.format, old.format), content: keep(p.content, old.content),
      date: keep(p.date, old.date), boosted: p.boosted ?? old.boosted ?? false,
      snaps: { ...old.snaps, [pulledOn]: p.snap },
      tags: tag && !(old.tags || []).includes(tag) ? [...(old.tags || []), tag] : old.tags || [],
    };
  }
  return out;
}

/** The snapshot to use on a data date: the latest one pulled on or before it (else the earliest after it). */
export function snapAt(post, dataDate) {
  const dates = Object.keys(post.snaps || {}).sort();
  if (!dates.length) return { snap: null, date: null };
  const on = dates.filter(d => !dataDate || d <= dataDate).pop() || dates[0];
  return { snap: post.snaps[on], date: on };
}

/** Meta Ads Manager export (ad level) → an ad import. */
export function mapAds(table, name) {
  const H = table.headers;
  const spendCol = col(H, /^amount spent/, /^spend/, /^cost$/);
  const c = {
    ad: col(H, /^ad name$/, /^ad$/),
    campaign: col(H, /^campaign name$/, /^campaign$/),
    adset: col(H, /^ad set name$/, /^ad set$/),
    spend: spendCol,
    currency: col(H, /^currency$/),
    views: col(H, /^views$/),
    impressions: col(H, /^impressions$/),
    reach: col(H, /^reach$/),
    follows: col(H, /instagram follows/, /^follows$/, /profile follows/),
    postId: col(H, /instagram post id/, /^post id$/, /media id/),
    permalink: col(H, /permalink/, /post link/, /instagram (post )?url/),
    start: col(H, /reporting starts/, /^starts?$/),
    end: col(H, /reporting ends/, /^ends?$/),
    results: col(H, /^results$/),
    indicator: col(H, /result indicator/, /result type/),
  };
  const headerCur = spendCol && (spendCol.match(/\(([A-Z]{3})\)/) || [])[1];
  const errors = [], warnings = [];
  if (!c.spend) errors.push("No “Amount spent” column.");
  if (!c.views) {
    if (c.impressions) errors.push("This export has Impressions but no Views. Paid views must be ad VIEWS — re-export with the Views column.");
    else errors.push("No Views column — re-export with Views.");
  }
  if (!c.ad) warnings.push("Not ad level (no “Ad name”). Rows are treated as campaigns: spend counts, views don't (§4.1 step 8).");
  if (!c.postId && !c.permalink) warnings.push("No Instagram post ID / permalink — ads will be matched by name, which is less reliable.");
  if (!c.follows) warnings.push("No “Instagram follows” column — cost per follow will show as missing.");
  if (!headerCur && !c.currency) warnings.push("Currency not shown in the export — assumed USD.");
  const rows = table.rows
    .filter(r => (c.ad && r[c.ad]) || (c.campaign && r[c.campaign]))
    .map((r, i) => ({
      i,
      ad: c.ad ? r[c.ad] : "",
      campaign: c.campaign ? r[c.campaign] : "",
      adset: c.adset ? r[c.adset] : "",
      spend: num(r[c.spend]) || 0,
      currency: (c.currency && r[c.currency]) || headerCur || "USD",
      views: c.views ? num(r[c.views]) : null,
      impressions: num(r[c.impressions]),
      reach: num(r[c.reach]),
      follows: c.follows ? num(r[c.follows]) || 0 : null,
      postId: c.postId ? r[c.postId] : "",
      permalink: c.permalink ? r[c.permalink] : "",
      start: toDate(r[c.start]),
      end: toDate(r[c.end]),
      results: num(r[c.results]),
      indicator: c.indicator ? r[c.indicator] : "",
    }));
  const starts = rows.map(r => r.start).filter(Boolean).sort();
  const ends = rows.map(r => r.end).filter(Boolean).sort();
  return {
    name, rows, errors, warnings,
    level: c.ad ? "ad" : "campaign",
    hasViews: !!c.views, hasFollows: !!c.follows, hasPostIds: !!(c.postId || c.permalink),
    rangeStart: starts[0] || null, rangeEnd: ends[ends.length - 1] || null,
  };
}

/** Influencer list (costing person). */
export function mapInfluencers(table) {
  const H = table.headers;
  const c = {
    creator: col(H, /creator/, /handle/, /^name/, /influencer/),
    deliverables: col(H, /deliverable/),
    fee: col(H, /^fee/, /amount/, /cost/, /price/),
    currency: col(H, /currency/, /^cur/),
    notes: col(H, /note/),
  };
  return table.rows.filter(r => r[c.creator] || r[c.fee]).map(r => ({
    creator: r[c.creator] || "", deliverables: r[c.deliverables] || "", fee: num(r[c.fee]),
    currency: (r[c.currency] || "USD").toUpperCase(), notes: r[c.notes] || "",
  }));
}

/** Event costs (everything except ads and influencers). */
export function mapEventCosts(table) {
  const H = table.headers;
  const c = {
    category: col(H, /categor/), item: col(H, /^item/, /description/, /^what/), date: col(H, /^date/),
    qty: col(H, /^qty/, /quantity/), unit: col(H, /unit/, /price/, /amount/, /cost/),
    currency: col(H, /currency/, /^cur/), vendor: col(H, /vendor/, /supplier/), receipt: col(H, /receipt/, /link/),
  };
  return table.rows.filter(r => r[c.item] || r[c.unit]).map(r => ({
    category: matchCategory(r[c.category]), item: r[c.item] || "", date: toDate(r[c.date]) || r[c.date] || "",
    qty: num(r[c.qty]), unit: num(r[c.unit]), currency: (r[c.currency] || "USD").toUpperCase(),
    vendor: r[c.vendor] || "", receipt: r[c.receipt] || "",
  }));
}
function matchCategory(v) {
  const s = String(v || "").toLowerCase();
  if (!s) return "Other";
  return COST_CATEGORIES.find(k => k.toLowerCase() === s)
    || COST_CATEGORIES.find(k => k.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 3).some(w => s.includes(w)))
    || "Other";
}

/* ───────── money ───────── */

export function toUSD(amount, currency, fx) {
  if (amount == null) return null;
  const rate = (fx || {})[String(currency || "USD").toUpperCase()];
  return rate == null ? null : amount * rate;
}
export const costLineUSD = (l, fx) => toUSD((l.qty == null ? 1 : l.qty) * (l.unit || 0), l.currency, fx);

/* ───────── ad → post matching (§4.1) ───────── */

const normName = s => String(s || "")
  .toLowerCase()
  .replace(/\s*[-–—]\s*copy(\s*\d+)?\s*$/g, "")
  .replace(/^(instagram|ig|boosted)?\s*(post|reel|story)\s*[:\-–]\s*/, "")
  .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim();

/** Which post an ad promoted, and how we know. Returns {post, how} or {post: null, candidates}. */
export function findPost(ad, posts) {
  const code = shortcode(ad.permalink) || shortcode(ad.postId);
  if (ad.postId) {
    const p = posts.find(p => p.igId && p.igId === String(ad.postId).trim());
    if (p) return { post: p, how: "id" };
  }
  if (code) {
    const p = posts.find(p => p.id === code);
    if (p) return { post: p, how: "id" };
  }
  const a = normName(ad.ad);
  if (a.length >= 6) {
    const hits = posts.filter(p => {
      const cap = normName(p.content);
      if (cap.length < 6) return false;
      const n = Math.min(a.length, cap.length, 40);
      return cap.slice(0, n) === a.slice(0, n);
    });
    if (hits.length === 1) return { post: hits[0], how: "name" };
    if (hits.length > 1) return { post: null, candidates: hits.map(p => p.id), code };
  }
  return { post: null, code };
}

/* ───────── the report ───────── */

const M = (need, who) => ({ missing: true, need, who });
export const isMissing = v => v && typeof v === "object" && v.missing;

/**
 * Build everything a report shows.
 *   rep      – the saved report (type "week" | "event", dates, post list, imports, costs, fx …)
 *   db       – { posts: {code: post}, imports: {id: import}, reports: {id: report} }
 *   settings – DEFAULT_SETTINGS shape
 */
export function buildReport(rep, db, settings = DEFAULT_SETTINGS) {
  const fx = { ...settings.fx, ...(rep.fx || {}) };
  const bench = settings.benchmark;
  const dataDate = rep.dataDate || null;
  const allPosts = Object.values(db.posts || {}).filter(p => !p.deleted);
  const flags = [];
  const flag = (level, text) => flags.push({ level, text });

  /* 1 · which posts belong to this report */
  let mainIds;
  if (rep.type === "week") {
    mainIds = allPosts.filter(p => p.date && p.date >= rep.start && p.date <= rep.end).map(p => p.id);
    for (const id of rep.include || []) if (!mainIds.includes(id)) mainIds.push(id);
    mainIds = mainIds.filter(id => !(rep.exclude || []).includes(id));
  } else {
    mainIds = [...new Set(rep.postIds || [])];
  }
  const mainSet = new Set(mainIds);
  const otherEvents = Object.values(db.reports || {}).filter(r => !r.deleted && r.type === "event" && r.id !== rep.id);

  /* 2 · ads from the chosen exports */
  const imports = (rep.importIds || []).map(id => db.imports?.[id]).filter(x => x && !x.deleted);
  const ads = [];
  for (const imp of imports) {
    if (!imp.hasViews) flag("bad", `“${imp.name}” has no Views column — its paid views can't be counted.`);
    if (dataDate && imp.rangeEnd && imp.rangeEnd < dataDate)
      flag("warn", `“${imp.name}” ends ${imp.rangeEnd}, before the data date ${dataDate} — re-export through the data date.`);
    if (rep.type === "week" && imp.rangeStart && (imp.rangeStart > rep.start || (imp.rangeEnd && imp.rangeEnd < rep.end)))
      flag("warn", `“${imp.name}” covers ${imp.rangeStart} → ${imp.rangeEnd}, not the full week.`);
    for (const row of imp.rows) {
      const key = `${imp.id}:${row.i}`;
      ads.push({ ...row, key, importId: imp.id, level: imp.level, usd: toUSD(row.spend, row.currency, fx), hasFollows: imp.hasFollows });
      if (toUSD(1, row.currency, fx) == null) flag("bad", `No FX rate for ${row.currency} — add it in this report's FX.`);
    }
  }

  /* 3 · posts + their numbers on the data date */
  const pullDates = new Set();
  const postRow = (p, kind) => {
    const { snap, date } = snapAt(p, dataDate);
    if (date) pullDates.add(date);
    const s = snap || {};
    const inter = ["likes", "comments", "saves", "shares"].every(k => s[k] == null) ? null
      : sum(["likes", "comments", "saves", "shares"], k => s[k]);
    return {
      kind, post: p, id: p.id, link: p.link, account: p.account, collab: !!p.collab, format: p.format || "",
      content: p.content || "", date: p.date, boostedFlag: !!p.boosted, pulled: date,
      views: s.views ?? null, reach: s.reach ?? null, likes: s.likes ?? null, comments: s.comments ?? null,
      saves: s.saves ?? null, shares: s.shares ?? null, visits: s.visits ?? null, follows: s.follows ?? null,
      interactions: inter, ads: [], paid: 0, spend: 0,
    };
  };
  const rowsById = new Map();
  for (const id of mainIds) {
    const p = db.posts[id];
    if (!p) { flag("bad", `Post ${id} is in this report but not in the post list — paste it again.`); continue; }
    rowsById.set(id, postRow(p, "post"));
  }

  /* 4 · match each ad to a post (§4.1) */
  const overrides = rep.adMatch || {};
  const pending = new Map();                         // post id -> [{ad, how}]
  const loose = [];                                  // ads that stay ad-only rows
  const matchLog = [];
  const campaignRows = [];
  for (const ad of ads) {
    if (ad.level === "campaign") { campaignRows.push(ad); continue; }
    let post = null, how = null, candidates;
    const o = overrides[ad.key];
    if (o === "__adonly") how = "manual-adonly";
    else if (o && db.posts[o]) { post = db.posts[o]; how = "manual"; }
    else ({ post, how, candidates } = findPost(ad, allPosts));
    matchLog.push({ ad, post: post?.id || null, how: how || "none", candidates });
    if (!post) { loose.push({ ad, kind: "adonly", candidates }); continue; }

    if (!mainSet.has(post.id)) {
      if (rep.type === "week") {                     // a boost on an older (or later) post
        loose.push({ ad, kind: "older", post, how });
        continue;
      }
      const owner = otherEvents.find(e => (e.postIds || []).includes(post.id));
      if (owner) { loose.push({ ad, kind: "other-event", post, how, owner: owner.name }); continue; }
      if (!rowsById.has(post.id)) rowsById.set(post.id, postRow(post, "extra"));   // e.g. a pre-event teaser
    }
    if (!pending.has(post.id)) pending.set(post.id, []);
    pending.get(post.id).push({ ad, how });
  }

  /* fit rule: smallest ads first, never credit more paid views than the post has views */
  for (const [id, list] of pending) {
    const row = rowsById.get(id);
    list.sort((a, b) => (a.ad.views || 0) - (b.ad.views || 0));
    for (const { ad, how } of list) {
      const v = ad.views || 0;
      const fits = row.views != null && row.paid + v <= row.views;
      if (fits || how === "manual") {
        if (!fits) flag("bad", `Manual match puts more paid views on ${id} than it has views — organic would be negative.`);
        row.ads.push({ ...ad, how });
        row.paid += v;
        row.spend += ad.usd || 0;
      } else {
        loose.push({ ad, kind: "separate", post: row.post, how });
      }
    }
  }

  /* 5 · the rows, in report order */
  const postRows = [...rowsById.values()].filter(r => r.kind === "post");
  const extraRows = [...rowsById.values()].filter(r => r.kind === "extra");
  const adOnlyRow = (x) => ({
    kind: x.kind, id: x.post?.id || x.ad.key, post: x.post || null, link: x.post?.link || "", account: x.post?.account || "",
    collab: !!x.post?.collab, format: x.post?.format || "Ad", content: x.post?.content || x.ad.ad, date: x.post?.date || x.ad.start,
    views: x.ad.views || 0, paid: x.ad.views || 0, spend: x.ad.usd || 0, ads: [{ ...x.ad, how: x.how }], owner: x.owner,
    reach: null, likes: null, comments: null, saves: null, shares: null, visits: null, follows: null, interactions: null,
    boostedFlag: true, adOnly: true, candidates: x.candidates,
  });
  const order = { separate: 1, older: 2, "other-event": 3, adonly: 4 };
  const looseRows = loose.map(adOnlyRow).sort((a, b) => order[a.kind] - order[b.kind]);
  const campRows = campaignRows.map(ad => ({
    kind: "campaign", id: ad.key, content: ad.campaign || ad.ad, format: "Campaign", link: "",
    views: 0, paid: 0, spend: ad.usd || 0, ads: [ad], adOnly: true, boostedFlag: true,
  }));
  const rows = [...postRows, ...extraRows, ...looseRows, ...campRows];
  for (const r of rows) {
    r.boosted = r.ads.length > 0;
    r.organic = r.views == null ? null : r.views - r.paid;
    r.cpm = r.paid && r.spend ? per1k(r.spend, r.paid) : null;     // no CPM when the spend sits in a campaign row
    r.er = r.interactions != null && r.views ? r.interactions / r.views : null;
    r.campaigns = [...new Set(r.ads.map(a => a.campaign).filter(Boolean))].join(", ");
  }

  /* 6 · checks (§6) */
  for (const r of [...postRows, ...extraRows]) {
    if (r.views == null) flag("bad", `${label(r)} has no views number.`);
    if (r.organic != null && r.organic < 0) flag("bad", `${label(r)}: organic views are negative — an ad that doesn't fit was credited.`);
    if (r.boostedFlag && !r.boosted) flag("warn", `${label(r)} ran as an ad but no export contains it — its views count as organic until the export arrives.`);
  }
  const nameMatched = matchLog.filter(m => m.how === "name").length;
  if (nameMatched) flag("info", `${nameMatched} ad${nameMatched > 1 ? "s" : ""} matched by name, not post ID — check them in “Ad matching”.`);
  const sep = looseRows.filter(r => r.kind === "separate").length;
  if (sep) flag("info", sep > 1 ? `${sep} ads didn't fit their posts' views and are listed as separate ad versions (dark-post copies).`
    : "1 ad didn't fit its post's views and is listed as a separate ad version (a dark-post copy).");
  const un = looseRows.filter(r => r.kind === "adonly").length;
  if (un) flag("warn", `${un} ad${un > 1 ? "s" : ""} couldn't be matched to a post — shown as ad-only rows. Match them in “Ad matching” if you know the post.`);
  if (campRows.length) flag("warn", "Some ad data is campaign level only: spend counts, views don't.");
  if (pullDates.size > 1) flag("warn", `Posts were pulled on different days (${[...pullDates].sort().join(", ")}). All numbers should come from one data date.`);
  if (!dataDate) flag("warn", "No data date set for this report.");
  if (rep.type === "event") {
    for (const id of mainIds) {
      const clash = otherEvents.find(e => (e.postIds || []).includes(id));
      if (clash) flag("bad", `Post ${id} is also in “${clash.name}” — a post's views can only count in one event.`);
    }
  }
  const importSpend = sum(ads, a => a.usd);
  const rowSpend = sum(rows, r => r.spend);
  if (Math.abs(importSpend - rowSpend) > 0.01) flag("bad", `Spend in rows ($${r2(rowSpend)}) doesn't equal spend in the exports ($${r2(importSpend)}).`);

  /* 7 · costs */
  // An event's costs live in its linked costing report (older reports may hold their own lines)
  const costing = rep.costingId && db.reports?.[rep.costingId] && !db.reports[rep.costingId].deleted ? db.reports[rep.costingId] : null;
  const costSrc = costing || rep;
  const cfx = { ...fx, ...(costing?.fx || {}) };
  const infl = (costSrc.influencers || []).map(l => ({ ...l, usd: toUSD(l.fee, l.currency, cfx) }));
  const costs = (costSrc.eventCosts || []).map(l => ({ ...l, usd: costLineUSD(l, cfx) }));
  const other = (rep.otherSpend || []).map(l => ({ ...l, usd: toUSD(l.amount, l.currency, fx) }));
  for (const l of [...infl, ...costs, ...other]) if (l.usd == null) flag("bad", `No FX rate for ${l.currency}.`);
  const influencerCost = infl.length ? sum(infl, l => l.usd) : null;
  const eventCost = costs.length ? sum(costs, l => l.usd) : null;
  const byCategory = COST_CATEGORIES.map(k => ({ category: k, usd: sum(costs.filter(l => l.category === k), l => l.usd), lines: costs.filter(l => l.category === k).length }))
    .filter(x => x.lines);
  const otherSpend = other.length ? sum(other, l => l.usd) : null;
  const nonAd = rep.type === "event"
    ? (influencerCost == null && eventCost == null ? null : (influencerCost || 0) + (eventCost || 0))
    : otherSpend;
  const adSpend = rowSpend;

  /* 8 · totals (§3.2 / §4.3) */
  const totalViews = sum(rows, r => r.views);
  const paidViews = sum(rows, r => r.paid);
  const organicViews = totalViews - paidViews;
  const totalSpend = adSpend + (nonAd || 0);
  const contentRows = [...postRows, ...extraRows];
  // no likes/comments/saves/shares in the data at all → engagement is missing, not zero
  const hasEng = list => list.some(r => r.interactions != null);
  const interactions = hasEng(contentRows) ? sum(contentRows, r => r.interactions) : null;
  const postViews = sum(contentRows, r => r.views);
  const anyFollowCol = ads.some(a => a.hasFollows);
  const adFollows = anyFollowCol ? sum(ads, a => a.follows) : null;

  const T = {
    totalViews, paidViews, organicViews, postViews,
    pctOrganic: div(organicViews, totalViews), pctPaid: div(paidViews, totalViews),
    adSpend, nonAd, totalSpend, influencerCost, eventCost, otherSpend,
    adsCPM: ads.length ? per1k(adSpend, paidViews) : null,
    organicCPM: nonAd ? per1k(nonAd, organicViews) : null,
    blendedCPM: per1k(totalSpend, totalViews),
    adsOnly: ads.length ? div(adSpend, paidViews) : null,
    organicOnly: nonAd ? div(nonAd, organicViews) : null,
    interactions, er: div(interactions, postViews),
    reach: sum(contentRows, r => r.reach),
    likes: sum(contentRows, r => r.likes), comments: sum(contentRows, r => r.comments),
    saves: sum(contentRows, r => r.saves), shares: sum(contentRows, r => r.shares),
    visits: contentRows.some(r => r.visits != null) ? sum(contentRows, r => r.visits) : null,
    postFollows: contentRows.some(r => r.follows != null) ? sum(contentRows, r => r.follows) : null,
    adFollows, costPerFollow: adFollows ? div(adSpend, adFollows) : null,
    costPerEngagement: div(totalSpend, interactions),
    posts: postRows.length, extra: extraRows.length,
    nancyPosts: postRows.filter(r => !r.collab).length, collabPosts: postRows.filter(r => r.collab).length,
  };
  const collabViews = sum(contentRows.filter(r => r.collab), r => r.views);
  T.collabViews = collabViews;
  T.influencerPer1kCollab = influencerCost != null && collabViews ? per1k(influencerCost, collabViews) : null;

  if (T.adsCPM != null && (T.adsCPM < settings.cpmRange[0] / 2 || T.adsCPM > settings.cpmRange[1] * 2))
    flag("bad", `Ads CPM is $${r2(T.adsCPM)} — Hello Nancy usually runs $${settings.cpmRange[0]}–$${settings.cpmRange[1]}. Paid views and spend probably don't cover the same thing (date range, wrong ad, or results pasted as views).`);
  else if (T.adsCPM != null && (T.adsCPM < settings.cpmRange[0] || T.adsCPM > settings.cpmRange[1]))
    flag("info", `Ads CPM $${r2(T.adsCPM)} is outside the usual $${settings.cpmRange[0]}–$${settings.cpmRange[1]}.`);

  /* 9 · per campaign */
  const camps = new Map();
  for (const a of ads) {
    const k = a.campaign || "(no campaign name)";
    if (!camps.has(k)) camps.set(k, { campaign: k, spend: 0, currency: a.currency, usd: 0, views: 0, reach: 0, impressions: 0, follows: anyFollowCol ? 0 : null, ads: 0, mixedCur: false });
    const c = camps.get(k);
    if (c.currency !== a.currency) c.mixedCur = true;
    c.spend += a.spend; c.usd += a.usd || 0; c.views += a.views || 0; c.reach += a.reach || 0;
    c.impressions += a.impressions || 0; if (c.follows != null) c.follows += a.follows || 0; c.ads++;
  }
  const campaigns = [...camps.values()].map(c => ({ ...c, cpm: per1k(c.usd, c.views), pctPaid: div(c.views, paidViews), cpf: c.follows ? c.usd / c.follows : null }))
    .sort((a, b) => b.usd - a.usd);
  for (const c of campaigns) if (c.cpm != null && (c.cpm > settings.cpmRange[1] * 2 || c.cpm < settings.cpmRange[0] / 2))
    flag("warn", `Campaign “${c.campaign}” CPM $${r2(c.cpm)} is far outside $${settings.cpmRange[0]}–$${settings.cpmRange[1]}.`);

  /* 10 · breakdowns */
  const group = (name, list) => {
    const views = sum(list, r => r.views), inter = hasEng(list) ? sum(list, r => r.interactions) : null;
    return {
      name, posts: list.length, views, reach: sum(list, r => r.reach), likes: sum(list, r => r.likes),
      comments: sum(list, r => r.comments), saves: sum(list, r => r.saves), shares: sum(list, r => r.shares),
      interactions: inter, er: div(inter, views), vsBench: views && inter != null ? div(inter, views) - bench : null,
      paid: sum(list, r => r.paid), spend: sum(list, r => r.spend),
      avgViews: list.length ? views / list.length : null,
      avgER: (() => { const e = list.map(r => r.er).filter(x => x != null); return e.length ? sum(e) / e.length : null; })(),
    };
  };
  const breakdown = [
    group("Nancy posts", contentRows.filter(r => !r.collab)),
    group("Collab posts", contentRows.filter(r => r.collab)),
    group("Boosted posts", contentRows.filter(r => r.boosted)),
    group("Organic posts", contentRows.filter(r => !r.boosted)),
    group("Total", contentRows),
  ];
  const formats = [...new Set(contentRows.map(r => r.format || "Other"))]
    .map(f => group(f, contentRows.filter(r => (r.format || "Other") === f)));

  /* 11 · rankings */
  const byER = list => list.filter(r => r.er != null).sort((a, b) => b.er - a.er);
  const top = (list, n = 3) => list.slice(0, n);
  // lowest 3 never repeats a post already in the top 3 (small groups just have fewer)
  const bottom = (list, n = 3) => list.slice(Math.max(n, list.length - n)).reverse();
  const rankings = rep.type === "week"
    ? {
        "Top 3 by views": top([...contentRows].filter(r => r.views != null).sort((a, b) => b.views - a.views)),
        "Top 3 by eng. rate": top(byER(contentRows)),
        "Lowest 3 by eng. rate": bottom(byER(contentRows)),
      }
    : {
        "Organic — top 3": top(byER(contentRows.filter(r => !r.boosted))),
        "Organic — lowest 3": bottom(byER(contentRows.filter(r => !r.boosted))),
        "Collab — top 3": top(byER(contentRows.filter(r => r.collab))),
        "Collab — lowest 3": bottom(byER(contentRows.filter(r => r.collab))),
        "Boosted — top 3": top(byER(contentRows.filter(r => r.boosted))),
        "Boosted — lowest 3": bottom(byER(contentRows.filter(r => r.boosted))),
      };

  /* 12 · one post carrying the report */
  const sortedByViews = [...contentRows].filter(r => r.views).sort((a, b) => b.views - a.views);
  const leader = sortedByViews[0];
  const dominant = leader && postViews && leader.views / postViews > 0.5 ? leader : null;
  let withoutCollabs = null;
  if (dominant && dominant.collab) {
    const keep = rows.filter(r => !r.collab);
    const v = sum(keep, r => r.views), s = sum(keep, r => r.spend) + (nonAd || 0);
    const kc = keep.filter(r => !r.adOnly);
    withoutCollabs = {
      views: v, blendedCPM: per1k(s, v), er: div(sum(kc, r => r.interactions), sum(kc, r => r.views)),
      note: rep.type === "event" ? "Non-ad cost kept in full (influencer fees included)." : "Other spend kept in full.",
    };
  }
  const shareSave = T.shares + T.saves;
  const ssLeader = [...contentRows].sort((a, b) => ((b.shares || 0) + (b.saves || 0)) - ((a.shares || 0) + (a.saves || 0)))[0];
  const shareability = {
    total: shareSave,
    top: ssLeader && shareSave ? { row: ssLeader, pct: ((ssLeader.shares || 0) + (ssLeader.saves || 0)) / shareSave } : null,
  };

  /* 13 · scorecard extras (event) */
  const nancyRows = contentRows.filter(r => !r.collab), collabRows = contentRows.filter(r => r.collab);
  const score = {
    reachNancy: sum(nancyRows, r => r.reach), reachCollab: sum(collabRows, r => r.reach),
    erOrganic: breakdown[3].er, erBoosted: breakdown[2].er, erNancy: breakdown[0].er, erCollab: breakdown[1].er,
    pctViewsNancy: div(sum(nancyRows, r => r.views), postViews),
    pctEngCollab: interactions ? div(sum(collabRows, r => r.interactions), interactions) : null,
  };

  /* 14 · missing lines */
  const missing = {};
  if (!ads.length) missing.ads = M("ad exports (ad level, with Views)", "Ads person");
  const costWho = costing ? `Event costing person (costing report “${costing.name}”)` : "Event costing person — link a costing report";
  if (rep.type === "event" && !infl.length) missing.influencers = M("influencer costs", costWho);
  if (rep.type === "event" && !costs.length) missing.eventCosts = M("event costs", costWho);
  if (ads.length && !anyFollowCol) missing.adFollows = M("“Instagram follows” column in the ad export", "Ads person");
  if (!contentRows.length) missing.posts = M("the post table", "Organic person");
  else if (interactions == null) missing.engagement = M("likes, comments, saves and shares per post", "Organic person");
  if (rep.type === "event" && !costs.length)
    flag("info", "No event costs entered — Organic CPM is left blank, not $0.");

  /* 15 · weekly account level */
  let account = null;
  if (rep.type === "week") {
    const a = rep.account || {};
    const days = daysBetween(rep.start, rep.end) + 1;
    const tgt = settings.target.views * (days / PERIOD_DAYS[settings.target.period || "month"]);
    account = {
      ...a, days, weekTarget: tgt,
      pctTarget: a.views != null ? a.views / tgt : null,
      er: div(a.interactions, a.views), erPrev: div(a.interactionsPrev, a.viewsPrev),
    };
  }

  const durationDays = rep.start && rep.end ? daysBetween(rep.start, rep.end) + 1 : null;
  return {
    rep, fx, dataDate, durationDays, rows, postRows, extraRows, looseRows, campRows, contentRows,
    T, campaigns, breakdown, formats, rankings, dominant, withoutCollabs, shareability, score,
    influencers: infl, eventCosts: costs, byCategory, other, account, missing, flags, matchLog, bench, costing,
  };
}

const label = r => (r.content ? `“${r.content.slice(0, 40)}${r.content.length > 40 ? "…" : ""}”` : r.id);

/* ───────── comparisons (§3.3) ───────── */

/** Status: 🟢 better · 🟡 within ±5% · 🔴 worse. Rates change in percentage points. */
export function compare(cur, prev, { rate = false, lowerBetter = false } = {}) {
  if (cur == null || prev == null) return { cur, prev, change: null, rate, status: null };
  const rel = prev ? (cur - prev) / Math.abs(prev) : cur ? Infinity : 0;
  const change = rate ? (cur - prev) * 100 : rel;            // pp for rates, fraction for counts
  let status = "🟡";
  if (Math.abs(rel) > 0.05) status = (cur > prev) !== lowerBetter ? "🟢" : "🔴";
  return { cur, prev, change, rate, status };
}

/** The metric list for week vs last week (and report vs report). */
export function compareReports(A, B) {
  const a = A.T;
  // A report with no posts or ads yet has no numbers, not zeros
  const b = B.contentRows.length || B.rows.length ? B.T : Object.fromEntries(Object.keys(B.T).map(k => [k, null]));
  const acc = (R, k) => R.account?.[k] ?? null;
  const prevAcc = k => (A.account?.[k + "Prev"] ?? acc(B, k));
  const rows = [
    ["Account views", acc(A, "views"), A.account ? prevAcc("views") : null, {}],
    ["Account interactions", acc(A, "interactions"), A.account ? prevAcc("interactions") : null, {}],
    ["Account eng. rate", A.account?.er ?? null, A.account ? (A.account.erPrev ?? B.account?.er ?? null) : null, { rate: true }],
    ["Post views", a.postViews, b.postViews, {}],
    ["Reach (posts)", a.reach, b.reach, {}],
    ["Interactions", a.interactions, b.interactions, {}],
    ["Eng. rate (per view)", a.er, b.er, { rate: true }],
    ["Follows (from posts)", a.postFollows, b.postFollows, {}],
    ["Profile visits", a.visits, b.visits, {}],
    ["Paid views", a.paidViews, b.paidViews, {}],
    ["Organic views", a.organicViews, b.organicViews, {}],
    ["Ad spend (USD)", a.adSpend, b.adSpend, { lowerBetter: true, money: true }],
    ["Ads CPM", a.adsCPM, b.adsCPM, { lowerBetter: true, money: true }],
    ["Blended CPM", a.blendedCPM, b.blendedCPM, { lowerBetter: true, money: true }],
    ["Cost per follow", a.costPerFollow, b.costPerFollow, { lowerBetter: true, money: true }],
    ["Number of posts", a.posts, b.posts, {}],
  ];
  if (A.rep.type === "event") {
    rows.splice(0, 3,
      ["Total views", a.totalViews, b.totalViews, {}],
      ["Total spend (USD)", a.totalSpend, b.totalSpend, { lowerBetter: true, money: true }],
    );
    rows.push(["Cost per engagement", a.costPerEngagement, b.costPerEngagement, { lowerBetter: true, money: true }]);
  }
  return rows.map(([name, cur, prev, o]) => ({ name, money: !!o.money, ...compare(cur, prev, o) }));
}

/** The weekly report that came just before this one (ends the day before it starts, or the nearest earlier). */
export function previousWeek(rep, reports) {
  const weeks = Object.values(reports).filter(r => !r.deleted && r.type === "week" && r.id !== rep.id && r.end < rep.start)
    .sort((a, b) => (a.end < b.end ? 1 : -1));
  return weeks.find(r => r.end === addDays(rep.start, -1)) || weeks[0] || null;
}

/* ───────── handing the numbers to Claude (§5) ───────── */

const pct = x => (x == null ? "n/a" : (x * 100).toFixed(2) + "%");
const usd = x => (x == null ? "n/a" : "$" + r2(x).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const int = x => (x == null ? "n/a" : Math.round(x).toLocaleString("en-US"));

/** A plain-text summary of every computed number, for the rundown prompt. */
export function factSheet(R, P) {
  const { rep, T } = R;
  const L = [];
  L.push(rep.type === "week"
    ? `WEEKLY SOCIAL REPORT · ${rep.start} → ${rep.end} · ${DEFAULT_SETTINGS.account} · ${T.posts} posts · data pulled ${R.dataDate || "n/a"}`
    : `EVENT REPORT · ${rep.name} · ${rep.start} → ${rep.end} · ${R.durationDays} days · ${T.posts} event posts (${T.nancyPosts} Nancy, ${T.collabPosts} collab) + ${T.extra} extra · data pulled ${R.dataDate || "n/a"}`);
  L.push("", "TOTALS");
  L.push(`Total views ${int(T.totalViews)} · organic ${int(T.organicViews)} (${pct(T.pctOrganic)}) · paid ${int(T.paidViews)} (${pct(T.pctPaid)})`);
  L.push(`Post views ${int(T.postViews)} · reach ${int(T.reach)} · interactions ${int(T.interactions)} (likes ${int(T.likes)}, comments ${int(T.comments)}, saves ${int(T.saves)}, shares ${int(T.shares)})`);
  L.push(`Eng. rate per view ${pct(T.er)} vs brand benchmark ${pct(R.bench)}`);
  L.push(`Profile visits ${int(T.visits)} · follows from posts ${int(T.postFollows)} · follows from ads ${T.adFollows == null ? "MISSING" : int(T.adFollows)} · cost per follow ${usd(T.costPerFollow)}`);
  L.push(`Ad spend ${usd(T.adSpend)} · ads CPM ${usd(T.adsCPM)} · blended CPM ${usd(T.blendedCPM)} · cost per engagement ${usd(T.costPerEngagement)}`);
  if (rep.type === "event") {
    L.push(`Influencer cost ${T.influencerCost == null ? "MISSING" : usd(T.influencerCost)} · event cost ${T.eventCost == null ? "MISSING" : usd(T.eventCost)} · non-ad ${usd(T.nonAd)} · total spend ${usd(T.totalSpend)}`);
    L.push(`Organic CPM ${T.organicCPM == null ? "blank (no cost)" : usd(T.organicCPM)} · influencer cost per 1,000 collab views ${usd(T.influencerPer1kCollab)}`);
    const s = R.score;
    L.push(`Reach Nancy ${int(s.reachNancy)} / collab ${int(s.reachCollab)} · ER organic ${pct(s.erOrganic)}, boosted ${pct(s.erBoosted)}, Nancy ${pct(s.erNancy)}, collab ${pct(s.erCollab)}`);
    L.push(`% of views from Nancy posts ${pct(s.pctViewsNancy)} · % of engagements from collab posts ${pct(s.pctEngCollab)}`);
  } else if (T.otherSpend != null) L.push(`Other spend ${usd(T.otherSpend)} · organic CPM ${usd(T.organicCPM)}`);
  if (R.account) {
    const a = R.account;
    L.push("", "ACCOUNT (IG dashboard)");
    L.push(`Account views ${int(a.views)} (last week ${int(a.viewsPrev)}) · ${pct(a.pctTarget)} of the ${int(a.weekTarget)} target for ${a.days} days`);
    L.push(`Account interactions ${int(a.interactions)} (last week ${int(a.interactionsPrev)}) · account ER ${pct(a.er)}`);
    L.push(`Net followers ${int(a.netFollowers)} · views from followers ${pct(a.followersPct)} / non-followers ${pct(a.nonFollowersPct)} · male ${pct(a.malePct)} / female ${pct(a.femalePct)}`);
  }
  L.push("", "BREAKDOWN (posts · views · ER)");
  for (const g of R.breakdown) L.push(`${g.name}: ${g.posts} · ${int(g.views)} · ${pct(g.er)}`);
  if (rep.type === "week") for (const g of R.formats) L.push(`Format ${g.name}: ${g.posts} posts · avg views ${int(g.avgViews)} · avg ER ${pct(g.avgER)}`);
  L.push("", "CAMPAIGNS");
  for (const c of R.campaigns) L.push(`${c.campaign}: ${usd(c.usd)} · ${int(c.views)} views · CPM ${usd(c.cpm)} · ${pct(c.pctPaid)} of paid views · follows ${c.follows == null ? "n/a" : int(c.follows)}`);
  L.push("", "POSTS");
  for (const r of R.rows) L.push(`[${r.kind}] ${r.account || ""} ${r.format} “${(r.content || "").slice(0, 60)}” · views ${int(r.views)} (paid ${int(r.paid)}) · reach ${int(r.reach)} · ER ${pct(r.er)} · shares ${int(r.shares)} saves ${int(r.saves)} · follows ${int(r.follows)} · spend ${usd(r.spend)}${r.campaigns ? " · " + r.campaigns : ""} · ${r.link}`);
  if (R.dominant) L.push("", `ONE POST DRIVES MOST VIEWS: “${R.dominant.content.slice(0, 60)}” (${R.dominant.collab ? "collab" : "Nancy"}) = ${pct(R.dominant.views / T.postViews)} of post views.`);
  if (R.withoutCollabs) L.push(`Without collab posts: views ${int(R.withoutCollabs.views)} · blended CPM ${usd(R.withoutCollabs.blendedCPM)} · ER ${pct(R.withoutCollabs.er)}`);
  if (R.shareability.top) L.push(`Shares+saves ${int(R.shareability.total)}; top post has ${pct(R.shareability.top.pct)} of them.`);
  if (P) {
    L.push("", "VS " + (rep.type === "week" ? "LAST WEEK" : "COMPARISON REPORT") + ` (${P.rep.name || P.rep.start + " → " + P.rep.end}, data pulled ${P.dataDate || "n/a"})`);
    for (const c of compareReports(R, P)) L.push(`${c.name}: ${fmtCmp(c)}`);
  }
  L.push("", "FLAGS / CAVEATS");
  for (const f of R.flags) L.push(`- ${f.text}`);
  for (const m of Object.values(R.missing)) L.push(`- Missing — need ${m.need}, from ${m.who}`);
  return L.join("\n");
}
function fmtCmp(c) {
  const f = v => (v == null ? "n/a" : c.rate ? pct(v) : c.money ? usd(v) : int(v));
  const ch = c.change == null ? "n/a" : c.rate ? `${c.change >= 0 ? "+" : ""}${c.change.toFixed(2)} pp` : isFinite(c.change) ? `${c.change >= 0 ? "+" : ""}${(c.change * 100).toFixed(1)}%` : "new";
  return `${f(c.cur)} vs ${f(c.prev)} (${ch}) ${c.status || ""}`;
}

export function rundownPrompt(R, P) {
  const week = R.rep.type === "week";
  const ask = week
    ? `Write the weekly rundown (§5): a one-sentence headline on how the week went vs last week; 2–4 wins with numbers; 2–4 concerns with numbers; 3–5 concrete actions for next week (what to post more/less of, what to boost, which collabs to repeat, posting cadence); data caveats. Call out when one post (often a collab) drives most of the week's views and show the picture without it.`
    : `Write the event rundown (§5): a one-sentence headline; then a verdict table — Goal | Verdict (Performed / Moderate / Below average / Partly) | Evidence (≤25 words with the key numbers) — for Reach & awareness, Engagement – Nancy (brand), Engagement – Collabs, Follower growth, Shareability, Cost efficiency, Overall; then what went well, what to watch, 3–5 next steps for the next event, and data caveats.`;
  return `You are writing the rundown for a Hello Nancy ${week ? "weekly social" : "event content"} report.

Rules: judge on social results, not sales. @hellonancy_official is a brand account — benchmark eng. rate (per VIEW) against ~1.9% for brands (beauty ~2.1%). Use ONLY the numbers below; never invent or estimate a figure; if something is missing, say so. Tone: direct, plain English, numbers first. No fluff, no sales talk. Hello Nancy ads usually run $4–$17 CPM.

${ask}

Format: Markdown, short. Headings: ${week ? "Headline, Wins, Concerns, Actions for next week, Data caveats" : "Headline, Verdicts (table), What went well, What to watch, Next steps, Data caveats"}.

=== NUMBERS ===
${factSheet(R, P)}`;
}

/* ───────── costing reports: reading invoices ─────────
   An invoice (text pulled from a PDF or a photo, or one pasted row) is read for
   vendor, amount, currency, date and invoice number, then sorted:
     a person — model, influencer, creator, talent — → the influencer list
     everything else (production, venue, travel, food, merch …) → event costs, by category
   Every guess carries a confidence and the reasons, and nothing is added until a
   person has looked at the review table. */

const INFLUENCER_WORDS = [
  "influencer", "creator", "content creator", "talent", "model", "modelling", "modeling", "ugc", "usage rights",
  "whitelisting", "ambassador", "collab", "collaboration", "deliverable", "reel", "reels", "stories", "story", "tiktok",
  "instagram post", "ig post", "appearance fee", "posting fee", "content fee", "brand partnership", "sponsored post", "paid partnership",
];
const CATEGORY_WORDS = {
  "Venue & production": ["production", "crew", "photographer", "photography", "videographer", "videography", "filming", "shoot", "studio", "equipment", "rental", "lighting", "sound", "editing", "editor", "venue", "location fee", "stage", "hair", "makeup", "mua", "stylist", "styling", "retouch", "director", "producer", "dp", "camera"],
  "Hotel / accommodation": ["hotel", "accommodation", "airbnb", "lodging", "resort", "room", "nights", "check-in", "check in"],
  "Flights / transportation": ["flight", "airline", "airfare", "air ticket", "uber", "lyft", "taxi", "transfer", "car service", "chauffeur", "train", "baggage", "boarding", "van hire", "transport"],
  "Team meals & event expenses": ["meal", "restaurant", "catering", "lunch", "dinner", "breakfast", "food", "coffee", "cafe", "drinks", "bar", "per diem"],
  "Merch & giveaways": ["merch", "merchandise", "giveaway", "gift", "swag", "tote", "printing", "print", "samples", "packaging", "goodie"],
  "Decor": ["decor", "decoration", "balloon", "flowers", "florist", "floral", "props", "backdrop", "signage", "banner"],
  "General logistics": ["shipping", "courier", "dhl", "fedex", "ups", "storage", "logistics", "permit", "insurance", "visa", "sim card", "delivery"],
};
const OURS = /hello\s*nancy|hellonancy|withally|with ally|carenbloom/i;

const CUR_SYMBOLS = [
  [/HK\$|HKD/i, "HKD"], [/US\$|USD/i, "USD"], [/MX\$|MXN|pesos?/i, "MXN"], [/(?<![A-Z])S\$|SGD/i, "SGD"], [/£|GBP/i, "GBP"],
  [/€|EUR/i, "EUR"], [/RMB|CNY|¥|元/i, "CNY"],
];
const MONEY = /(HK\$|US\$|MX\$|S\$|£|€|¥|\$|RMB|CNY|HKD|USD|MXN|GBP|EUR|SGD)?\s?(\d{1,3}(?:[,\s]\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s?(HKD|USD|MXN|GBP|EUR|CNY|RMB|SGD)?/gi;

const wordHits = (text, words) => words.filter(w => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i").test(text));

/** Sort a piece of text: influencer vs event cost, and the event category. */
export function classifyCost(text) {
  const t = String(text || "").toLowerCase();
  const infl = wordHits(t, INFLUENCER_WORDS);
  const handle = (t.match(/@[\w.]{3,30}/g) || []).filter(h => !OURS.test(h));
  const cats = Object.entries(CATEGORY_WORDS).map(([c, w]) => [c, wordHits(t, w)]).sort((a, b) => b[1].length - a[1].length);
  const [topCat, topHits] = cats[0];
  const inflScore = infl.length + (handle.length ? 2 : 0);
  const evScore = topHits.length;
  const type = inflScore > evScore ? "influencer" : "event";
  const margin = Math.abs(inflScore - evScore);
  const reasons = [];
  if (infl.length) reasons.push(`influencer words: ${infl.slice(0, 4).join(", ")}`);
  if (handle.length) reasons.push(`handle ${handle[0]}`);
  if (topHits.length) reasons.push(`${topCat.toLowerCase()} words: ${topHits.slice(0, 4).join(", ")}`);
  if (!infl.length && !topHits.length) reasons.push("no telling words — check the type");
  return {
    type,
    category: type === "event" ? (topHits.length ? topCat : "Other") : null,
    handle: handle[0] || null,
    sure: margin >= 2 ? "high" : margin === 1 ? "medium" : "low",
    reasons,
  };
}

function currencyOf(text) {
  const counts = CUR_SYMBOLS.map(([re, code]) => [code, (String(text).match(new RegExp(re.source, "gi")) || []).length]).filter(x => x[1]);
  counts.sort((a, b) => b[1] - a[1]);
  if (counts.length) return { currency: counts[0][0], guessed: false };
  return { currency: "USD", guessed: true };
}

function amountsIn(line) {
  const out = [];
  for (const m of String(line).matchAll(MONEY)) {
    const raw = m[2].replace(/[,\s]/g, "");
    const n = Number(raw);
    if (!isFinite(n) || n <= 0) continue;
    const hasMoneyShape = m[1] || m[3] || /\.\d{2}$/.test(m[2]) || /,/.test(m[2]);
    if (!hasMoneyShape) continue;                               // plain numbers (qty, years, phone bits) aren't money
    if (/^(19|20)\d{2}$/.test(raw) && !m[1] && !m[3]) continue;
    out.push(n);
  }
  return out;
}

/** Read an invoice's text. Returns the fields plus how sure each guess is. */
export function readInvoice(text, fileName = "") {
  const src = String(text || "");
  const lines = src.split(/\n+/).map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const notes = [];

  // amount: the grand total / amount due line wins; otherwise the largest money figure
  let amount = null, amountHow = "none";
  const ranked = [/grand total|total due|amount due|balance due|total payable|amount payable|total amount|total \(?[a-z]{3}\)?$/i, /^total\b|\btotal\b/i];
  for (const re of ranked) {
    for (let i = lines.length - 1; i >= 0 && amount == null; i--) {
      const l = lines[i];
      if (!re.test(l) || /sub\s*-?total|tax\b|vat\b|gst\b|discount|deposit paid/i.test(l)) continue;
      const nums = amountsIn(l).length ? amountsIn(l) : amountsIn(lines[i + 1] || "");
      if (nums.length) { amount = nums[nums.length - 1]; amountHow = "total line"; }
    }
    if (amount != null) break;
  }
  if (amount == null) {
    const all = lines.flatMap(amountsIn);
    if (all.length) { amount = Math.max(...all); amountHow = "largest figure"; notes.push("No “Total” line found — used the largest amount."); }
    else notes.push("No amount found.");
  }

  const { currency, guessed } = currencyOf(src);
  if (guessed) notes.push("Currency not printed — assumed USD.");

  // date: a line that says date first, then any date
  let date = null;
  const dateIn = l => {
    const cands = l.match(/\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/.]\d{1,2}[/.]\d{2,4}|[A-Za-z]{3,9}\.? \d{1,2},? \d{4}|\d{1,2} [A-Za-z]{3,9}\.?,? \d{4}/g) || [];
    for (const c of cands) { const d = toDate(c); if (d) return d; }
    return null;
  };
  for (const l of lines) if (/date/i.test(l) && !/due date/i.test(l)) { date = dateIn(l); if (date) break; }
  if (!date) for (const l of lines) { date = dateIn(l); if (date) break; }

  const invM = src.match(/(?:invoice|inv|receipt|bill)\s*(?:no\.?|number|num|#)\s*[:#.]?\s*([A-Z0-9][A-Z0-9\-/]{2,})/i)
    || src.match(/\b(INV[-\s]?\d[\w-]*)/i);
  const invoiceNo = invM && /\d/.test(invM[1]) ? invM[1] : "";

  // vendor: a "from" line, else the first line that isn't a heading or us
  let vendor = "";
  for (let i = 0; i < lines.length && !vendor; i++) {
    const m = lines[i].match(/^(?:from|bill from|billed by|issued by|payee|vendor|supplier|pay to|name)\s*[:\-]\s*(.*)$/i);
    if (m) vendor = (m[1] || lines[i + 1] || "").trim();
  }
  // otherwise the first short line with no amount, minus words like "Invoice"/"Receipt" ("Uber Receipt" → "Uber")
  if (!vendor) {
    for (const l of lines) {
      if (/date|bill to|page|total|amount|^\d|^#|@|invoice\s*(no|#|number)/i.test(l) || OURS.test(l) || amountsIn(l).length) continue;
      const v = l.replace(/\b(tax\s+)?(invoice|receipt|bill|statement|quotation)\b/gi, "").replace(/^[\s:–-]+|[\s:–-]+$/g, "").trim();
      if (v.length >= 2 && v.length <= 60) { vendor = v; break; }
    }
  }
  vendor = vendor.replace(OURS, "").replace(/\s{2,}/g, " ").trim();

  const c = classifyCost(`${src}\n${fileName.replace(/[_\-.]+/g, " ")}`);
  if (c.type === "influencer" && c.handle && !/@/.test(vendor)) vendor = vendor ? `${vendor} (${c.handle})` : c.handle;

  // item: a description line that explains what was bought
  const words = c.type === "influencer" ? INFLUENCER_WORDS : CATEGORY_WORDS[c.category] || [];
  // prefer a priced line item; never the payee's name or a header line
  const isHeader = l => /^(from|bill|billed|to|invoice|inv|date|payee|vendor|name|due)\b/i.test(l) || l === vendor || /total/i.test(l) || l.length > 120;
  const hasWord = l => words.some(w => l.toLowerCase().includes(w));
  const itemLine = lines.find(l => !isHeader(l) && hasWord(l) && amountsIn(l).length)
    || lines.find(l => !isHeader(l) && amountsIn(l).length && /[a-z]{3}/i.test(l.replace(MONEY, "")))
    || lines.find(l => !isHeader(l) && hasWord(l));
  // drop the price from the description, keep plain numbers like "2 days"
  const PRICE = /(HK\$|US\$|MX\$|S\$|£|€|¥|\$|RMB|CNY|HKD|USD|MXN|GBP|EUR|SGD)\s?\d[\d,]*(\.\d{1,2})?|\b\d{1,3}(,\d{3})+(\.\d{1,2})?\b|\b\d+\.\d{2}\b/gi;
  const item = (itemLine || fileName.replace(/\.[a-z0-9]+$/i, "")).replace(PRICE, " ").replace(/\s{2,}/g, " ").trim().slice(0, 90);

  // one notch less sure when the amount or currency had to be guessed
  let sure = c.sure;
  if (amount == null) sure = "low";
  else if (amountHow !== "total line" || guessed) sure = sure === "high" ? "medium" : "low";
  return { type: c.type, category: c.category, vendor, item, amount, currency, date, invoiceNo, sure, reasons: [...c.reasons, ...notes], fileName };
}

/** A pasted list of invoices (one per row). Rows without a Type column are sorted by their words. */
export function mapInvoiceRows(table) {
  const H = table.headers;
  const c = {
    type: col(H, /^type/, /^kind/, /^list/),
    category: col(H, /categor/),
    vendor: col(H, /vendor/, /payee/, /supplier/, /creator/, /handle/, /^name/, /^from/, /influencer/, /model/),
    item: col(H, /^item/, /descr/, /deliverable/, /^what/, /^for$/, /memo/),
    amount: col(H, /^amount/, /^total/, /^fee/, /^cost/, /price/, /^usd$/),
    qty: col(H, /^qty/, /quantity/),
    currency: col(H, /currency/, /^cur/),
    date: col(H, /date/),
    invoiceNo: col(H, /invoice/, /inv\b/, /receipt no/, /ref/),
    receipt: col(H, /receipt link/, /^link/, /url/, /file/),
  };
  return table.rows.filter(r => r[c.vendor] || r[c.item] || r[c.amount]).map(r => {
    const text = Object.values(r).join(" ");
    const auto = classifyCost(text);
    let type = auto.type, sure = auto.sure;
    if (c.type && r[c.type]) {
      type = /influ|creator|model|talent|ugc/i.test(r[c.type]) ? "influencer" : "event";
      sure = "high";
    }
    const cat = c.category && r[c.category] ? matchCategory(r[c.category]) : auto.category || "Other";
    const cur = (r[c.currency] || currencyOf(r[c.amount] || "").currency || "USD").toUpperCase();
    return {
      type, category: type === "event" ? cat : null, vendor: r[c.vendor] || "", item: r[c.item] || "",
      amount: num(r[c.amount]), qty: c.qty ? num(r[c.qty]) : null, currency: cur === "RMB" ? "CNY" : cur,
      date: toDate(r[c.date]) || "", invoiceNo: r[c.invoiceNo] || "", receipt: r[c.receipt] || "",
      sure, reasons: c.type && r[c.type] ? [`Type column says “${r[c.type]}”`] : auto.reasons, fileName: "",
    };
  });
}

/** A reviewed invoice → the line it becomes in its list. */
export function invoiceToLine(x) {
  if (x.type === "influencer")
    return { list: "influencers", line: { creator: x.vendor, deliverables: x.item, fee: x.amount, currency: x.currency, notes: "", invoiceNo: x.invoiceNo || "", date: x.date || "", receipt: x.receipt || "", source: x.fileName || "pasted" } };
  return { list: "eventCosts", line: { category: x.category || "Other", item: x.item, date: x.date || "", qty: x.qty ?? null, unit: x.amount, currency: x.currency, vendor: x.vendor, receipt: x.receipt || "", invoiceNo: x.invoiceNo || "", source: x.fileName || "pasted" } };
}

/** Is this invoice already in the costing report? (same invoice number and payee, or same payee, amount and date) */
export function isDuplicate(x, rep) {
  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const lines = [
    ...(rep.influencers || []).map(l => ({ who: l.creator, amt: l.fee, date: l.date, inv: l.invoiceNo })),
    ...(rep.eventCosts || []).map(l => ({ who: l.vendor, amt: (l.qty == null ? 1 : l.qty) * (l.unit || 0), date: l.date, inv: l.invoiceNo })),
  ];
  return lines.some(l =>
    (x.invoiceNo && l.inv && norm(l.inv) === norm(x.invoiceNo) && (!x.vendor || norm(l.who) === norm(x.vendor)))
    || (x.vendor && norm(l.who) === norm(x.vendor) && l.amt === x.amount && (l.date || "") === (x.date || "")));
}

/* ───────── costing report ───────── */

export function buildCosting(rep, db, settings = DEFAULT_SETTINGS) {
  const fx = { ...settings.fx, ...(rep.fx || {}) };
  const flags = [];
  const infl = (rep.influencers || []).map((l, i) => ({ ...l, i, usd: toUSD(l.fee, l.currency, fx) }));
  const costs = (rep.eventCosts || []).map((l, i) => ({ ...l, i, usd: costLineUSD(l, fx) }));
  for (const c of new Set([...infl, ...costs].filter(l => l.usd == null).map(l => l.currency)))
    flags.push({ level: "bad", text: `No FX rate for ${c} — add it under FX.` });
  const noAmount = [...infl.filter(l => l.fee == null), ...costs.filter(l => l.unit == null)].length;
  if (noAmount) flags.push({ level: "bad", text: `${noAmount} line${noAmount > 1 ? "s have" : " has"} no amount.` });
  const noReceipt = [...infl, ...costs].filter(l => !l.receipt && !l.source).length;
  if (noReceipt) flags.push({ level: "info", text: `${noReceipt} line${noReceipt > 1 ? "s have" : " has"} no receipt link or invoice file.` });
  const seen = new Map();
  for (const l of [...infl.map(l => ({ k: `${l.creator}|${l.fee}|${l.date}`, inv: l.invoiceNo })), ...costs.map(l => ({ k: `${l.vendor}|${l.unit}|${l.date}`, inv: l.invoiceNo }))]) {
    const key = l.inv ? "inv:" + l.inv.toLowerCase() : l.k.toLowerCase();
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  const dups = [...seen.values()].filter(n => n > 1).length;
  if (dups) flags.push({ level: "warn", text: `${dups} possible duplicate invoice${dups > 1 ? "s" : ""} (same invoice number, or same payee + amount + date).` });

  // imported summary totals + real invoices = the same money counted twice
  const sheetLines = [...infl, ...costs].filter(l => l.source === "Total Spend tab");
  if (sheetLines.length && sheetLines.length < infl.length + costs.length)
    flags.push({ level: "bad", text: "This costing still has the summary totals imported from the sheet, plus individual invoices — the same costs are probably counted twice. Delete the “total from sheet” lines once all invoices are in (or delete the invoices)." });
  const influencerCost = sum(infl, l => l.usd);
  const eventCost = sum(costs, l => l.usd);
  const byCategory = COST_CATEGORIES.map(k => ({ category: k, usd: sum(costs.filter(l => l.category === k), l => l.usd), lines: costs.filter(l => l.category === k).length }))
    .filter(x => x.lines).sort((a, b) => b.usd - a.usd);
  const byCreator = [...infl].sort((a, b) => (b.usd || 0) - (a.usd || 0));
  const event = Object.values(db.reports || {}).find(r => !r.deleted && r.type === "event" && r.costingId === rep.id) || null;
  const E = event ? buildReport(event, db, settings) : null;
  return {
    rep, fx, influencers: infl, eventCosts: costs, flags, byCategory, byCreator, event, E,
    T: { influencerCost, eventCost, total: influencerCost + eventCost, lines: infl.length + costs.length, creators: infl.length },
  };
}

/** The event report just before this one (for founders: "vs last event"). */
export function previousEvent(rep, reports) {
  return Object.values(reports).filter(r => !r.deleted && r.type === "event" && r.id !== rep.id && (r.end || "") < (rep.start || ""))
    .sort((a, b) => ((a.end || "") < (b.end || "") ? 1 : -1))[0] || null;
}

/* ───────── home-page insights: plain sentences, numbers only ───────── */

export function insights(built, settings = DEFAULT_SETTINGS) {
  const out = [];
  const usd2 = x => "$" + (Math.round(x * 100) / 100).toFixed(2);
  const pc = x => (x * 100).toFixed(2) + "%";
  const events = built.filter(R => R.rep.type === "event" && R.T.totalViews > 0);
  const weeks = built.filter(R => R.rep.type === "week" && R.contentRows.length).sort((a, b) => (a.rep.start < b.rep.start ? 1 : -1));

  if (events.length >= 2) {
    const withCpm = events.filter(R => R.T.blendedCPM != null).sort((a, b) => a.T.blendedCPM - b.T.blendedCPM);
    if (withCpm.length >= 2) {
      const best = withCpm[0], worst = withCpm[withCpm.length - 1];
      out.push({ tone: "good", text: `${best.rep.name} was the cheapest event to reach people: ${usd2(best.T.blendedCPM)} blended CPM, vs ${usd2(worst.T.blendedCPM)} for ${worst.rep.name}.` });
    }
    const byEr = events.filter(R => R.T.er != null).sort((a, b) => b.T.er - a.T.er);
    if (byEr.length >= 2) out.push({ tone: "info", text: `Highest engagement: ${byEr[0].rep.name} at ${pc(byEr[0].T.er)} per view (brand benchmark ${pc(settings.benchmark)}).` });
  }
  const latestEv = events.sort((a, b) => ((a.rep.end || "") < (b.rep.end || "") ? 1 : -1))[0];
  if (latestEv) {
    const T = latestEv.T;
    out.push({ tone: T.er != null && T.er >= settings.benchmark ? "good" : "warn",
      text: `${latestEv.rep.name}: ${Math.round(T.totalViews).toLocaleString("en-US")} views for ${usd2(T.totalSpend)} — ${T.blendedCPM == null ? "no CPM yet" : usd2(T.blendedCPM) + " per 1,000 views"}, eng. rate ${T.er == null ? "n/a" : pc(T.er)}.` });
    const s = latestEv.score;
    if (s.erCollab != null && s.erNancy != null && latestEv.T.collabPosts)
      out.push({ tone: "info", text: `At ${latestEv.rep.name}, collab posts engaged at ${pc(s.erCollab)} vs ${pc(s.erNancy)} for Nancy's own posts.` });
  }
  if (weeks.length >= 2) {
    const [a, b] = weeks;
    const ch = (x, y) => (y ? ((x - y) / y) * 100 : null);
    const v = ch(a.T.postViews, b.T.postViews);
    if (v != null) out.push({ tone: v >= 0 ? "good" : "warn", text: `${a.rep.name}: post views ${v >= 0 ? "up" : "down"} ${Math.abs(v).toFixed(1)}% on the week before (${Math.round(a.T.postViews).toLocaleString("en-US")} vs ${Math.round(b.T.postViews).toLocaleString("en-US")}).` });
    if (a.T.er != null && b.T.er != null) {
      const d = (a.T.er - b.T.er) * 100;
      out.push({ tone: d >= 0 ? "good" : "warn", text: `Eng. rate ${d >= 0 ? "rose" : "fell"} ${Math.abs(d).toFixed(2)} pp to ${pc(a.T.er)}.` });
    }
  }
  const lastWeek = weeks[0];
  if (lastWeek?.dominant) out.push({ tone: "warn", text: `One post drove ${pc(lastWeek.dominant.views / lastWeek.T.postViews)} of ${lastWeek.rep.name}'s post views — the rest of the week is smaller than the total suggests.` });
  if (lastWeek?.account?.pctTarget != null) out.push({ tone: lastWeek.account.pctTarget >= 1 ? "good" : "warn", text: `Account views reached ${pc(lastWeek.account.pctTarget)} of the weekly share of the ${(settings.target.views / 1e6).toFixed(0)}M target.` });
  for (const R of built) if (R.T?.adsCPM != null && (R.T.adsCPM > settings.cpmRange[1] * 2 || R.T.adsCPM < settings.cpmRange[0] / 2))
    out.push({ tone: "bad", text: `${R.rep.name}: ads CPM ${usd2(R.T.adsCPM)} is far outside the usual $${settings.cpmRange[0]}–$${settings.cpmRange[1]} — check the ad export.` });
  return out;
}

/* ───────── importing an existing report sheet (Google Sheets CSV) ─────────
   Reads the team's weekly/event report sheets as they are today: a title row,
   the post table (header row with Link + Views) up to its Total row, and the
   summary block underneath. Only numbers that are in the sheet are taken. */

const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

/** "27 Sep – 3 Oct 2026" / "Sep 27 – Oct 3, 2026" → {start, end} */
export function rangeFrom(text) {
  const s = String(text || "");
  let m = s.match(/(\d{1,2})\s+([A-Za-z]{3,9})\.?\s*(\d{4})?\s*[–—-]\s*(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})/);
  if (m && MON[m[2].slice(0, 3).toLowerCase()] && MON[m[5].slice(0, 3).toLowerCase()]) {
    const y2 = +m[6], m1 = MON[m[2].slice(0, 3).toLowerCase()], m2 = MON[m[5].slice(0, 3).toLowerCase()];
    const y1 = m[3] ? +m[3] : m1 > m2 ? y2 - 1 : y2;
    return { start: ymd(y1, m1, +m[1]), end: ymd(y2, m2, +m[4]) };
  }
  m = s.match(/(\d{1,2})\s*[–—-]\s*(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})/);
  if (m && MON[m[3].slice(0, 3).toLowerCase()]) {
    const mo = MON[m[3].slice(0, 3).toLowerCase()];
    return { start: ymd(+m[4], mo, +m[1]), end: ymd(+m[4], mo, +m[2]) };
  }
  m = s.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s*(\d{4})?\s*[–—-]\s*([A-Za-z]{3,9})?\.?\s*(\d{1,2}),?\s+(\d{4})/);
  if (m && MON[m[1].slice(0, 3).toLowerCase()]) {
    const m1 = MON[m[1].slice(0, 3).toLowerCase()], m2 = m[4] && MON[m[4].slice(0, 3).toLowerCase()] ? MON[m[4].slice(0, 3).toLowerCase()] : m1;
    const y2 = +m[6], y1 = m[3] ? +m[3] : m1 > m2 ? y2 - 1 : y2;
    return { start: ymd(y1, m1, +m[2]), end: ymd(y2, m2, +m[5]) };
  }
  m = s.match(/(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})/);                       // one day: "15 Aug 2026"
  if (m && MON[m[2].slice(0, 3).toLowerCase()]) { const d = ymd(+m[3], MON[m[2].slice(0, 3).toLowerCase()], +m[1]); return { start: d, end: d }; }
  return null;
}

export function parseReportSheet(text) {
  const rows = parseRows(text).map(r => r.map(c => String(c ?? "").trim()));   // every row, title included
  const out = { title: "", range: null, pulled: null, posts: [], ads: [], account: {}, notes: [], type: null };
  out.title = (rows.find(r => r[0]) || [""])[0];
  out.range = rangeFrom(out.title);
  const pm = out.title.match(/pulled\s+(.+)$/i);
  out.pulled = pm ? toDate(pm[1].trim()) : null;
  out.type = /weekly/i.test(out.title) ? "week" : /event/i.test(out.title) ? "event" : null;

  /* the post table */
  const hi = rows.findIndex(r => r.some(c => /^link$/i.test(c)) && r.some(c => /^views$/i.test(c)));
  if (hi < 0) { out.notes.push("No post table found (needs a header row with Link and Views)."); return out; }
  const header = rows[hi];
  let end = rows.findIndex((r, i) => i > hi && (/^total/i.test(r[0]) || !r.some(Boolean)));
  if (end < 0) end = rows.length;
  const table = { headers: header, rows: rows.slice(hi + 1, end).map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""]))) };
  const mapped = mapPosts(table);
  out.posts = mapped.posts;
  out.notes.push(...mapped.errors);

  /* ad numbers already worked out per post in the sheet (no Meta export behind them) */
  const cSpend = col(header, /^ad spend/, /amount spent/), cPaid = col(header, /^paid views/), cCamp = col(header, /^ad campaign/, /^campaign/);
  if (cSpend || cPaid) {
    for (const r of table.rows) {
      const spend = num(r[cSpend]) || 0, views = num(r[cPaid]) || 0;
      if (!spend && !views) continue;
      const cur = (cSpend.match(/\(([A-Z]{3})\)/) || [])[1] || "USD";
      const camp = r[cCamp] || "";
      out.ads.push({
        ad: r[col(header, /^content/, /caption/)] || "", campaign: /^https?:/i.test(camp) || !camp || camp === "0" ? "From the report sheet" : camp,
        adset: "", spend, currency: cur, views, impressions: null, reach: null, follows: null,
        postId: "", permalink: r[col(header, /^link/)] || "", start: null, end: null, results: null, indicator: "",
      });
    }
  }

  /* the summary block underneath */
  const below = rows.slice(end + 1);
  const find = re => below.find(r => re.test(r[0] || ""));
  const nums = s => (String(s || "").match(/\d[\d,]*(?:\.\d+)?%?/g) || []).map(x => num(x));
  const views = find(/^views\b.*account/i) || find(/^account views/i);
  if (views) {
    out.account.views = num(views[1]);
    const lw = String(views[2] || "").match(/last week\s*\(([\d,]+)\)/i);
    if (lw) out.account.viewsPrev = num(lw[1]);
  }
  const eng = find(/^engagement rate/i);
  if (eng) {
    const m = String(eng[2] || "").match(/\(([\d,]+)\s*vs\s*([\d,]+)\s*interactions\)/i);
    if (m) { out.account.interactions = num(m[1]); out.account.interactionsPrev = num(m[2]); }
  }
  const split = find(/followers\s*\/\s*non-followers/i);
  if (split) {
    const p = nums(split[1]).filter(x => x != null && x <= 1);
    if (p.length >= 2) { out.account.followersPct = p[0]; out.account.nonFollowersPct = p[1]; }
  }
  const mf = find(/^male\s*\/\s*female/i);
  if (mf) {
    const p = nums(mf[1]).filter(x => x != null && x <= 1);
    if (p.length >= 2) { out.account.malePct = p[0]; out.account.femalePct = p[1]; }
  }
  const fol = find(/^followers? (increase|change|gained)/i) || find(/^net follow/i);
  if (fol && !/follows from this week|isn.t shown/i.test(fol[2] || "")) out.account.netFollowers = num(fol[1]);
  else if (fol) out.notes.push("The sheet's “Followers increase” is follows from posts, not net follower change — left blank.");
  return out;
}

/** Is this CSV an event table (Sr. no · Platform · Format · Link · … · Total views · Organic views · Boosted views)? */
export function isEventSheet(text) {
  return parseRows(text).slice(0, 6).some(r => r.some(c => /^total views$/i.test(c.trim())) && r.some(c => /^boosted views/i.test(c.trim())));
}

/** One event tab → the event, its posts and the ad numbers behind each row.
    Rows keep the sheet's own split: each boosted row becomes an ad credited to its post,
    so the report's totals equal the sheet's Total Spend row. */
export function parseEventSheet(text) {
  const rows = parseRows(text).map(r => r.map(c => String(c ?? "").trim()));
  const out = { title: "", name: "", range: null, dataDate: null, posts: [], postIds: [], ads: [], expect: null, notes: [], sheetNotes: [] };
  const hi = rows.findIndex(r => r.some(c => /^total views$/i.test(c)) && r.some(c => /^link$/i.test(c)));
  if (hi < 0) { out.notes.push("No event table found (needs Link, Total views and Boosted views columns)."); return out; }
  out.title = rows.slice(0, hi).map(r => r.filter(Boolean).join(" ")).join(" ").replace(/\s+/g, " ").trim();
  out.name = out.title.split("·")[0].trim();
  out.range = rangeFrom(out.title);
  const H = rows[hi];
  const at = re => H.findIndex(h => re.test(h));
  const c = { sr: at(/^sr/i), plat: at(/^platform|^account/i), fmt: at(/^format/i), link: at(/^link$/i), boosted: at(/^boosted \(|^boosted$/i),
    spend: at(/amount spent/i), total: at(/^total views/i), organic: at(/^organic views/i), paid: at(/^boosted views/i) };
  const seeRow = [];                                     // posts whose ads sit in a shared campaign row
  let i = hi + 1;
  for (; i < rows.length; i++) {
    const r = rows[i];
    if (/^total/i.test(r[c.sr] || "") || /^total spend/i.test(r.find(Boolean) || "")) {
      out.expect = { spend: num(r[c.spend]), totalViews: num(r[c.total]), organic: num(r[c.organic]), paid: num(r[c.paid]) };
      break;
    }
    if (!r.some(Boolean)) continue;
    const plat = r[c.plat] || "", link = r[c.link] || "", spendRaw = r[c.spend] || "";
    const spend = num(spendRaw), total = num(r[c.total]), paid = num(r[c.paid]);
    const code = shortcode(link);
    if (code) {
      const account = plat.replace(/\s*\(.*\)\s*$/, "") || "Hello Nancy";
      const extra = /extra|pre-event/i.test(plat);
      out.posts.push({ id: code, link: /^https?:/.test(link) ? link : `https://www.instagram.com/p/${code}/`, igId: "", account,
        collab: /^@/.test(account), format: normFormat(r[c.fmt]), content: "", date: null, boosted: yes(r[c.boosted]),
        snap: { views: total, reach: null, likes: null, comments: null, saves: null, shares: null, visits: null, follows: null } });
      if (!extra) out.postIds.push(code);
      if (/see .*row/i.test(spendRaw)) { seeRow.push(link); continue; }
      if ((paid || 0) > 0 || (spend || 0) > 0)
        out.ads.push({ ad: `${account} ${r[c.fmt] || ""}`.trim(), campaign: /campaign level/i.test(spendRaw) ? "Campaign level (spend in campaign rows)" : "From event sheet",
          spend: spend || 0, currency: "USD", views: paid || 0, permalink: link, postId: "", follows: null, reach: null, impressions: null, adset: "", start: null, end: null, results: null, indicator: "" });
      continue;
    }
    // rows without a post link: campaign spend, ads on other posts, ad-only versions
    const label = plat.match(/\(([^)]+)\)/)?.[1] || plat;
    const base = { adset: "", currency: "USD", postId: "", follows: null, reach: null, impressions: null, start: null, end: null, results: null, indicator: "" };
    if (/^campaign/i.test(plat)) {
      out.ads.push({ ...base, ad: plat, campaign: plat.replace(/^campaign:\s*/i, ""), spend: spend || 0, views: 0, permalink: "" });
    } else if (!total && (paid || 0) > 0 && seeRow.length) {
      // e.g. "Campaign 2 ads" ran on posts marked "see C2 row": credit it to the first of them
      out.ads.push({ ...base, ad: link || plat, campaign: label, spend: spend || 0, views: paid, permalink: seeRow[0] });
      out.notes.push(`“${label}” ran across ${seeRow.length} posts and isn't split by post in the sheet — credited to the first of them; totals are unchanged.`);
    } else if ((spend || 0) > 0 || (paid || total || 0) > 0) {
      out.ads.push({ ...base, ad: link || plat, campaign: label, spend: spend || 0, views: paid || total || 0, permalink: "" });
    }
  }
  for (const r of rows.slice(i + 1)) { const t = r.filter(Boolean).join(" "); if (/^note/i.test(t)) out.sheetNotes.push(t.replace(/^note:\s*/i, "")); }
  // the data date: "refreshed 5 Oct" / "from the 2 Oct Meta screenshot"
  const dm = out.sheetNotes.join(" ").match(/(?:refreshed|from the|pulled|as of)\s+(\d{1,2})\s+([A-Za-z]{3,9})/i);
  if (dm && MON[dm[2].slice(0, 3).toLowerCase()] && out.range) {
    const y = +out.range.end.slice(0, 4), mo = MON[dm[2].slice(0, 3).toLowerCase()];
    out.dataDate = ymd(mo < +out.range.end.slice(5, 7) ? y + 1 : y, mo, +dm[1]);
  }
  return out;
}

/** The cross-event "Total Spend" tab → influencer and non-influencer cost per event. */
export function parseEventTotals(text) {
  const rows = parseRows(text).map(r => r.map(c => String(c ?? "").trim()));
  const out = {};
  for (let i = 0; i < rows.length; i++) {
    rows[i].forEach((cell, j) => {
      const m = cell.match(/^(.+?)\s+[—-]\s+influencer vs non-influencer/i);
      if (!m) return;
      const name = m[1].trim();
      const head = rows[i + 1] || [];
      const ci = head.findIndex((h, k) => k > j && /^influencer content/i.test(h));
      const cn = head.findIndex((h, k) => k > j && /^non-influencer/i.test(h));
      for (let k = i + 2; k < Math.min(rows.length, i + 16); k++) {
        if (/^cost\b/i.test(rows[k][j] || "")) { out[name] = { influencerCost: num(rows[k][ci]), eventCost: num(rows[k][cn]) }; break; }
      }
    });
  }
  return out;
}

/** A PDF can hold one invoice over several pages, or a stack of invoices (one per page).
    Pages are split only when two or more of them each carry their own total. */
export function splitInvoicePages(pages) {
  const texts = (pages || []).map(t => String(t || "")).filter(t => t.trim());
  if (texts.length < 2) return [texts.join("\n")];
  const hasTotal = t => t.split(/\n+/).some(l => /grand total|total due|amount due|balance due|total payable|\btotal\b/i.test(l)
    && !/sub\s*-?total/i.test(l) && amountsIn(l).length);
  const own = texts.filter(hasTotal).length;
  if (own < 2) return [texts.join("\n")];
  // pages without a total (cover sheets, terms) stay attached to the invoice before them
  const out = [];
  for (const t of texts) {
    if (hasTotal(t) || !out.length) out.push(t);
    else out[out.length - 1] += "\n" + t;
  }
  return out;
}

/** Organic or boosted, for labelling a post: how much of its views came from ads. */
export function reachType(r) {
  if (r.boosted && r.views) {
    const share = r.paid / r.views;
    return { kind: "boosted", share, label: `Boosted · ${(share * 100).toFixed(share < 0.01 ? 2 : 0)}% of views from ads`, short: `Boosted ${(share * 100).toFixed(share < 0.01 ? 2 : 0)}% paid` };
  }
  if (r.boostedFlag) return { kind: "unknown", share: null, label: "Ran as an ad · no ad data yet", short: "Ad, no data" };
  return { kind: "organic", share: 0, label: "Pure organic", short: "Organic" };
}
