/* Monster Mansion Vol 1: giveaway + limited drop research and plan.
   Every number and link comes from the context file (Oct 2026). Don't invent stats. */
const IG = c => `https://www.instagram.com/p/${c}/`;

const LINKS = {
  sheet: "https://docs.google.com/spreadsheets/d/1LBZMoW9N6iDTX7GZY1UKVKA36pVuOovRE26bzCkgA7U/edit",
  brief: "https://nancy-monstermansion.vercel.app",
  grid: "https://nancymonstermansion-grid.vercel.app/",
  adlib: "https://www.facebook.com/ads/library/",
};

const CHART = [
  ["Kylie Cosmetics: National Lipstick Day", true, 142],
  ["e.l.f.: PR-list-for-a-year prize", false, 72],
  ["Crumbl × Kylie Cosmetics", true, 71],
  ["poppi × Subway (Rob Rausch)", true, 67],
  ["Dr. Squatch × Sydney Sweeney", true, 64],
  ["e.l.f. × Liquid Death (2024 last-chance giveaway)", false, 49],
  ["Sol de Janeiro × Trashie", false, 40],
  ["Glossier: mystery launch", false, 37],
  ["Glossier: 7 Days of Gifting (finale)", false, 25],
  ["Crocs × Juicy Couture", false, 22],
];

const TRICKS = [
  ["A prize you can't buy", "A PR box, a PR-list spot, a one-of-a-kind object.", "The PR Mansion is this."],
  ["A clock", "“Ends Sunday.” “Drops tomorrow 9AM.” “1 hour.”", ""],
  ["10-second entry", "Follow, like, comment.", ""],
  ["Comments are the ad", "Every comment and tag pushes the post further. Giveaway posts often get more comments than product posts.", ""],
  ["Follow both accounts", "Crocs × Juicy, e.l.f. × Liquid Death and Crumbl × Kylie all required following two accounts.", "This is how the new monster account grows."],
  ["A reason to come back", "Glossier ran a new giveaway every day for 7 days. Kylie added new winners to the caption every day.", ""],
];

/* rows: [day, date, gap, what, url (or null), likes/comments, samePost] */
const BRANDS = [
  {
    id:"drsquatch", main:true, stars:3, cats:["CELEB","DROP"], year:2025,
    title:"Dr. Squatch × Sydney Sweeney", sub:"“Win it, then buy it”",
    account:"@drsquatch", tabs:"Sheet tabs “DROP 1” and “CELEB 4”",
    glance:{
      order:"Giveaway → giveaway closes → winners → “1 hour” countdown → limited drop of 5,000 bars. 8 days from giveaway to drop.",
      proof:"Giveaway post 64K likes / 37K comments (the comments were the entries).",
      why:"The giveaway gathered everyone who wanted the product. Everyone who didn't win was told exactly when to buy. There was a clear clock and real scarcity (5,000 bars).",
      extra:"“Doesn't it need lots of prep?” The long prep was the celebrity deal and making the product. The giveaway-to-drop part took only 8 days, and that's the part Nancy copies.",
      fit:"The closest match to the plan. The order and the short gap are copied exactly.",
    },
    rows:[
      ["Earlier","3 Oct 2024","months before","Earlier Sweeney tease: “SYDNEY SWEENEY BODY WASH GENIE !!”",IG("DAqvwdAPZSQ"),"18K / 249"],
      ["Day 1","29 May 2025","Launch","Giveaway goes live: win the limited Sydney Sweeney “Bathwater Bliss” soap. Enter in the comments.",IG("DKPmtz_vHWf"),"64K / 37K"],
      ["Day 7","4 Jun 2025","6 days later","Giveaway closes (date stated in the caption).",IG("DKPmtz_vHWf"),"—",true],
      ["Day 8","5 Jun 2025","1 day later","Winners picked (stated in the caption).",IG("DKPmtz_vHWf"),"—",true],
      ["Day 9","6 Jun 2025","1 day later","Countdown post: drop goes live in 1 hour, aimed at everyone who didn't win.",IG("DKkEdZ7BqGZ"),"9.9K / 718"],
      ["Day 9","6 Jun 2025","1 hour later","Drop reel: a limited run of 5,000 bars goes on sale.",IG("DKkLV_9u9jS"),"24K / 2.5K"],
    ],
    takeaway:"Run the giveaway BEFORE the drop so the comment section becomes your waiting list. Keep the gap to about a week, announce winners, then post a 1-hour countdown on drop day.",
  },
  {
    id:"gentlemonster", stars:3, cats:["BIG"], year:2024,
    title:"Gentle Monster × Jennie", sub:"Jentle Salon: free PR boxes first, limited drop after",
    account:"@gentlemonster + creators", tabs:"Sheet tab “BIG 4” · series: Jentle Home 2020, Jentle Garden 2022, Jentle Salon 2024 · The brief's own reference",
    glance:{
      order:"Celebrity unboxes the special package → official reveal with the drop date → free PR boxes land with creators the same day → the collection drops 9 days after the reveal.",
      proof:"Jennie's unboxing 476K likes. The reveal 378K. Creator unboxings 55K–101K each.",
      extra:"Honest note: there's no public “comment to win” post. The giveaway here is the PR list (boxes sent free to creators).",
      fit:"Exactly the brief's formula. The 10 PR Mansions play the role of their special package.",
    },
    rows:[
      ["Day 1","19 Apr 2024","Launch","@gentlemonster: Jennie unpacks the upcoming special package. The caption gives only the date, “5.1”.",IG("C5-FsEOrD5U"),"476K / 2,474"],
      ["Day 4","22 Apr 2024","3 days later","Official reveal: “Introducing JENTLE SALON… Get notified at the link in bio. Launching on 5.1.”",IG("C6Fh2nevSeT"),"378K / 3,527"],
      ["Day 4","22 Apr 2024","Same day","PR boxes land: creator unboxing (“idk who put me on the gentle monster pr list…”). @thatsheart",IG("C6FChcOybTo"),"55K / 351"],
      ["Day 4","22 Apr 2024","Same day","Creator try-on of every frame in the special package. @cristinaleontyeva",IG("C6FfY3nxPFx"),"101K / 232"],
      ["Day 5","23 Apr 2024","1 day later","More creator content: “jentle salon all over”. @gabbi",IG("C6GNZwDpId3"),"96K / 133"],
      ["Day 13","1 May 2024","8 days later (9 after the reveal)","Drop: the collection goes live (8 frames, 11 charms). Posted by a retail partner, @thebeaulife.co.",IG("C6Z6UjxyeOC"),"72K / 64"],
    ],
    takeaway:"Unbox first, date second, PR boxes the same day as the reveal, drop about 9 days later.",
    images:["salon_gm.jpg","salon_heart.jpg"],
  },
  {
    id:"crocs", stars:3, cats:["NO CELEB"], year:2025,
    title:"Crocs × Juicy Couture", sub:"Y2K Giveaway", account:"@crocs", tabs:"Sheet tab “NO CELEB 5”",
    glance:{
      proof:"22K likes / 1.8K comments.",
      prize:"A Y2K bundle from Crocs + Juicy Couture.",
      entry:"Follow @crocs + @juicycouture, like, comment your favourite Y2K trend. US only.",
      why:"A fun theme + a playful voice + a 2-day window. Follow both brands.",
      fit:"The “follow @hellonancy AND @[monsters]” entry rule comes from here.",
    },
    rows:[
      ["Day 1","19 Mar 2025","Launch","“Y2K GIVEAWAY ALERT!” Follow both brands, like, comment your favourite Y2K trend.",IG("DHZAe3ZJexn"),"22K / 1.8K"],
      ["Day 3","21 Mar 2025","2 days later","Winners announced in Instagram Stories (stated in the caption).",IG("DHZAe3ZJexn"),"—",true],
    ],
    takeaway:"Keep it fun and fast, with a theme everyone gets, a one-line comment prompt and a 2-day window.",
  },
  {
    id:"elf-ld-2026", stars:2, cats:["DROP"], year:2026,
    title:"e.l.f. × Liquid Death Lip Embalms", sub:"Drop, sell out, then give away the PR box",
    account:"@liquiddeath, @elfcosmetics", tabs:"Sheet tab “DROP 2”",
    glance:{
      order:"Hype reel → teaser with the exact drop time → drop → sells out the same day → “another chance” giveaway of the PR box.",
      proof:"Liquid Death reel 611K likes. Drop post 73K. Giveaway reel 12K likes / 9.2K comments.",
      fit:"The PR Mansion works as the second-chance prize after the drop.",
    },
    rows:[
      ["Day 1","12 Jan 2026","Launch","@liquiddeath hype reel announces the collab.",IG("DTacnJzEgRf"),"611K / 4,086"],
      ["Day 2","13 Jan 2026","1 day later","@elfcosmetics teaser: “drop TOMORROW Jan 14 9AM PT”.",IG("DTdj11glJG_"),"19K / 371"],
      ["Day 3","14 Jan 2026","1 day later","Drop: $8 Lip Embalm, $40 Lip Crypt Vault, $18 keeper.",IG("DTf6agsAbLK"),"73K / 1,156"],
      ["Day 3","14 Jan 2026","Same evening","“SOLD OUT… another chance”: giveaway reel to win their very own PR box.",IG("DTgsYELFCPd"),"12K / 9,239"],
    ],
    takeaway:"Give the exact drop time a day before, then turn the sellout into the giveaway hook.",
  },
  {
    id:"elf-ld-2024", stars:2, cats:["DROP"], year:2024,
    title:"e.l.f. × Liquid Death Corpse Paint", sub:"Limited coffin kit, then a “last chance” giveaway",
    account:"@liquiddeath, @elfcosmetics", tabs:"Sheet tab “DROP 3”",
    glance:{
      order:"Limited drop → “almost sold out” → the next day, a joint giveaway of one coffin keepsake (follow both) → closes 4 days later.",
      proof:"Liquid Death reel 76K likes. e.l.f. launch 59K. Giveaway reel 49K likes / 12K comments.",
      fit:"The same dark-cute, naughty tone. A joint “follow both” giveaway.",
    },
    rows:[
      ["Day 1","26 Mar 2024","Launch","@liquiddeath ad reel: limited “Corpse Paint” coffin kit.",IG("C4-7w5zrEvu"),"76K / 2,480"],
      ["Day 1","26 Mar 2024","30 min later","@elfcosmetics launch post. The caption says “almost sold out”.",IG("C4-_JHhL0z2"),"59K / 987"],
      ["Day 2","27 Mar 2024","1 day later","“Last chance” giveaway reel: win one coffin keepsake. Follow both, like, comment, bonus entry for tagging.",IG("C5BjSE5J_91"),"49K / 12K"],
      ["Day 6","31 Mar 2024","4 days later","Giveaway closes 11:59pm PT (stated in the caption).",IG("C5BjSE5J_91"),"—",true],
    ],
  },
  {
    id:"glossier-mystery", stars:2, cats:["NO CELEB"], year:2024,
    title:"Glossier", sub:"Secret pre-summer launch mystery giveaway", account:"@glossier", tabs:"Sheet tab “NO CELEB 3”",
    glance:{
      proof:"37K likes / 25K comments.",
      prize:"25 winners get Glossier's secret, not-yet-announced summer launch.",
      entry:"Follow, like, tag a friend.",
      why:"Mystery + exclusivity, in a 4-day window.",
      fit:"The mystery teaser idea for 18–20 Oct.",
    },
    rows:[
      ["Day 1","29 Mar 2024","Launch (Friday)","Giveaway of “our secret pre-Summer launch!”, 25 winners.",IG("C5GpjOrOw3b"),"37K / 25K"],
      ["Day 4","1 Apr 2024","3 days later (Monday)","Winners picked at 2pm ET (stated in the caption).",IG("C5GpjOrOw3b"),"—",true],
    ],
  },
  {
    id:"glossier-7days", stars:2, cats:["NO CELEB"], year:2025,
    title:"Glossier", sub:"7 Days of Gifting (Dec 2025)", account:"@glossier", tabs:"Sheet tab “NO CELEB 4”",
    glance:{
      proof:"Day 1 13K / 5.5K · Day 3 13K / 3.4K · Day 6 11K / 3.8K · Day 7 finale 25K / 12K.",
      prize:"A different prize each day, with the whole Holiday Collection on Day 7.",
      entry:"Each day: follow, tag a friend, answer a fun question in the comments.",
      extra:"Days 2, 4 and 5 are not on Glossier's feed (possibly Stories), so they're not listed.",
      fit:"The daily “Meet the Monster” series (23–25 Oct).",
    },
    rows:[
      ["Day 1","15 Dec 2025","Launch","Day 1: all 5 Holiday Balm Dotcom flavours, 3 winners. Comment your favourite flavour.",IG("DSS-m5FEfm7"),"13K / 5.5K"],
      ["Day 3","17 Dec 2025","2 days later","Day 3: Body Spritz mailer, 5 winners. Comment your dream vacation.",IG("DSX0W3nEWU9"),"13K / 3.4K"],
      ["Day 6","20 Dec 2025","3 days later","Day 6: store-exclusive merch, 1 winner.",IG("DSfb8L2kbK5"),"11K / 3.8K"],
      ["Day 6","20 Dec 2025","Same day","Day 1 winners DM'd (stated in the Day 1 caption).",IG("DSS-m5FEfm7"),"—",true],
      ["Day 7","21 Dec 2025","1 day later","FINALE: the entire 2025 Holiday Collection.",IG("DSiCvgpkZt6"),"25K / 12K"],
      ["Day 8","22 Dec 2025","1 day later","Day 3 winners DM'd.",IG("DSX0W3nEWU9"),"—",true],
      ["Day 11","25 Dec 2025","3 days later","Day 6 winners DM'd on Christmas Day.",IG("DSfb8L2kbK5"),"—",true],
      ["Day 12","26 Dec 2025","1 day later","Day 7 winners DM'd.",IG("DSiCvgpkZt6"),"—",true],
    ],
    takeaway:"A daily habit with the biggest prize last. The finale got about 2× the likes of the other days.",
  },
  {
    id:"elf-pr", stars:2, cats:["NO CELEB"], year:2026,
    title:"e.l.f. Cosmetics", sub:"“Win a spot on our PR list for a year”", account:"@elfcosmetics", tabs:"Sheet tab “NO CELEB 1”",
    glance:{
      proof:"72K likes / 75K comments (more comments than likes).",
      prize:"One winner gets every @elfcosmetics + @elfskincare PR package for 12 months.",
      entry:"Follow both accounts, like, tag a bestie. 18+, US, no purchase necessary.",
      why:"The prize is what fans see influencers get. It turns a fan into an “influencer” for a year.",
      fit:"The Monster Mansion IS a PR box. An idea: “Win a Monster Mansion + a spot on the Nancy PR list.”",
    },
    rows:[
      ["Day 1","2 Jan 2026","Launch","Win a spot on the e.l.f. PR lists for a whole year.",IG("DTAzZqiAe4o"),"72K / 75K"],
      ["Day 6","7 Jan 2026","5 days later","Closes at 11:59pm PT (stated in the caption).",IG("DTAzZqiAe4o"),"—",true],
      ["After Day 6","after closing","—","Winner contacted by DM. The caption was updated to “CLOSED” with the winner tagged.",IG("DTAzZqiAe4o"),"—",true],
    ],
  },
  {
    id:"crumbl", stars:2, cats:["CELEB"], year:2024,
    title:"Crumbl × Kylie Cosmetics", sub:"Collab giveaway", account:"@crumbl", tabs:"Sheet tab “CELEB 2”",
    glance:{
      proof:"71K likes / 10K comments.",
      prize:"5 winners each get a $100 Kylie Cosmetics gift card + a $100 Crumbl gift card + a Kylie Cosmetics PR box (tied to the Skin Tint Blurring Elixir launch).",
      entry:"Follow @crumblcookies + @kyliecosmetics, share to your story, tag 3 friends.",
      extra:"Context: Kylie announced the collab on 22 Jul 2024 (2.1M likes), and @kyliecosmetics posted the limited-edition in-store pickup on 24 Jul (1.19M likes).",
      context:[[IG("C9vbhLOtnK3"),"22 Jul 2024 · @kyliejenner announces the collab · 2.1M likes"],[IG("C9zwowDxLEx"),"24 Jul 2024 · @kyliecosmetics in-store pickup · 1.19M likes"]],
    },
    rows:[
      ["Day 1","24 Jul 2024","Launch","Collab giveaway post on Crumbl announcing Kylie Cosmetics × Crumbl and the prize.",IG("C90UdZcBucJ"),"71K / 10K"],
      ["Day 4","27 Jul 2024","3 days later","Giveaway closes (runs Jul 24–27).",IG("C90UdZcBucJ"),"—",true],
      ["Day 6","29 Jul 2024","2 days later","Winners revealed. The caption was marked GIVEAWAY CLOSED.",IG("C90UdZcBucJ"),"—",true],
    ],
  },
  {
    id:"poppi", stars:2, cats:["CELEB"], year:2026,
    title:"poppi × Subway × Rob Rausch", sub:"Giveaway week (Aug 2026)", account:"@drinkpoppi", tabs:"Sheet tab “CELEB 3”",
    glance:{
      proof:"Big giveaway 67K / 1.6K. Smaller giveaways 6.7K / 5.5K and 3.2K / 2.7K.",
      prize:"Big: 50 winners get poppi × Subway overalls (as worn by Rob Rausch) + 2 cases.",
      entry:"Follow @drinkpoppi + @subway, like, tag a friend. Bonus: comment 👖 on the last three posts. 18+, US, no purchase necessary.",
      why:"A daily giveaway rhythm, plus a famous face wearing the prize in teasers the day before.",
    },
    rows:[
      ["Day 1","17 Aug 2026","Start","Giveaway #1: new Sour Apple flavour, 10 winners.",IG("DcJ4tJrkrNZ"),"6.7K / 5.5K"],
      ["Day 2","18 Aug 2026","1 day later","Giveaway #2: Sour Apple mailer, 20 winners.",IG("DcL4JkStett"),"3.2K / 2.7K"],
      ["Day 3","19 Aug 2026","1 day later","Teaser #1: Rob Rausch in the poppi × Subway look.",IG("DcOmKwCQmEs"),"7.2K / 310"],
      ["Day 3","19 Aug 2026","Same day","Teaser #2: “@robert_rausch 🤝 @drinkpoppi 🤝 @subway”.",IG("DcPJrLgyMBL"),"2.8K / 444"],
      ["Day 4","20 Aug 2026","1 day later","BIG giveaway at 11am CT: 50 winners, overalls + 2 cases.",IG("DcRJB4jG8Xg"),"67K / 1.6K"],
      ["Day 7","23 Aug 2026","3 days later","Ends 11:59pm CT. The caption was updated to [GIVEAWAY CLOSED].",IG("DcRJB4jG8Xg"),"—",true],
    ],
  },
  {
    id:"kylie-lipstick", stars:1, cats:["CELEB"], year:2021,
    title:"Kylie Cosmetics", sub:"National Lipstick Day giveaway", account:"@kyliecosmetics", tabs:"Sheet tab “CELEB 1”",
    glance:{
      proof:"142K likes / 51K comments.",
      prize:"10 winners each get every Lip Kit shade + a Lip Kit signed by Kylie.",
      entry:"Like, comment tagging a friend (unlimited comments), follow. US only.",
      why:"Unlimited comments, and winners added to the caption every day, so people kept coming back.",
    },
    rows:[
      ["Day 1","29 Jul 2021","Launch (National Lipstick Day)","Giveaway post goes live.",IG("CR67CXiBvom"),"142K / 51K"],
      ["Day 1","29 Jul 2021","Same day","Day 1 winners added to the caption.",IG("CR67CXiBvom"),"—",true],
      ["Day 2","30 Jul 2021","1 day later","Day 2 winners added.",IG("CR67CXiBvom"),"—",true],
      ["Day 3","31 Jul 2021","1 day later","Day 3 winners added.",IG("CR67CXiBvom"),"—",true],
      ["Day 4","1 Aug 2021","1 day later","Day 4 winners added.",IG("CR67CXiBvom"),"—",true],
      ["Day 5","2 Aug 2021","1 day later","Giveaway ends, final winners added.",IG("CR67CXiBvom"),"—",true],
    ],
    note:"The sheet lists the winners' handles. They're private individuals, so they're not published here.",
  },
  {
    id:"sol", stars:1, cats:["NO CELEB"], year:2026,
    title:"Sol de Janeiro", sub:"Back-to-back collab giveaways (Mar–Apr 2026)", account:"@soldejaneiro", tabs:"Sheet tab “NO CELEB 2”",
    glance:{
      proof:"#1 26K / 14K. #2 40K / 14K.",
      entry:"Like + save + share, follow both brands, tag a bestie (multiple entries allowed), bonus entries for engaging with the last 3 posts. 18+, US.",
      fit:"A cheeky, sensual body-care tone close to Nancy's. It shows how to chain giveaways with partners.",
    },
    rows:[
      ["Day 1","25 Mar 2026","Launch","Giveaway #1 with @beautyofjoseon_official, 3 winners.",IG("DWUSt13kR-x"),"26K / 14K"],
      ["Day 8","1 Apr 2026","7 days later","#1 closes 11:59pm EST. Winners DM'd.",IG("DWUSt13kR-x"),"—",true],
      ["Day 9","2 Apr 2026","1 day later","Giveaway #2 with @trashie for Earth Month: a year of refills + a year of Trashie bags.",IG("DWoqp7ZkXNF"),"40K / 14K"],
      ["Day 15","8 Apr 2026","6 days later","#2 closes 11:59pm EST.",IG("DWoqp7ZkXNF"),"—",true],
    ],
  },
  {
    id:"squatch-spirit", stars:1, cats:["DROP"], year:2025,
    title:"Dr. Squatch × Spirit Halloween", sub:"Limited Halloween soap + $15K giveaway",
    account:"@spirithalloween, @drsquatch", tabs:"Sheet tab “DROP 4” · The weakest numbers, included because it's Dr. Squatch AND Halloween",
    glance:{},
    rows:[
      ["Day 1","11 Sep 2025","Launch","@spirithalloween: limited Drunk'n Pumpkin soap in stores “while supplies last”.",IG("DOeDSJ1DW6u"),"23K / 223"],
      ["Day 17","27 Sep 2025","16 days later","@spirithalloween: $15,000 giveaway.",IG("DPG7ZZjjtz3"),"7.2K / 525"],
      ["Day 21","1 Oct 2025","4 days later","@drsquatch “THIS IS NOT A DRILL”: online-only costume, limited soap in stores, $15K sweepstakes.",IG("DPRciUHj4EN"),"7.6K / 110"],
      ["Day 22","2 Oct 2025","1 day later","@spirithalloween reel: “Jack and @drsquatch…” character content.",IG("DPUqTqsgiB6"),"1.9K / 21"],
    ],
  },
  {
    id:"feastables-2024", stars:1, cats:["BIG"], year:2024,
    title:"Feastables (MrBeast)", sub:"$1,000,000 Halloween Sweepstakes", account:"@mrbeast", tabs:"Sheet tab “BIG 1” · The product IS the giveaway ticket",
    glance:{},
    rows:[
      ["Day 1","1 Oct 2024","Launch","“On Halloween, Feastables is giving away $1,000,000! Scan the QR code on the back of your bar on 10/31.”",IG("DAl22e_Rcy2"),"671K / 12K"],
      ["Day 31","31 Oct 2024","30 days later","Halloween: the QR code goes live (stated in the caption).",IG("DAl22e_Rcy2"),"—",true],
      ["Day 37","6 Nov 2024","6 days later","Winner reveal.",IG("DCCl-ibRd0j"),"1M / 12K"],
    ],
    takeaway:"The winner reveal got MORE likes than the launch, so always post the winner.",
  },
  {
    id:"feastables-2026", stars:1, cats:["BIG"], year:2026,
    title:"Feastables", sub:"“Win Halloween” 2026 (running now, in the same window as Nancy)", account:"@feastables", tabs:"Sheet tab “BIG 2” · A live competitor",
    glance:{},
    rows:[
      ["Day 1","10 Sep 2026","Launch","Limited “Neighborhood Bundles” on Amazon + “we could also knock on your door Halloween night with $10,000.”",IG("DdHN20hBx-S"),"3,143 / 390"],
      ["Day 3","12 Sep 2026","2 days later","Giveaway: “your house. your state. $10,000. COMMENT YOUR STATE.” Ends 10/28/26.",IG("DdMSHZKGxnW"),"8,551 / 2,261"],
      ["Day 5","14 Sep 2026","2 days later","“Be the most wanted house on Halloween”: gift with purchase until 11/1 or while supplies last.",IG("DdRf7OFBGjs"),"5,456 / 783"],
      ["Day 49","28 Oct 2026","6 weeks later","Giveaway closes. Winner visit planned for Halloween night.",null,"—"],
    ],
    takeaway:"Feeds will be full of Halloween giveaways. A cash prize alone isn't the hook. The Mansion, an object people want, is a stronger prize.",
  },
  {
    id:"kylie-halloween", stars:1, cats:["BIG"], year:2016,
    title:"Kylie Cosmetics", sub:"Halloween-only free exclusive lipstick", account:"@kyliejenner", tabs:"Sheet tab “BIG 3” · A one-day mechanic, not a giveaway",
    glance:{},
    rows:[
      ["Day 1","31 Oct 2016","One day only","“Happy Halloween! Giving away my exclusive metal lipstick KYMAJESTY with all orders placed today.”",IG("BMPs495h_Qz"),"922K / 219K"],
    ],
    takeaway:"A “today only” free extra keeps the drop selling on 31 Oct.",
  },
];

const MONSTERS = [
  {name:"Lemmy", look:"Yellow lips, in a world of candy lips", who:"The flirt. Always has something to say, always the first to kiss and tell.", line:"“I'm a Lemmy 💋, all talk, all action.”", c:"#FFD42E", img:"pearl-4-lemmy.jpg"},
  {name:"Jack", look:"Orange pumpkin", who:"The quiet one. Looks sweet, and he's a grower, not a shower.", line:"“I'm a Jack 🎃, don't let the cute fool you.”", c:"#F08A1C", img:"pearl-2-jack-v2.jpg"},
  {name:"Medusa", look:"Pink tentacle, yellow base, octopus world", who:"The show-off. So many hands, so little time. One look and you're hers.", line:"“I'm a Medusa 🐙, hands full, always.”", c:"#E5398A", img:"pearl-3-medusa.jpg"},
];

/* Giveaway + limited drop timeline, synced with the grid site (nancymonstermansion-grid.vercel.app, read 9 Oct 2026).
   kind: grid = on the grid as is · tweak = on the grid, small change · new = not on the grid yet (the drop) · confirm = needs a decision. */
const GRID_URL = "https://nancymonstermansion-grid.vercel.app/";
const PLAN = [
  {ph:"Lock", date:"by 8 Oct", gap:"prep", acct:"Dione + Crystal", kind:"grid", from:[],
   what:"Prize value, giveaway mechanic (Ivan + Rahul pick), numbered Vol. I run size.",
   grid:"PM board · Lock (8 Oct)"},
  {ph:"Build", date:"12–14 Oct", gap:"prep", acct:"Dione", kind:"grid", from:[],
   what:"KNOCK KNOCK comment → auto-DM → free entry form. Founding pre-order price + early bird set with e-com.",
   grid:"PM board · 12 Oct, 14 Oct"},
  {ph:"Giveaway opens", moment:"giveaway", date:"21 Oct", gap:"P1", acct:"COLLAB", kind:"grid", big:true, from:["drsquatch","crocs"],
   what:"Soft launch. Win a giant Nancy pumpkin: follow both accounts + comment KNOCK KNOCK. Pre-order opens at the founding price.",
   grid:"PM board P1 · Win a Mansion giveaway opens + Soft launch"},
  {ph:"Drop notice", moment:"tomorrow", date:"28 Oct", gap:"+7 days", acct:"BOTH", kind:"tweak", from:["drsquatch"],
   what:"“Doors open tomorrow, 9pm ET. Vol. I is limited.”",
   grid:"Grid · “Getting ready for the Mansion” → new caption"},
  {ph:"LIMITED DROP", moment:"drop", date:"29 Oct · 9pm ET", gap:"+1 day", acct:"BOTH", kind:"grid", big:true, from:["drsquatch"],
   what:"8pm “1 hour.” countdown → 8:30pm members / Resident passes in early → 9pm drop goes public.",
   grid:"PM board P1 · Hard launch 9pm ET (9am HKT 30 Oct)"},
  {ph:"Winners", moment:"winners", date:"5 Nov", gap:"+7 days", acct:"BOTH", kind:"grid", big:true, from:["feastables-2024"],
   what:"Giveaway winners announced. Post the winner.",
   grid:"PM board P1 · Winners announced on Instagram"},
];

const MOMENTS = [
  {id:"giveaway", when:"21 Oct", title:"Giveaway opens (collab)", acct:"Both", grid:"PM P1 · giveaway opens",
    content:[],
    captions:[["Option A","GIVEAWAY 🎃 Win a giant Nancy pumpkin (Lemmy, Medusa & Jack inside).\n1. Follow @nancymonstermansion + @hellonancy_official\n2. Comment KNOCK KNOCK\nWinners announced 5 Nov. The limited Vol. I drop opens 29.10, 9pm ET.\n18+, US only, no purchase necessary. This promotion is not sponsored, endorsed or administered by, or associated with Instagram."],["Option B (short hook)","Did you hear that? 🎃 Comment KNOCK KNOCK to win a giant Nancy pumpkin."]]},
  {id:"tomorrow", when:"28 Oct", title:"Drop notice", acct:"Both", grid:"Getting ready for the Mansion",
    content:[],
    captions:[["Option A","Doors open tomorrow, 9pm ET. 🗝️ Vol. I is limited: when they're gone, they're gone."]]},
  {id:"drop", when:"29 Oct · 9pm ET", title:"Limited drop", acct:"Both", grid:"PM P1 · hard launch",
    content:[],
    captions:[["8pm countdown","1 hour. Let the Haunting Begin. 🗝️"],["9pm drop","Monster Mansion Vol. I is open. Lemmy, Medusa, Jack. Limited run, link in bio."]]},
  {id:"winners", when:"5 Nov", title:"Winners", acct:"Both", grid:"PM P1 · winners",
    content:[],
    captions:[["Post","The Mansion has new Residents 🗝 Winners, check your DMs. We will never ask for payment."]]},
];
