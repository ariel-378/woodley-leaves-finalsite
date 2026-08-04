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
| The tab icon (favicon) | `favicon` | `{ initials: "RR", bg: "#1d4e89", fg: "#fff" }` — or a file path like `"logo.svg"` |
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

The default is a leaf branch (`media/leaf.svg`) drawn on both sides of the
masthead. To use your school's own artwork instead:

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
  a tall crest and a wide branch both work; no need to match the leaf's shape.
- **SVG is sharpest** (it stays crisp on retina screens), but PNG, JPG, WEBP,
  and AVIF all work.
- **To remove the flourish entirely**, set `file: ""`.

The flourish is hidden below 880px wide, so it never crowds the masthead on
phones.

## The Brand design tab (no code needed)

Sign in as an editor and open the **Brand design** tab (`editor-brand.html`). You can
change the paper name, school, tagline, school color, masthead flourish, tab
icon, and footer contacts — with a live preview, and no code.

### The one thing to understand

**Design changes are saved in your own browser, not published to readers.**

This template has no server: like the Articles, Ads, and Video dashboards, the
Brand design tab writes to your browser's local storage. That's genuinely useful —
you can try artwork and colors and see them on every page instantly — but a
reader on another computer still sees the original design.

### Making it permanent for everyone

When the design looks right, click **Download config**. You get:

- **`config.js`** — your settings as a real config file.
- **`masthead-flourish.svg`** (or `.png`, etc.) — your uploaded artwork, only
  if you uploaded some.

Send both to whoever manages your site. They replace the existing `config.js`
and drop the artwork into `media/`. That's a one-time step, and from then on
every reader sees your design.

> The download is also a good backup. Browser storage can be cleared by
> clearing your history, or by using a different computer.

### Buttons worth knowing

| Button | What it does |
|--------|--------------|
| **Save design** | Applies your changes to every page — in this browser. |
| **Download config** | Exports the files that make it permanent for readers. |
| **Back to the leaf** | Restores the default leaf flourish. |
| **Remove flourish** | Masthead shows just the paper's name. |
| **Reset everything** | Discards all Design changes and returns to `config.js`. |

Nothing in the Brand design tab can break the site permanently: it only ever layers
on top of `config.js`. **Reset everything** puts it back exactly as the code
says.

## Where reader submissions go

Newsletter signups, staff signups, and story pitches are sent to a **Google
Sheet** through a small Google Apps Script. See **[setup/README.md](setup/README.md)**
for the one-time setup (about 10 minutes), then paste the web-app URL into
`config.js`:

```js
submissions: {
  endpoint: "https://script.google.com/macros/s/AKfycb.../exec",
  fallbackEmail: "editor@yourschool.org",
},
```

Until that's filled in, those forms **don't pretend to work** — they say
submissions aren't set up and offer an email link, so nothing a student writes
is thrown away. The same is true if the send ever fails.

The endpoint is deliberately **not** in the Brand design tab: Design changes are
per-browser, and where the paper's mail goes has to be the same for everyone.

### Adding content
Stories, ads, sports, videos, puzzles, and the centerspread are managed from the
**Editor dashboard** (`editor.html`). The paper ships blank — add your own. In a
Finalsite deployment, editor access is granted by an administrator through the
school login (see the notes in `auth.js`); in the standalone template, use the
"Editor preview" link to try the dashboards.

### The Centerspread tab
The **Centerspread** tab controls the centerspread page:

- **Print pieces** — the poems, prose, and images at the top of the page. Each
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
