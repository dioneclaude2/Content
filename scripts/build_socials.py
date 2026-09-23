#!/usr/bin/env python3
"""Build the Nancy Socials moments dataset and calendar feed.

    python3 scripts/build_socials.py

Writes public/nancy-socials/moments.json (read by the site, and later by the
Slack jobs) and public/nancy-socials/nancy-socials.ics (import or subscribe in
any calendar app). Edit the MOMENTS list below, then re-run.

Each moment gets its date one of three ways:
  md     "MM-DD"            same day every year
  nth    (month, weekday, n) e.g. (5, 6, 2) = 2nd Sunday of May; n=-1 = last
  dates  {2026: "YYYY-MM-DD", 2027: ...}  moving dates, looked up per year
Month-long moments use md "MM-01" plus span="month".
"""
import calendar, datetime as dt, json, pathlib, re

START, END = dt.date(2026, 9, 1), dt.date(2027, 12, 31)
YEARS = (2026, 2027)
OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "nancy-socials"

# layer: intimacy | identity | holiday | retail | culture | industry
# tier:  tentpole | strong | minor
# tone:  go (lean in) | care (tread carefully: no hard sell)
# hooks: optional per-platform starters, x / yt / ig / tt
MOMENTS = [
    # ─── Intimacy & sexual wellness ─────────────────────────────────────
    dict(name="Sexual Health Awareness Month", md="09-01", span="month", layer="intimacy", region="Global", tier="strong", tone="go",
         angle="A month of myth-busting: pleasure is health. Educator collabs, FAQ series, product care 101.",
         hooks=dict(x="Pleasure is part of health. Not a bonus round.", yt="Short: 5 sexual-health myths your sex-ed teacher got wrong", ig="Carousel: 'things nobody told you about pleasure' — swipe to learn", tt="Stitch a myth, debunk it in 10 seconds")),
    dict(name="World Sexual Health Day", md="09-04", layer="intimacy", region="Global", tier="strong", tone="go",
         angle="WAS-backed global day. Lead with education and access, product as a supporting role.",
         hooks=dict(x="Today is World Sexual Health Day. What's one thing you wish you'd learned sooner?", ig="Reel: an educator answers your anonymous questions", tt="Q&A format with a sex educator", yt="Short: the 60-second sexual health checklist")),
    dict(name="Bi Visibility Day", md="09-23", layer="identity", region="Global", tier="strong", tone="go",
         angle="Celebrate bi community voices. Amplify creators, not the product.",
         hooks=dict(x="Happy Bi Visibility Day to everyone who's been told to 'pick one' 💗💜💙", ig="Feature 3 bi creators in a collab carousel", tt="Duet bi creators' 'things people say to me' videos")),
    dict(name="World Contraception Day", md="09-26", layer="intimacy", region="Global", tier="minor", tone="go",
         angle="Education-first: know your options. Partner with a clinic or educator."),
    dict(name="World Menopause Day", md="10-18", layer="intimacy", region="Global", tier="strong", tone="go",
         angle="Menopause Awareness Month peak. Pleasure doesn't retire: lube, arousal changes, real voices 45+.",
         hooks=dict(x="Pleasure doesn't have an expiry date.", ig="Interview carousel: 'what changed, what got better' from women 45+", tt="Green-screen myth vs fact on menopause & desire", yt="Long-form: a gynecologist on desire through menopause")),
    dict(name="Menopause Awareness Month", md="10-01", span="month", layer="intimacy", region="Global", tier="minor", tone="go",
         angle="Month-long series building to World Menopause Day (18 Oct)."),
    dict(name="No Nut November", md="11-01", span="month", layer="culture", region="Global", tier="strong", tone="go",
         angle="Meme month. Playful counter-programming: 'self-love November', edging jokes, solo care.",
         hooks=dict(x="No Nut November? We prefer Self-Care November.", tt="POV: day 1 of No Nut November and the package just arrived", ig="Meme dump carousel", yt="Short: we asked people on the street about No Nut November")),
    dict(name="Movember", md="11-01", span="month", layer="intimacy", region="Global", tier="minor", tone="go",
         angle="Men's health month. Prostate health, men's pleasure products, open conversations."),
    dict(name="International Men's Day", md="11-19", layer="intimacy", region="Global", tier="minor", tone="go",
         angle="Men's pleasure and emotional intimacy. Soft tone."),
    dict(name="Global Orgasm Day", dates={2026: "2026-12-21", 2027: "2027-12-22"}, layer="intimacy", region="Global", tier="minor", tone="go",
         angle="Solstice 'Global Orgasm for Peace'. Quirky, niche — good for X and TikTok humor."),
    dict(name="World AIDS Day", md="12-01", layer="intimacy", region="Global", tier="strong", tone="care",
         angle="Awareness only. Red ribbon, testing resources, donate/partner. No product selling today."),
    dict(name="National Bubble Bath Day", md="01-08", layer="intimacy", region="US", tier="minor", tone="go",
         angle="Self-care night-in content; waterproof toys, bath rituals."),
    dict(name="Cervical Health Awareness Month", md="01-01", span="month", layer="intimacy", region="US", tier="minor", tone="care",
         angle="Screening reminders and education."),
    dict(name="Sexual & Reproductive Health Awareness Day", md="02-12", layer="intimacy", region="US", tier="minor", tone="go",
         angle="Education lead-in to Valentine's week."),
    dict(name="International Condom Day", md="02-13", layer="intimacy", region="Global", tier="minor", tone="go",
         angle="Safer sex is sexy. Bundle ideas with lube/condoms."),
    dict(name="National Condom Week", md="02-14", layer="intimacy", region="US", tier="minor", tone="go",
         angle="Runs 14–21 Feb. Safer-sex education, pairs with Valentine's."),
    dict(name="Endometriosis Awareness Month", md="03-01", span="month", layer="intimacy", region="Global", tier="minor", tone="care",
         angle="Painful sex is common and not your fault. Educator-led, gentle."),
    dict(name="STI Awareness Month", md="04-01", span="month", layer="intimacy", region="US", tier="strong", tone="go",
         angle="Get tested, destigmatize. Toy hygiene & cleaning content fits here.",
         hooks=dict(x="Get tested. Clean your toys. Tell your friends.", ig="Carousel: 'how to clean every type of toy'", tt="Toy-cleaning ASMR", yt="Short: 3 things to know before your first STI test")),
    dict(name="Sexual Assault Awareness Month", md="04-01", span="month", layer="intimacy", region="US", tier="minor", tone="care",
         angle="Consent education and resources only. Never tie to promotions."),
    dict(name="National Lingerie Day", md="04-24", layer="intimacy", region="US", tier="minor", tone="go",
         angle="Confidence & dressing for yourself. Styling collab."),
    dict(name="International Clitoris Awareness Week", dates={2027: "2027-05-02"}, layer="intimacy", region="Global", tier="strong", tone="go", verified=False,
         angle="First full week of May (Clitoraid). Anatomy education, pleasure gap stats, 3D clitoris visuals.",
         hooks=dict(x="Fun fact: the clitoris has ~10,000 nerve endings. You're welcome.", ig="Carousel: clit anatomy 101 with illustrations", tt="'Things I learned about the clitoris at 30'", yt="Short: the clitoris is way bigger than you think")),
    dict(name="Masturbation May", md="05-01", span="month", layer="intimacy", region="Global", tier="tentpole", tone="go",
         angle="THE month for this brand. Daily series, solo-play guides, bundles, creator challenges.",
         hooks=dict(x="It's Masturbation May. Clear your calendar accordingly.", ig="31-day self-love calendar carousel + weekly Reels", tt="Launch a 'self-date night' trend", yt="Long-form: the beginner's guide to solo play")),
    dict(name="Menstrual Hygiene Day", md="05-28", layer="intimacy", region="Global", tier="minor", tone="go",
         angle="Period sex, cramp relief, and cycle-aware pleasure. Shares the day with Intl Masturbation Day."),
    dict(name="International Masturbation Day", md="05-28", layer="intimacy", region="Global", tier="tentpole", tone="go",
         angle="Peak of Masturbation May. Hero drop, biggest promo of spring.",
         hooks=dict(x="Happy International Masturbation Day. Treat yourself. Literally.", ig="Hero Reel + limited bundle", tt="Creator takeover", yt="Short: 5 health benefits of masturbation")),
    dict(name="69 Day (National Sex Day)", md="06-09", layer="intimacy", region="Global", tier="strong", tone="go",
         angle="6/9. Cheeky meme day. Couples toys, playful copy.",
         hooks=dict(x="It's 6/9. You know what to do.", tt="Numbers-joke trend format", ig="Couples' bundle drop")),
    dict(name="International Kissing Day", md="07-06", layer="intimacy", region="Global", tier="minor", tone="go",
         angle="Romance & foreplay tips. Light, sweet, shareable."),
    dict(name="National Nude Day", md="07-14", layer="intimacy", region="US", tier="minor", tone="care",
         angle="Body confidence. Mind nudity rules on every platform: no skin, use illustration/text."),
    dict(name="National Orgasm Day", md="07-31", layer="intimacy", region="Global", tier="tentpole", tone="go",
         angle="Summer tentpole. Orgasm gap stats, 'types of orgasm' education, flash sale.",
         hooks=dict(x="Happy National Orgasm Day. Hope you're celebrating properly.", ig="Carousel: 'the orgasm gap, explained'", tt="Reaction format: guessing orgasm facts", yt="Long-form: why the orgasm gap exists")),
    dict(name="National Romance Awareness Month", md="08-01", span="month", layer="intimacy", region="US", tier="minor", tone="go",
         angle="Date-night series, couples content."),
    dict(name="National Underwear Day", md="08-05", layer="intimacy", region="US", tier="minor", tone="go",
         angle="Wearable toys, playful fashion tie-in."),
    dict(name="International Female Orgasm Day", md="08-08", layer="intimacy", region="Global", tier="tentpole", tone="go",
         angle="Pleasure-gap storytelling, women's voices, strongest-performing product push.",
         hooks=dict(x="Today is International Female Orgasm Day. Say it louder for the people in the back.", ig="UGC carousel: 'the first time I…' (anonymous)", tt="Street interviews on the orgasm gap", yt="Short: 3 stats about women's pleasure that will shock you")),
    dict(name="National Kiss and Make Up Day", md="08-25", layer="intimacy", region="US", tier="minor", tone="go",
         angle="Make-up sex jokes, couples communication tips."),

    # ─── Identity & LGBTQ+ ───────────────────────────────────────────────
    dict(name="LGBTQ+ History Month (US)", md="10-01", span="month", layer="identity", region="US", tier="minor", tone="go",
         angle="Queer history of pleasure: sex-positive pioneers, the queer-owned shop legacy."),
    dict(name="National Coming Out Day", md="10-11", layer="identity", region="US", tier="strong", tone="go",
         angle="Amplify community stories. No product in the lead image."),
    dict(name="International Pronouns Day", nth=(10, 2, 3), layer="identity", region="Global", tier="minor", tone="go",
         angle="3rd Wednesday of October. Inclusive language check on product copy."),
    dict(name="Intersex Awareness Day", md="10-26", layer="identity", region="Global", tier="minor", tone="care",
         angle="Awareness only; amplify intersex voices."),
    dict(name="Transgender Awareness Week", md="11-13", layer="identity", region="Global", tier="minor", tone="go",
         angle="13–19 Nov. Trans-inclusive product education (gender-neutral toys, language)."),
    dict(name="Trans Day of Remembrance", md="11-20", layer="identity", region="Global", tier="strong", tone="care",
         angle="Memorial day. Silence or a respectful post only. Pause all promo."),
    dict(name="Trans Day of Visibility", md="03-31", layer="identity", region="Global", tier="strong", tone="go",
         angle="Celebration day. Feature trans creators and paid collabs."),
    dict(name="Lesbian Visibility Day", md="04-26", layer="identity", region="Global", tier="minor", tone="go",
         angle="Sapphic creators, lesbian-focused product education."),
    dict(name="IDAHOBIT", md="05-17", layer="identity", region="Global", tier="minor", tone="care",
         angle="International Day Against Homophobia, Biphobia & Transphobia. Advocacy, not sales."),
    dict(name="Pansexual Visibility Day", md="05-24", layer="identity", region="Global", tier="minor", tone="go",
         angle="Community spotlight."),
    dict(name="Pride Month", md="06-01", span="month", layer="identity", region="Global", tier="tentpole", tone="go",
         angle="Only if the brand gives back: donation %, queer-created campaign, year-round receipts. Avoid rainbow-washing.",
         hooks=dict(x="Pride is a protest and a party. We're donating X% all month to [org].", ig="Queer creator campaign + giveback receipts", tt="Creator-led 'what pleasure means to me'", yt="Mini-doc: queer pleasure history")),
    dict(name="NYC Pride March", nth=(6, 6, -1), layer="identity", region="US", tier="strong", tone="go",
         angle="Last Sunday of June. On-the-ground content, float or activation if possible."),
    dict(name="International Non-Binary People's Day", md="07-14", layer="identity", region="Global", tier="minor", tone="go",
         angle="Gender-neutral product language and design."),

    # ─── Holidays (US) ───────────────────────────────────────────────────
    dict(name="Halloween", md="10-31", layer="holiday", region="Global", tier="strong", tone="go",
         angle="Spooky-sexy: costume energy, 'treats' puns, dark packaging drop.",
         hooks=dict(x="Trick or treat yourself.", ig="Product 'costumes' carousel", tt="Spooky ASMR unboxing", yt="Short: rating couples' costumes")),
    dict(name="Day of the Dead", md="11-01", layer="holiday", region="LATAM", tier="minor", tone="care",
         angle="Cultural/religious. Skip or honor respectfully; no product puns."),
    dict(name="Daylight saving ends (US) — extra hour", nth=(11, 6, 1), layer="culture", region="US", tier="minor", tone="go",
         angle="'What will you do with your extra hour?' Easy, cheeky post."),
    dict(name="Veterans Day", md="11-11", layer="holiday", region="US", tier="minor", tone="care",
         angle="Same day as Singles Day; keep US posts respectful."),
    dict(name="Thanksgiving (US)", nth=(11, 3, 4), layer="holiday", region="US", tier="strong", tone="go",
         angle="Gratitude / 'thankful for' humor; BFCM teaser."),
    dict(name="Christmas Eve", md="12-24", layer="holiday", region="Global", tier="strong", tone="go",
         angle="Last-minute digital gift cards; 'stocking stuffer' humor."),
    dict(name="Christmas Day", md="12-25", layer="holiday", region="Global", tier="strong", tone="go",
         angle="Light, cozy post. 'Unwrap something nice' puns."),
    dict(name="New Year's Eve", md="12-31", layer="holiday", region="Global", tier="strong", tone="go",
         angle="Midnight kiss, 'new year same me', resolutions humor."),
    dict(name="New Year's Day", md="01-01", layer="holiday", region="Global", tier="minor", tone="go",
         angle="'New year, new O' resolutions content."),
    dict(name="Dry January", md="01-01", span="month", layer="culture", region="Global", tier="minor", tone="go",
         angle="'Dry January, wet everything else' (lube angle)."),
    dict(name="Blue Monday", nth=(1, 0, 3), layer="culture", region="UK", tier="minor", tone="go",
         angle="'Most depressing day' — self-care & mood-boost angle."),
    dict(name="Black History Month (US)", md="02-01", span="month", layer="holiday", region="US", tier="minor", tone="care",
         angle="Amplify Black sex educators and founders; pay creators; no promo tie-ins."),
    dict(name="Galentine's Day", md="02-13", layer="holiday", region="US", tier="strong", tone="go",
         angle="Friends' self-love gifting, girls' night content.",
         hooks=dict(x="Galentine's gift idea: something she'll thank you for later.", ig="'Gifts for your bestie' carousel", tt="Unboxing with friends")),
    dict(name="Valentine's Day", md="02-14", layer="holiday", region="Global", tier="tentpole", tone="go",
         angle="Biggest gifting moment of the year. Shipping-cutoff countdown, couples & solo angles, gift guides.",
         hooks=dict(x="Valentine's Day: for couples, singles, and the situationship.", ig="Gift guide carousel by relationship status", tt="'Rating Valentine's gifts' trend", yt="Long-form: gift guide for every relationship status")),
    dict(name="Singles Awareness Day", md="02-15", layer="holiday", region="US", tier="minor", tone="go",
         angle="Solo celebration, post-Valentine's discount."),
    dict(name="Women's History Month", md="03-01", span="month", layer="holiday", region="Global", tier="minor", tone="go",
         angle="Women who changed sexual health history."),
    dict(name="International Women's Day", md="03-08", layer="holiday", region="Global", tier="strong", tone="go",
         angle="Women founders/team, pleasure equity. Avoid pinkwashing — tie to action.",
         hooks=dict(x="Pleasure equity is a women's issue.", ig="Team spotlight carousel", tt="Founders/team 'day in the life'")),
    dict(name="April Fools' Day", md="04-01", layer="culture", region="Global", tier="minor", tone="go",
         angle="Fake product launch prank (be ready to make it real if it pops)."),
    dict(name="Father's Day (US)", nth=(6, 6, 3), layer="holiday", region="US", tier="minor", tone="care",
         angle="Mostly skip; maybe 'gift for your partner who's a dad' in couples framing."),
    dict(name="Juneteenth", md="06-19", layer="holiday", region="US", tier="minor", tone="care",
         angle="Honor, don't sell."),
    dict(name="Independence Day (US)", md="07-04", layer="holiday", region="US", tier="minor", tone="go",
         angle="Fireworks puns, summer sale."),
    dict(name="Labor Day (US)", nth=(9, 0, 1), layer="holiday", region="US", tier="minor", tone="go",
         angle="End-of-summer sale."),

    # ─── Global holidays ─────────────────────────────────────────────────
    dict(name="Thanksgiving (Canada)", nth=(10, 0, 2), layer="holiday", region="Global", tier="minor", tone="go",
         angle="CA audience only."),
    dict(name="Bonfire Night (UK)", md="11-05", layer="holiday", region="UK", tier="minor", tone="go",
         angle="Fireworks puns for UK audience."),
    dict(name="Singles Day (11.11)", md="11-11", layer="retail", region="APAC", tier="tentpole", tone="go",
         angle="World's biggest shopping day. Self-love sale; perfect brand fit globally.",
         hooks=dict(x="11.11 is Singles Day. Treat yourself like the main character.", ig="Countdown Stories + solo bundle", tt="'Single and thriving' trend", yt="Short: what to buy yourself on Singles Day")),
    dict(name="Boxing Day", md="12-26", layer="retail", region="UK", tier="strong", tone="go",
         angle="UK/CA/AU sale day."),
    dict(name="White Day", md="03-14", layer="holiday", region="APAC", tier="minor", tone="go",
         angle="Japan/Korea return-gift day, a month after Valentine's."),
    dict(name="Dia dos Namorados (Brazil)", md="06-12", layer="holiday", region="LATAM", tier="strong", tone="go",
         angle="Brazil's Valentine's Day. Big for LATAM audience."),
    dict(name="Tanabata", md="07-07", layer="holiday", region="APAC", tier="minor", tone="go",
         angle="Japan's star-crossed lovers festival."),
    dict(name="Mothering Sunday (UK)", dates={2027: "2027-03-07"}, layer="holiday", region="UK", tier="minor", tone="care",
         angle="Skip product; brand-safe acknowledgement at most."),
    dict(name="Mother's Day (US)", nth=(5, 6, 2), layer="holiday", region="US", tier="minor", tone="care",
         angle="Mostly skip. If anything: 'moms deserve pleasure too', no gifting-from-kids framing."),

    # ─── Retail ──────────────────────────────────────────────────────────
    dict(name="Black Friday", nth=(11, 3, 4), offset=1, layer="retail", region="Global", tier="tentpole", tone="go",
         angle="Biggest sales week. Early-access list, doorbusters, bundles.",
         hooks=dict(x="Black Friday is live. Your cart is waiting.", ig="Countdown Stories, launch Reel", tt="Sale announcement trend", yt="Short: Black Friday picks under $50")),
    dict(name="Small Business Saturday", nth=(11, 3, 4), offset=2, layer="retail", region="US", tier="minor", tone="go",
         angle="Shout out indie sex shops that stock us."),
    dict(name="Cyber Monday", nth=(11, 3, 4), offset=4, layer="retail", region="Global", tier="tentpole", tone="go",
         angle="Online-only deals; last call for BFCM.",
         hooks=dict(x="Cyber Monday: last call. No shame, just savings.", ig="Last-chance Stories", tt="'Adding to cart' trend")),
    dict(name="Giving Tuesday", nth=(11, 3, 4), offset=5, layer="retail", region="US", tier="minor", tone="go",
         angle="Donate % to a sexual health/LGBTQ+ nonprofit."),
    dict(name="Green Monday", nth=(12, 0, 2), layer="retail", region="US", tier="minor", tone="go",
         angle="Mid-December last shipping push."),
    dict(name="Valentine's shipping cutoff (approx.)", md="02-08", layer="retail", region="US", tier="strong", tone="go",
         angle="Order-by reminder. Confirm exact cutoff with ops."),
    dict(name="Holiday shipping cutoff (approx.)", md="12-17", layer="retail", region="US", tier="strong", tone="go",
         angle="Order-by-for-Christmas reminder. Confirm exact cutoff with ops."),
    dict(name="12.12 sale", md="12-12", layer="retail", region="APAC", tier="minor", tone="go",
         angle="APAC double-12 sale day."),

    # ─── Culture ─────────────────────────────────────────────────────────
    dict(name="Cuffing season kicks off", md="10-01", layer="culture", region="Global", tier="minor", tone="go",
         angle="Oct–Feb dating memes, couples-starter content."),
    dict(name="Daylight saving starts (US) — lose an hour", nth=(3, 6, 2), layer="culture", region="US", tier="minor", tone="go",
         angle="'Make the hour you lost count'."),
    dict(name="Hot Girl Summer kickoff", md="06-21", layer="culture", region="Global", tier="minor", tone="go",
         angle="Summer solstice, summer-vibe product edits."),
]

# Moving dates that need a lookup per year. Filled from verified sources.
YEARLY = [
    # Holidays with moving dates
    dict(name="Diwali", dates={2026: "2026-11-08", 2027: "2027-10-29"}, layer="holiday", region="APAC", tier="minor", tone="care",
         angle="Religious festival. Greeting only; no product puns."),
    dict(name="Hanukkah begins", dates={2026: "2026-12-04", 2027: "2027-12-24"}, layer="holiday", region="Global", tier="minor", tone="care",
         angle="Greeting only."),
    dict(name="Lunar New Year", dates={2027: "2027-02-06"}, layer="holiday", region="APAC", tier="minor", tone="care",
         angle="Year of the Goat. Greeting; red-packaging edit at most."),
    dict(name="Ramadan begins (approx.)", dates={2027: "2027-02-08"}, layer="holiday", region="MENA", tier="minor", tone="care",
         angle="Pause or geo-exclude adult content targeting to MENA audiences during Ramadan."),
    dict(name="Eid al-Fitr (approx.)", dates={2027: "2027-03-10"}, layer="holiday", region="MENA", tier="minor", tone="care",
         angle="Greeting only; no product."),
    dict(name="Mardi Gras / Carnival", dates={2027: "2027-02-09"}, layer="holiday", region="LATAM", tier="strong", tone="go",
         angle="Rio Carnival & New Orleans. Color, glitter, party energy."),
    dict(name="Holi", dates={2027: "2027-03-22"}, layer="holiday", region="APAC", tier="minor", tone="care",
         angle="Color festival. Greeting only."),
    dict(name="Easter Sunday", dates={2027: "2027-03-28"}, layer="holiday", region="Global", tier="minor", tone="care",
         angle="Light 'egg' puns only if the brand voice allows; conservative audiences."),
    dict(name="Qixi (Chinese Valentine's Day)", dates={2027: "2027-08-08"}, layer="holiday", region="APAC", tier="strong", tone="go",
         angle="China's Valentine's Day. Same day as Intl Female Orgasm Day in 2027."),
    # Culture with moving dates
    dict(name="Super Bowl LXI", dates={2027: "2027-02-14"}, layer="culture", region="US", tier="strong", tone="go",
         angle="Lands on Valentine's Day in 2027 — 'half-time' and 'score' jokes write themselves."),
    dict(name="Grammy Awards", dates={2027: "2027-02-07"}, layer="culture", region="US", tier="minor", tone="go",
         angle="Live-post red carpet & performances."),
    dict(name="Academy Awards", dates={2027: "2027-03-14"}, layer="culture", region="US", tier="minor", tone="go",
         angle="Live-post, 'best performance' puns."),
    dict(name="Met Gala", nth=(5, 0, 1), layer="culture", region="US", tier="minor", tone="go",
         angle="First Monday of May. Fashion meme reactions."),
    dict(name="Eurovision final", dates={2027: "2027-05-15"}, layer="culture", region="EU", tier="minor", tone="go",
         angle="Camp! Big EU/UK queer audience."),
    dict(name="Amazon Prime Big Deal Days", dates={2026: "2026-10-06"}, layer="retail", region="Global", tier="minor", tone="go",
         angle="6–7 Oct. Competitor sale window; run your own counter-offer."),
    dict(name="Prime Day", dates={2027: "2027-07-13"}, layer="retail", region="Global", tier="minor", tone="go",
         angle="Mid-July competitor sale window.", verified=False),
    dict(name="Ace Week", dates={2026: "2026-10-25"}, layer="identity", region="Global", tier="minor", tone="go",
         angle="Asexual Awareness Week, 25–31 Oct. Intimacy isn't only sex; inclusive framing."),
    dict(name="UK Sexual Health Week (Brook)", dates={2026: "2026-09-14"}, layer="intimacy", region="UK", tier="minor", tone="go",
         angle="14–20 Sep 2026, theme 'Let's Connect'. 2027 dates TBA."),
    dict(name="Grammy nominations", dates={2026: "2026-11-16"}, layer="culture", region="US", tier="minor", tone="go",
         angle="Reaction content."),
    dict(name="Coachella weekend 1", dates={2027: "2027-04-09"}, layer="culture", region="US", tier="minor", tone="go",
         angle="Festival fits, 'festival essentials' edit (weekend 2: 16–18 Apr)."),
    # Industry
    dict(name="eroFame (Amsterdam)", dates={2026: "2026-09-30"}, layer="industry", region="EU", tier="strong", tone="go",
         angle="30 Sep – 2 Oct, Amsterdam RAI. Trade show: competitor launches, BTS content."),
    dict(name="Venus Berlin", dates={2026: "2026-10-22"}, layer="industry", region="EU", tier="minor", tone="go",
         angle="22–25 Oct, Messe Berlin. Watch for competitor drops."),
    dict(name="XBIZ Show (LA)", dates={2027: "2027-01-07"}, layer="industry", region="US", tier="strong", tone="go",
         angle="7–10 Jan. Awards & industry news cycle."),
    dict(name="ANME Founders Show", dates={2027: "2027-01-17"}, layer="industry", region="US", tier="minor", tone="go", verified=False,
         angle="17–19 Jan, Burbank. Retailer/buyer show."),
    dict(name="AVN Expo (Las Vegas)", dates={2027: "2027-01-20"}, layer="industry", region="US", tier="minor", tone="go",
         angle="20–23 Jan. Industry news cycle; mostly monitor, don't post."),
    dict(name="XBIZ Miami", dates={2027: "2027-05-10"}, layer="industry", region="US", tier="minor", tone="go", verified=False,
         angle="10–13 May. Creator/industry conference."),
]


def nth_weekday(year, month, weekday, n):
    days = [d for d in range(1, calendar.monthrange(year, month)[1] + 1)
            if dt.date(year, month, d).weekday() == weekday]
    return dt.date(year, month, days[n] if n < 0 else days[n - 1])


def expand(m):
    out = []
    for y in YEARS:
        if "dates" in m:
            if y not in m["dates"]:
                continue
            d = dt.date.fromisoformat(m["dates"][y])
        elif "nth" in m:
            mo, wd, n = m["nth"]
            d = nth_weekday(y, mo, wd, n)
        else:
            mo, da = map(int, m["md"].split("-"))
            d = dt.date(y, mo, da)
        d += dt.timedelta(days=m.get("offset", 0))
        end = None
        if m.get("span") == "month":
            end = d.replace(day=calendar.monthrange(d.year, d.month)[1])
        if START <= d <= END:
            out.append(dict(
                id=re.sub(r"[^a-z0-9]+", "-", m["name"].lower()).strip("-") + f"-{d.year}",
                date=d.isoformat(), end=end.isoformat() if end else None,
                name=m["name"], layer=m["layer"], region=m["region"], tier=m["tier"],
                tone=m["tone"], angle=m["angle"], hooks=m.get("hooks", {}),
                verified=m.get("verified", True)))
    return out


def ics(moments):
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    esc = lambda s: s.replace("\\", "\\\\").replace(";", r"\;").replace(",", r"\,").replace("\n", r"\n")
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nancy//Socials//EN",
             "X-WR-CALNAME:Nancy Socials", "CALSCALE:GREGORIAN"]
    for m in moments:
        start = dt.date.fromisoformat(m["date"])
        stop = dt.date.fromisoformat(m["end"] or m["date"]) + dt.timedelta(days=1)
        tag = {"tentpole": "★ ", "strong": "", "minor": ""}[m["tier"]]
        lines += ["BEGIN:VEVENT", f"UID:{m['id']}@nancy-socials", f"DTSTAMP:{stamp}",
                  f"DTSTART;VALUE=DATE:{start:%Y%m%d}", f"DTEND;VALUE=DATE:{stop:%Y%m%d}",
                  f"SUMMARY:{esc(tag + m['name'])}",
                  f"DESCRIPTION:{esc(m['angle'] + ' [' + m['layer'] + ' · ' + m['region'] + ' · ' + m['tier'] + ']')}"]
        if m["tier"] != "minor":
            lines += ["BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:-P7D",
                      f"DESCRIPTION:{esc('7 days: ' + m['name'])}", "END:VALARM"]
        lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


if __name__ == "__main__":
    moments = sorted((x for m in MOMENTS + YEARLY for x in expand(m)),
                     key=lambda m: (m["date"], ["tentpole", "strong", "minor"].index(m["tier"])))
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "moments.json").write_text(json.dumps(
        dict(updated=dt.date.today().isoformat(), moments=moments), indent=1, ensure_ascii=False))
    (OUT / "nancy-socials.ics").write_text(ics(moments))
    print(f"{len(moments)} moments → {OUT}")
