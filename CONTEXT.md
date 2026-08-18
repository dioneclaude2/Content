# Crew Reference Site — where we are

**Read this first if you are picking the project up cold.** It covers what the
thing is, what has been decided and why, what exists today, and what is
blocking. Last updated 18 Aug 2026.

---

## 1. What this is

A dark, lookbook-style reference site for the production crew — videographers,
photographers, editors — replacing a spreadsheet that is painful to open on set.

- **Crew view** — public, read-only, no login. What people pull up on a phone
  during a shoot.
- **Admin view** — passcode-gated editor. Not real user accounts.

### The actual problem

Not "we don't have references." Marketing legitimately keeps several creative
directions alive while planning, and **nobody on set or in the edit knows which
one is the call for a given shot.** So the site is a *decision layer*:

- `Selected` vs `Option` on every reference tile.
- A one-line **Direction note** per group — the sentence that ends an on-set
  argument in five seconds.
- A pinned direction line on the event page, visible in every view.
- Those same flags are what an editor sees weeks later, so the call outlives
  the shoot and the Slack thread.

---

## 2. Where things live

| What | Where |
|---|---|
| Repo | `dioneclaude2/content` |
| Working branch | `claude/context-file-brainstorm-epn8fv` |
| Prototype (source of truth for design) | `public/index.html` |
| Supabase schema, ready to run | `supabase/schema.sql` |
| Live prototype | Vercel — see deployment section below |
| Shared preview | Artifact: `https://claude.ai/code/artifact/9cd5e39f-4c3c-46c3-9438-5c5e021faac4` |

### Google Drive references

| Item | ID |
|---|---|
| `NUDE PROJECT — Ibiza Content Timeline` (moodboard root) | `138JHF--_3UF-4eohCWG5SrjOcu7UBEsh` |
| ├─ `2k24` | `1AfApNLo2Qa-xrilaqSt09sHyw5m6VYWE` |
| ├─ `2k25` | `1TiVRA9k67httRsh1DqpzFjMfRxUFwIN2` |
| └─ `2k26` | `10uvMNbwMwmfrU-65QC5PvM6mxZb3vGvy` |
| `Sept2026-Cancun` (invite assets, 4 files) | `1Osur4hI1lInZ0AsQQOagbUuCjQyKwlkE` |
| `NancyVilla-CreatorsTrip-Cancun` (planning sheet) | `1GdrIF-j4hPX5l8KGz57gM0ckaUNYA5v5KFBSUbjDIRI` |

> **The planning sheet contains budgets, fees and guest details. None of it may
> reach the crew site, which is public and has no login.** Only the run of show
> and the references belong there.

---

## 3. Decisions locked in

**Media is embedded from Google Drive, never copied into our own storage.**
Supabase holds links, labels and decisions only. Two consequences:

- *Automatic shot breakdown is off the table.* An embedded Drive player is a
  sealed window; nothing can reach its frames. Shot breakdowns are marked up by
  hand — scrub, note the timecode, flag the key beats.
- *Palette stays automatic.* Sampling colour needs one read of a Drive
  thumbnail at import, after which six hex strings are stored. Text, not files.
  This does not violate the embed-only rule.

**The page is action-first, in three modes.** Crew land on the schedule, not
on pictures.

| Tab | Holds |
|---|---|
| Run of Show | Quick links, time-coded schedule, VO script, deliverables |
| Content | One piece at a time: player → shot breakdown → palette |
| Visuals | Moodboard timeline, environment, b-roll, flow reference |

The bridge between them is per-row: every shot list row has a `refs` button
that unfolds that row's thumbnails inline, so you never leave the schedule to
see what a shot should look like.

**The UI is strictly black, white and grey. All colour comes from the media.**
This follows the supplied moodboard deck. Pure black ground, Archivo bold caps,
italic subtitles, square corners, bracketed captions, `→` connectors where
order is real.

**Selected reads as brightness, not colour.** Selected tiles sit at full
brightness with a white rule and a `SELECTED` flag; Options dim to 42% and
brighten on hover. Range stays visible, the call is unmissable.

**Numbering is fixed to admin order** even though Selected tiles sort to the
front — so "shot 04" means the same thing to everyone on the radio. The
moodboard is the exception: files are named by date, so the date is the label.

---

## 4. Folder import — the rule

Admins paste one **folder** link, not forty file links. The tree decides the
layout:

```
NUDE PROJECT — Ibiza Content Timeline/   ← inspo source
└── 2k25/                                ← year
    ├── 08 Mar 25.mp4                    ← a FILE = a reel
    ├── 14 Jul 25.mp4                    ← a FILE = a reel
    └── 25 Jun 25/                       ← a FOLDER = a carousel
        ├── 01.jpg                           its files = slides, in order
        └── ...
```

Nothing needs labelling by hand. Order comes from the folder, the label comes
from the filename date.

The importer must call the Drive API with `includeItemsFromAllDrives=true` and
`supportsAllDrives=true`, or shared-drive contents come back empty.

A **Re-sync** action re-reads a folder, adds new files, and preserves the
`Selected` flags and Direction notes already set.

---

## 5. Cancún — what we actually know

Cancún is the pilot event. It is **not** a one-day shoot like the Hong Kong
sheet the original spec was based on.

- **Sept 9–12 2026**, a four-day creator trip, plus setup days Sept 6–8.
- Villas: Playacar Vista Estate (main hero villa), Casa Nikki, Villa Kin Ich.
- Roughly 50–62 guests.
- The sheet runs **two parallel tracks on one clock** — a public guest agenda
  and a separate crew shooting schedule. That is the real structure, not
  crew-vs-crew blocks.
- Golden hour guidance: start photography around 4:30PM, sunset 5:55PM.
- Sept 7 is *"Nancy Team Shooting Day (Clean Shot of Venue & Location Shoot)"* —
  but its hour grid is empty.

### What Cancún does NOT have yet

No crew shot list, no deliverables list, no VO script, no per-shot references.
The moodboard folders exist but their contents are not readable yet (see
blockers). **Most sections will render as empty states until someone fills them
in.** That is a content gap, not a build gap.

---

## 6. Current state of the prototype

`public/index.html` is a single self-contained file. No build step. Open it in
a browser or serve the `public/` directory.

Verified in headless Chromium: all three tabs render, carousel slides page
through the lightbox, no runtime errors.

**Real:** the moodboard structure (source → year → reels/carousels), the
Cancún dates and villa names, the folder-import rule, all layout and interaction.

**Placeholder:** every image (grey gradient blocks), the moodboard dates and
counts, the run-of-show rows, the palette hex values, the VO lines, the
deliverables. Placeholders are labelled as such on the page.

> Note: the shared Artifact preview **cannot load Drive images** — its sandbox
> blocks external hosts. The Vercel deployment can. Judge media there.

---

## 7. Blockers

1. **Drive folder contents are not readable.** The moodboard folders were
   created 18 Aug 08:25 and are absent from Google's *search* index — fetching
   any of them by ID works, listing their children returns nothing. Not a
   permissions problem, and it does not affect the finished site, which queries
   Drive directly. Fix: wait for indexing, screenshot the folder, or have the
   owner copy it so fresh records are created.
   *Needed to replace placeholder dates, counts and palettes with real ones.*

2. **Supabase project does not exist yet.** No Supabase tooling was available
   in the session that wrote this. `supabase/schema.sql` is ready to paste into
   the SQL editor of a new project. After that, set `SUPABASE_URL`,
   `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel.

3. **Open question — is the crew view really public?** Slugs like `/cancun` are
   guessable and the schedule carries guest counts and villa detail. Decide
   between a guessable slug and an unlisted random one.

4. **Open question — `pose_reference` and `notes`** from the original spec have
   no home in the UI. Fold in or drop.

---

## 8. Next steps, in order

1. Unblock the Drive folders; import `2k24` for real. One year proves the
   importer; the other two follow identically.
2. Create the Supabase project and run `supabase/schema.sql`.
3. Scaffold Next.js + Tailwind and port `public/index.html` into components.
   The design is settled — this is a translation job, not a design job.
4. Build the Drive folder importer and the link → embed utility:
   - thumbnail: `https://drive.google.com/thumbnail?id=FILE_ID&sz=w500`
   - full view: `https://drive.google.com/file/d/FILE_ID/preview`
5. Build `/admin`: passcode gate, then CRUD over the tables above.
6. Rebuild Run of Show for multiple days and two tracks, using the real
   Sept 9–12 content.
7. Seed the other five events.

### Known risk to design around

Drive throttles `drive.google.com/thumbnail` under burst load, and with
embed-only there is no mirror to fall back on. Lazy-load tiles and load one
year at a time rather than all three at once.
