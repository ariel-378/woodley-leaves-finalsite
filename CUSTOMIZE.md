# Make this paper your school's

There are two ways to rebrand, and you only need one of them.

| | **Brand design tab** | **Edit `config.js`** |
|---|---|---|
| Who it's for | Editors, no coding needed | Whoever manages the site |
| How | Sign in as an editor → **Brand design** tab | Edit one file |
| Who sees it | **Only your own browser** | Every reader |

**If you don't touch code, start with the [Brand design tab](#the-brand-design-tab-no-code-needed).**
It has a live preview, and it can hand you a finished `config.js` to pass along
when you're happy with the result.

## Editing `config.js`

**Edit one file: `config.js`.** It's applied across every page automatically
(by `brand.js`), so you never have to touch the individual HTML pages to
rebrand.

In `config.js` you can set:

| What | Field | Example |
|------|-------|---------|
| Newspaper name (masthead + tab title) | `name` | `"The Riverside Register"` |
| School name (dateline) | `school` | `"Riverside High School"` |
| Tagline (dateline) | `tagline` | `"Student Press Since 1998"` |
| Your school color (masthead rule, links, favicon) | `colors.accent` | `"#1d4e89"` |
| Other colors (text, borders, backgrounds) | `colors.*` | usually leave as-is |
| The flourish beside the masthead | `ornament` | your own artwork — see [Using your own flourish](#using-your-own-flourish) below |
| The tab icon (favicon) | `favicon` | `{ initials: "RR", bg: "#1d4e89", fg: "#fff" }` — or your own image, see [Using your own tab icon](#using-your-own-tab-icon) below |
| Footer contacts | `contacts` | `[{ title: "Editor-in-Chief", email: "eic@riverside.edu" }]` |

Colors and the favicon update instantly; the name, dateline, flourish, and
footer update on every page. Nothing else needs editing.

### After changing `name` or `school`, run this once

```bash
npm run brand
```

`brand.js` applies the name in the browser, which covers every human reader but
not link previews (Slack, iMessage, Messenger), search crawlers or RSS readers —
none of those run JavaScript, so they read the raw HTML and would see the old
name. `npm run brand` writes the current name and school into every page's
`<head>`, so what gets shared is right.

Run it whenever `name` or `school` changes. It is safe to run repeatedly, it
touches nothing but the `<head>` and one attribute on `<html>`, and `npm test`
fails if you forget.

### Using your own flourish

The default here is the leaf named for Woodley Park (`media/leaf.svg`), drawn
on both sides of the masthead. To use your school's own artwork instead:

1. Put your image file in the **`media/`** folder.
2. In `config.js`, set `ornament.file` to its name.

```js
ornament: {
  file: "media/my-school-crest.svg",  // your file, in media/
  width: 44,        // rendered width in px; height follows your art
  mirror: false,    // see below
  opacity: 0.9,     // 1 = full strength
},
```

A few things worth knowing:

- **Your art keeps its own colors.** The flourish deliberately does *not*
  follow `colors.accent`, so it looks exactly like the file you made. If you
  want it to match your school color, use that color in the file itself.
- **`mirror`** flips the right-hand copy so the two face inward, which looks
  right for a leaf or a vine. Set it to `false` for a crest, a logo, or
  anything containing text — it would read backwards when flipped.
- **`width` is all you set.** Height follows your art's own proportions, so
  a tall crest and a wide branch both work; no need to match the default's shape.
- **SVG is sharpest** (it stays crisp on retina screens), but PNG, JPG, WEBP,
  and AVIF all work.
- **To remove the flourish entirely**, set `file: ""`.

The flourish is hidden below 880px wide, so it never crowds the masthead on
phones.

### Using your own tab icon

The tab icon (the favicon) is drawn as letters on a colored square by default —
no file needed, and it follows your school color. To use your own image
instead, upload it in **Brand design → Tab icon**, or set `favicon` to a path:

```js
favicon: "media/school-crest.svg",          // your file, in media/
// or, for the drawn version:
favicon: { initials: "RR", bg: "#1d4e89", fg: "#ffffff" },
```

A string is an image; an object is letters. Worth knowing:

- **Browsers draw it at about 16 pixels.** Anything fiddly — thin lines, a full
  wordmark, fine detail — turns to mush at that size. A single letter, a
  monogram, or a simple shape reads best.
- **SVG stays sharpest**, but PNG, JPG, WEBP and AVIF all work.
- **Square works best.** A wide image is letterboxed into a square tab slot.
- **Leaving `initials` blank** derives them from the paper name, so
  *The Riverside Register* becomes **RR**.
- **Uploading replaces the letters.** The letter settings stay put underneath,
  so removing the image gets them back rather than leaving a blank square.

## The Brand design tab (no code needed)

Sign in as an editor and open the **Brand design** tab (`editor-brand.html`). You can
change the paper name, school, tagline, school color, masthead flourish, tab
icon, and footer contacts — with a live preview, and no code.

### The one thing to understand

**Design changes are saved in your own browser, not published to readers.**

This template has no server: like the Articles and Video dashboards, the
Brand design tab writes to your browser's local storage. That's genuinely useful —
you can try artwork and colors and see them on every page instantly — but a
reader on another computer still sees the original design.

### Making it permanent for everyone

When the design looks right, click **Download config**. You get:

- **`config.js`** — your settings as a real config file.
- **`masthead-flourish.svg`** (or `.png`, etc.) — your uploaded flourish, only
  if you uploaded one.
- **`favicon.png`** (or `.svg`, etc.) — your uploaded tab icon, only if you
  uploaded one.

Send them all to whoever manages your site. They replace the existing
`config.js` and drop any images into `media/`. The exported config already
names the files exactly as they download, so the two can't disagree. That's a
one-time step, and from then on every reader sees your design.

> The download is also a good backup. Browser storage can be cleared by
> clearing your history, or by using a different computer.

### Buttons worth knowing

| Button | What it does |
|--------|--------------|
| **Save design** | Applies your changes to every page — in this browser. |
| **Download config** | Exports the files that make it permanent for readers. |
| **Back to the default** | Restores the flourish that `config.js` ships. |
| **Remove flourish** | Masthead shows just the paper's name. |
| **Remove the image, go back to letters** | Drops an uploaded tab icon; the letter settings underneath come back. |
| **Reset everything** | Discards all Design changes and returns to `config.js`. |

Nothing in the Brand design tab can break the site permanently: it only ever layers
on top of `config.js`. **Reset everything** puts it back exactly as the code
says.

## Where newsletter signups go

The **Subscribe** button at the top of every page collects an email address
into a **Google Sheet**, through a small Google
Apps Script. See **[setup/README.md](setup/README.md)** for the one-time setup
of the Sheet — about 10 minutes.

Manage it from the **Newsletter signups** panel at the bottom of the Brand
design tab:

| Field | What it's for |
|-------|---------------|
| **Show the Subscribe button** | Off removes the button from every page. Use this if the paper isn't collecting addresses. |
| **Google Apps Script web-app URL** | Where signups are sent. Ends in `/exec`. |
| **Fallback email** | Offered to a reader if a signup ever fails to send. |
| **Subscriber Sheet** | A link to your list, for editors. Never shown to readers. |
| **Send a test signup** | Posts a real row to the Sheet using the fallback address, and tells you exactly what came back. |

You can also edit `config.js` by hand instead:

```js
submissions: {
  enabled: true,
  endpoint: "https://script.google.com/macros/s/AKfycb.../exec",
  fallbackEmail: "editor@yourschool.org",
  sheetUrl: "https://docs.google.com/spreadsheets/d/.../edit",
},
```

Until the endpoint is filled in, the form **doesn't pretend to work** — it says
signups aren't set up and offers an email link, so nobody's address is thrown
away. The same is true if the send ever fails.

### Why the panel keeps nagging you to download

Like everything else in the Brand design tab, what you type is saved **in your
browser only**. For colors that just means a private preview. For *where the
paper's mail goes* it would be a trap: you could paste a URL, watch a test
signup land in the Sheet, and leave every reader still getting "signups aren't
set up".

So the panel never decides what readers get — the deployed `config.js` does.
The panel reads that file and tells you plainly:

> **Readers right now:** the Subscribe button is there, but signups aren't set
> up — readers are told so and offered email instead.

and warns you whenever what you've entered hasn't been deployed yet. **Download
config** and hand the file over is what actually makes it live.

Before you switch this on, check with your adviser. It collects contact details
from students, and schools usually have rules about that.

### Adding content
Stories, sports, videos, puzzles, and the centerspread are managed from the
**Editor dashboard** (`editor.html`). The paper ships blank — add your own. In a
Finalsite deployment, editor access is granted by an administrator through the
school login (see the notes in `auth.js`); in the standalone template, use the
"Editor preview" link to try the dashboards.

## Shared editing (optional)

By default every editor's work lives in their own browser, and reaching readers
means clicking **Download to publish** and committing a file. Switch on shared
editing and neither is true:

- Editors see each other's work, **including anything scheduled**.
- Publishing happens on its own — nobody downloads or commits anything.
- Readers still load a fast committed file, so the site is unaffected if the
  service is ever down.

It runs on a Cloudflare Worker you deploy once; the free tier is far more than a
school paper needs. Setup takes about twenty minutes:
**[setup/worker/README.md](setup/worker/README.md)**. Then fill in `config.js`:

```js
sync: {
  endpoint: "https://paper-content.yourname.workers.dev",
  key: "the editor key you set on the Worker",
},
```

Leave `endpoint` blank and nothing changes.

**Two editors at once** is handled by sending only the keys a browser actually
changed and merging them one at a time, so people working on different things
never overwrite each other. Two people editing the *same article* at the same
moment will still have one version win — this keeps a small newsroom out of
each other's way, it is not Google Docs.

**Someone has to own the Cloudflare account.** Put it on an address the paper
keeps, not a personal one.

## Planning ahead: publish dates

Every kind of content takes an optional **publish date and time** — articles,
poems, prose, art, reveal-answer items, videos, custom features and custom
games. Leave it blank and the item goes live as soon as you save it. Set a time
in the future and it is **finished and waiting**: it stays in your dashboard,
marked with a ⏳ and the date, and no reader can see it until that moment.

That is what lets you build next Friday's edition on Tuesday.

Two things worth knowing:

- **The time is your local time**, with no timezone attached. For one school
  that is exactly right.
- **It hides content; it does not embargo it.** This is a static site, so a
  scheduled item's text still ships inside `published-content.js` — anyone who
  opens the page source can read it early. That is fine for planning a poem.
  For a story that genuinely must not leak, keep it out of the site until the
  day you publish it.

### The breaking-news banner

The banner across the top of the front page shows **one** story from the
**Breaking** section, and picks it in this order:

1. **The section's featured pick**, if there is one. Click *Feature* on a
   Breaking story and the banner uses it.
2. **Otherwise the newest** Breaking story.

A featured pick that readers can't see yet — hidden, or scheduled for later —
is skipped, and the newest live story runs instead. So featuring next Friday's
story doesn't put Friday's headline on the front page today.

With no stories in Breaking, the banner doesn't appear at all.

### Tags

Tags are **off until you turn them on**, in **Content → Tags**. A paper that
doesn't want them never sees them.

Switched on, you keep a short list — *Profiles*, *Sports*, *Op-Ed* — and writers
**search it** when tagging an article: type a few letters, pick from what
matches. Chosen tags sit above the box as chips you can remove. Typing a tag
that isn't on the list does nothing, deliberately. That is the point: a
free-text box is how "Sports", "sports" and "sport" become three separate tag
pages with one article each.

- **Renaming a tag** carries every article with it, so a tag keeps meaning one thing.
- **Deleting one** takes it off the articles too, so nothing points at a tag that's gone.
- **Switching tags off hides them; it doesn't delete anything.** The list and the
  articles' tags survive, and switching back on restores exactly what was there.

### The Schedule tab

The **Schedule** tab is the plan: everything with a publish time still to come,
from every part of the paper, in the order it will go out. It answers the
question the section cards can't — *what goes out this week, and when?*

- Grouped by day, with **Today** and **Tomorrow** named, and a count per day.
- Each row shows the time, what kind of thing it is (Article, Poem, Art, Video,
  Feature, Game), its section, and how long until it lands.
- **Publish now** on any row runs it immediately instead of waiting — for when
  the plan changes.

If the tab is empty, nothing is waiting on a future time.

**Scheduling is not publishing.** A publish time decides *when* a piece appears
once readers have it. Getting it to readers at all is **Content → Publish &
transfer → Download to publish**, and a scheduled piece that was never
published reaches nobody, whatever time it carries. The Schedule tab warns you
when this browser is holding work readers have never received.

### The Centerspread tab
The **Centerspread** tab controls the centerspread page:

- **Centerspread pieces** — the poems, prose, and images at the top of the page. Each
  piece is one of three types: a **poem** (laid out in stanzas), **prose**
  (paragraphs), or an **image** (a painting or photo, not tied to any article —
  paste a URL or upload a file). Any piece can hide an answer behind a **reveal
  toggle** (for a "guess who" or "guess the teacher"). Reorder pieces with the
  ↑ ↓ buttons. Defaults live in `centerspread.js`.
- **Puzzles shown** — checkboxes for the interactive puzzles below the pieces
  (Mini Crossword, Spelling Bee, Connections, Word Search). Unchecking one hides
  it from readers without deleting it. Connections ships off by default.
- **Edit the puzzles** — the actual puzzle content (crossword clues, spelling
  bee letters, connections groups). Each has a pool; today's puzzle is picked
  from the pool by date, so add several to keep the rotation fresh. (This used
  to be a separate "Puzzles" tab; it now lives here.)
