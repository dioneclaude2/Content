// Run: node tests/social-stats.test.mjs
import * as E from "../public/social-stats/engine.js";
import assert from "node:assert/strict";

const postsTSV = `Date posted\tAccount\tFormat\tContent\tLink\tViews\tReach\tLikes\tComments\tSaves\tShares\tProfile visits\tFollows\tBoosted (Y/N)
2026-10-02\tHello Nancy\tReel\tUS Open day one courtside fit check\thttps://www.instagram.com/reel/AAAAAAAAAA1/\t229,120\t150000\t3000\t100\t400\t500\t900\t120\tYes
2026-10-03\t@cheri2222 (collab)\tReel\tMy US Open look with Nancy\thttps://www.instagram.com/reel/BBBBBBBBBB2/\t50000\t40000\t1500\t60\t90\t50\t200\t30\tNo
2026-10-04\tHello Nancy\tCarousel\tTeaser: something pink is coming\thttps://www.instagram.com/p/CCCCCCCCCC3/\t8000\t7000\t100\t5\t10\t5\t20\t2\tYes`;
const P = E.mapPosts(E.parseTable(postsTSV));
assert.equal(P.errors.length, 0, P.errors.join());
assert.equal(P.posts.length, 3);
assert.equal(P.posts[1].collab, true);
assert.equal(P.posts[0].snap.views, 229120);

const adsCSV = `Ad name,Campaign name,Ad set name,Amount spent (HKD),Views,Impressions,Reach,Instagram follows,Reporting starts,Reporting ends
US Open day one courtside fit check,Event Boost,AS1,"7,800",150000,200000,90000,40,2026-10-02,2026-10-06
US Open day one courtside fit check - Copy,Event Boost,AS1,780,100000,120000,50000,10,2026-10-02,2026-10-06
Teaser: something pink is coming,Teaser,AS2,390,5000,6000,4000,1,2026-09-28,2026-10-06
Some dark post nobody knows,Profile visits,AS3,78,1000,1200,900,0,2026-10-02,2026-10-06`;
const A = E.mapAds(E.parseTable(adsCSV), "ads.csv");
assert.equal(A.errors.length, 0);
assert.equal(A.rows[0].currency, "HKD");
assert.equal(A.rows[0].spend, 7800);

const posts = E.mergePosts({}, P.posts, "2026-10-06");
const db = { posts, imports: { i1: { ...A, id: "i1" } }, reports: {} };
const rep = { id: "e1", type: "event", name: "US Open", start: "2026-10-02", end: "2026-10-05", dataDate: "2026-10-06",
  postIds: ["AAAAAAAAAA1", "BBBBBBBBBB2"], importIds: ["i1"],
  influencers: [{ creator: "@cheri2222", fee: 780, currency: "HKD" }],
  eventCosts: [{ category: "Decor", item: "Balloons", qty: 2, unit: 50, currency: "USD" }] };
const R = E.buildReport(rep, db);
const row = id => R.rows.find(r => r.id === id && !r.adOnly);
// Fit rule: smallest first -> 100k fits (≤229,120), then 150k would make 250k > 229,120 -> separate version
assert.equal(row("AAAAAAAAAA1").paid, 100000);
assert.equal(row("AAAAAAAAAA1").organic, 129120);
assert.ok(R.rows.some(r => r.kind === "separate" && r.paid === 150000));
// Teaser is not in the event list -> extra post row with its IG views
assert.equal(row("CCCCCCCCCC3").kind, "extra");
assert.equal(row("CCCCCCCCCC3").paid, 5000);
assert.ok(R.rows.some(r => r.kind === "adonly" && r.paid === 1000));
// Totals
const T = R.T;
assert.equal(E.r2(T.adSpend), 1160);
assert.equal(T.totalViews, 229120 + 50000 + 8000 + 150000 + 1000);
assert.equal(T.paidViews, 100000 + 150000 + 5000 + 1000);
assert.equal(T.organicViews, T.totalViews - T.paidViews);
assert.equal(E.r2(T.influencerCost), 100);
assert.equal(T.eventCost, 100);
assert.equal(E.r2(T.totalSpend), 1360);
assert.equal(E.r2(T.blendedCPM), E.r2((T.totalSpend / T.totalViews) * 1000));
assert.equal(T.adFollows, 51);
// ER per view
assert.equal(row("AAAAAAAAAA1").er, (3000 + 100 + 400 + 500) / 229120);
for (const r of R.rows) if (r.organic != null) assert.ok(r.organic >= 0);
console.log("flags:", R.flags.map(f => f.level + " " + f.text));
console.log("blended", E.r2(T.blendedCPM), "ads", E.r2(T.adsCPM), "organic", E.r2(T.organicCPM));

// Weekly: ads on an older post become their own row; account target prorated
const wk = { id: "w1", type: "week", start: "2026-10-03", end: "2026-10-09", dataDate: "2026-10-06", importIds: ["i1"],
  account: { views: 9_000_000, viewsPrev: 8_000_000, interactions: 150000, interactionsPrev: 160000 } };
const W = E.buildReport(wk, db);
assert.equal(W.T.posts, 2);
assert.ok(W.rows.some(r => r.kind === "older"));
assert.ok(Math.abs(W.account.weekTarget - 40e6 * 7 / 30.4375) < 1);
const prev = E.buildReport({ ...wk, id: "w0", start: "2026-09-26", end: "2026-10-02" }, db);
const C = E.compareReports(W, prev);
assert.equal(C.find(c => c.name === "Account views").status, "🟢");
assert.ok(E.rundownPrompt(W, prev).includes("WEEKLY SOCIAL REPORT"));

// Impressions-only export is refused
const bad = E.mapAds(E.parseTable("Ad name,Amount spent (USD),Impressions\nx,10,1000"), "b.csv");
assert.ok(bad.errors[0].includes("Impressions"));
// Helpers
assert.equal(E.num("1.2K"), 1200); assert.equal(E.num("HK$1,234.50"), 1234.5); assert.equal(E.num("12%"), 0.12);
assert.equal(E.toDate("Oct 2, 2026"), "2026-10-02"); assert.equal(E.toDate("25/10/2026"), "2026-10-25");
assert.equal(E.shortcode("https://www.instagram.com/reel/Dd_UGgDuaUw/?igsh=x"), "Dd_UGgDuaUw");
console.log("all tests passed");
// An empty earlier report compares as "no data", and rates keep their format
const empty = E.buildReport({ id: "w9", type: "week", start: "2026-01-05", end: "2026-01-11", importIds: [] }, db);
const C2 = E.compareReports(W, empty);
assert.equal(C2.find(c => c.name === "Post views").prev, null);
assert.equal(C2.find(c => c.name === "Eng. rate (per view)").rate, true);
console.log("compare tests passed");

// ── invoices ──
const model = E.readInvoice(`INVOICE
From: Jane Lee Modelling
Bill to: Hello Nancy
Invoice No: INV-0042
Date: 3 Oct 2026
Model day rate - US Open shoot, usage rights 6 months   HK$ 6,000.00
Subtotal HK$ 6,000.00
Total due HK$ 6,000.00`, "jane-invoice.pdf");
assert.equal(model.type, "influencer");
assert.equal(model.amount, 6000);
assert.equal(model.currency, "HKD");
assert.equal(model.date, "2026-10-03");
assert.equal(model.invoiceNo, "INV-0042");
assert.match(model.vendor, /Jane Lee/);

const crew = E.readInvoice(`Northside Studios LLC
Invoice # 2207
Invoice date: 09/01/2026
Videographer - 2 days  $2,400.00
Lighting equipment rental  $600.00
Subtotal $3,000.00
Sales tax $266.25
Total $3,266.25`, "northside.pdf");
assert.equal(crew.type, "event");
assert.equal(crew.category, "Venue & production");
assert.equal(crew.amount, 3266.25);
assert.equal(crew.vendor, "Northside Studios LLC");
assert.equal(crew.item, "Videographer - 2 days");
assert.match(model.item, /usage rights 6 months$/);

const hotel = E.readInvoice(`Hyatt Ziva Cancun\nGuest folio\n3 nights room\nTotal MXN 18,750.00`, "folio.jpg");
assert.equal(hotel.category, "Hotel / accommodation");
assert.equal(hotel.currency, "MXN");
assert.equal(hotel.amount, 18750);
assert.equal(E.readInvoice("Paid US$ 120.00 total").currency, "USD");

const rows = E.mapInvoiceRows(E.parseTable("Payee\tDescription\tAmount\tCurrency\tDate\n@sunnyday\t1 reel + 3 stories\t9000\tMXN\t2026-10-01\nFedEx\tShipping samples\t85.20\tUSD\t2026-09-28"));
assert.equal(rows[0].type, "influencer");
assert.equal(rows[1].type, "event");
assert.equal(rows[1].category, "General logistics");
const line = E.invoiceToLine(rows[0]);
assert.equal(line.list, "influencers");
assert.equal(line.line.fee, 9000);
assert.ok(E.isDuplicate(rows[0], { influencers: [line.line] }));

// costing report feeds the event report
const costRep = { id: "c1", type: "costing", name: "US Open costs", influencers: [{ creator: "@cheri2222", fee: 780, currency: "HKD" }], eventCosts: [{ category: "Decor", item: "Balloons", qty: 2, unit: 50, currency: "USD" }] };
const db2 = { ...db, reports: { c1: costRep } };
const linked = E.buildReport({ ...rep, influencers: [], eventCosts: [], costingId: "c1" }, db2);
assert.equal(E.r2(linked.T.nonAd), 200);
const CR = E.buildCosting(costRep, { ...db2, reports: { c1: costRep, e1: { ...rep, costingId: "c1" } } });
assert.equal(E.r2(CR.T.total), 200);
assert.equal(CR.event.id, "e1");
assert.ok(E.insights([R, W, prev]).length > 0);
console.log("invoice + costing tests passed");

// ── importing the team's weekly report sheet (27 Sep – 3 Oct 2026) ──
import { readFileSync } from "node:fs";
const S = E.parseReportSheet(readFileSync(new URL("./fixture-weekly-sheet.csv", import.meta.url), "utf8"));
assert.deepEqual(S.range, { start: "2026-09-27", end: "2026-10-03" });
assert.equal(S.pulled, "2026-10-06");
assert.equal(S.type, "week");
assert.equal(S.posts.length, 13);
assert.equal(S.posts.find(p => p.id === "Dd_UGgDuaUw").collab, true);
assert.equal(S.ads.length, 1);
assert.equal(S.ads[0].views, 101);
assert.equal(S.account.views, 1181247);
assert.equal(S.account.viewsPrev, 2588630);
assert.equal(S.account.interactions, 4527);
assert.equal(S.account.interactionsPrev, 17587);
assert.equal(E.r2(S.account.followersPct * 100), 2.8);
assert.equal(S.account.netFollowers, undefined);
// the report built from it matches the sheet's own totals
const sdb = { posts: E.mergePosts({}, S.posts, S.pulled), imports: { s1: { id: "s1", name: "sheet", rows: S.ads.map((a, i) => ({ ...a, i })), level: "ad", hasViews: true, hasFollows: false } }, reports: {} };
const SR = E.buildReport({ id: "ws", type: "week", ...S.range, dataDate: S.pulled, importIds: ["s1"], account: S.account }, sdb);
assert.equal(SR.T.postViews, 273484);
assert.equal(SR.T.paidViews, 101);
assert.equal(SR.T.interactions, 7065);
assert.equal(E.r2(SR.T.er * 100), 2.58);
assert.equal(E.r2(SR.T.adsCPM), 53.37);
console.log("sheet import tests passed");
