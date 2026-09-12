# The Woodley Leaves

The online home of **The Woodley Leaves** — Maret School's student newspaper.
Section pages, articles, sports, videos, puzzles & games, search, and an
in-app **editor dashboard**. Framework-free (vanilla HTML/CSS/JS), no build step,
no dependencies.

This repo is Maret's deployment of a reusable newspaper platform: the code is
identical to the `newspaper-template`, and this repo adds the paper's brand config
(`config.js` — masthead, Woodley green, the leaf named for Woodley Park), its
content, and the paper name stamped into each page's `<head>` by `npm run brand`.

## Highlights

- **Editor dashboard** — create and edit articles, and manage staff, sports,
  videos, and the puzzles & games pages.
- **Editor-managed sections** — add, rename, reorder, and remove sections, and
  choose which section fills each home-page slot. The nav, section pages, home
  page, and search all update automatically.
- **Rearrange a page in place** — signed in as an editor, any page built from
  blocks gets an *Edit layout* toggle: drag them into new rows and columns, or
  move them with the keyboard. Article pages, the video index, staff, search,
  tags, team pages and the centerspread all included, each keeping its own
  layout. The home page is arranged differently — by choosing which section
  fills each slot, above.
- **Tags, if you want them** — editors keep a list of tags and switch the whole
  system on or off. Tagged articles get a tag page, and **search finds them**:
  a reader looking for *music* gets every article filed under Music, whether or
  not the word appears in the text, with the matching tag shown on the result so
  it is clear why it came up. Switched off, tags are hidden everywhere,
  search included — not deleted.
- **Plan an edition ahead** — every piece of content takes a publish date and
  time and stays invisible to readers until it arrives: articles, poems, art,
  videos, custom features and games alike. A **Schedule** tab gathers the whole
  plan into one list, in the order it goes out, grouped by day, with *Publish
  now* on any row when the plan changes.
- **Shared editing (optional)** — point `config.js` at a small store the school
  runs itself and every editor sees the same content, including what is
  scheduled, with no downloading or committing by hand. Off by default; see
  [setup/worker/README.md](setup/worker/README.md).
- **Newsletter signups** — a Subscribe button collecting an email address, and
  nothing else, into a Google Sheet the school owns.
- **Brand config** — one file (`config.js`) sets the masthead, school, colors,
  logo, and footer across every page. Editors can also upload a masthead
  flourish and a tab icon from the dashboard and export a finished `config.js`.
- **Host-ready auth** — designed to sit behind Finalsite, which provides login and
  decides who is an editor.

## Tests

```bash
npm install   # once — pulls jsdom, the only dependency
npm test
```

1038 checks across 24 suites: every page loads clean, every editor control is
pressed without throwing, and content added in the editor reaches the reader
pages. See [tests/README.md](tests/README.md).

## Run it locally

No build step and nothing to install:

```bash
npm run serve      # http://localhost:8781
```

`serve.py` sends no-cache headers, so a reload always shows your latest edit.
Pass a port if you want a specific one (`npm run serve 9000`); with no argument
it steps past a busy port rather than failing, which is what lets a second copy
of the site run alongside the first.

Any static server works just as well — `python3 -m http.server 8000` and open
`http://localhost:8000`. Opening the files directly with `file://` does not:
every editor change is kept in `localStorage`, which browsers restrict on
`file://` origins, so the dashboard cannot save.

With no host platform present, the site runs in **demo mode** — use the
**"Editor preview"** link in the account bar to open the dashboard. Editor changes
persist only in your browser's `localStorage`.

### Dashboard controls

Inside the editor dashboard, the toolbar has three buttons:

- **+ New Article** — create a new article.
- **Reset all changes** — discard your article edits and restore the original articles.
- **Reset demo data** — clear **all** saved changes in this browser (articles,
  sections, brand, layout, videos, sports, etc.) and restore the shipped content.

Because editor changes are saved to `localStorage` and override the shipped files,
if the demo ever shows stale content, click **Reset demo data** (or open the site
in a private window) to get back to the shipped version.

## Link previews

When a story is pasted into a group chat, iMessage, Slack or a social post, the
preview is built by a machine that fetches the page and reads its markup. **It
does not run JavaScript.** A page that fills in its own headline after loading
previews as the name of the paper and nothing else — which, for a school paper
whose readers share stories in group chats, is most of the distribution.

So every published story is also written out as a real page:

```
stories/<id>.html
```

with its headline, description and photo already in the markup. `article.html`
still works — old links, and the editor previewing a draft, both go through it.

**Regenerating them:**

```
npm run stories      # just the story pages
npm run brand        # re-stamps the paper name, then regenerates
```

Both are run for you by `.github/workflows/stories.yml` after every publish, so
in normal use nobody has to remember. A story published in the last minute or
two may briefly link to `article.html?id=…` instead — that page works, it just
previews poorly, and the link corrects itself once the workflow has run.

Two things worth knowing:

- **Set `siteUrl` in `config.js`** to the address the paper is published at.
  Without it the photo in a preview is a relative path, which most previews
  cannot resolve. Headlines and descriptions work either way, and
  `npm run stories` tells you when it is missing.
- **Scheduled stories are not generated.** A story with a future publish time
  gets no page until that time, so an embargoed headline is never sitting in a
  public file early.

## The demo password gate — remove this during integration

The preview at <https://woodley-leaves.vercel.app> sits behind a password. That
gate is **not part of the site**, and it is not in any page here.

It is `middleware.js` — edge middleware that runs on the host before a single
file is served. A visitor without the cookie never receives the paper's HTML at
all, so there is nothing to read in "view source" and nothing to skip. Every
`.html` in this repository is exactly what Finalsite would integrate, with no
gate in it, which is also why the test suite never meets a password prompt.

**It still is not authentication.** One shared password, no accounts — it cannot
tell one reader from another, and cannot express "students and faculty only".
It exists because the paper is being shown by link to a few people before the
school has decided anything, and the host's built-in protection is paid.

**The real mechanism** is the one Finalsite provides: the site never
authenticates anyone. Finalsite decides who may read the paper with a
page-audience setting, and tells the page who is looking via `window.WL_CONTEXT`.
See `FINALSITE.md`.

**To remove: delete `middleware.js`.** That is the entire removal — nothing
else refers to it.

The password comes from `WL_DEMO_PASSWORD` in the host's environment, so it is
not committed here.

## Documentation

- **[FINALSITE.md](FINALSITE.md)** — how the site integrates with Finalsite: the
  identity contract (`WL_CONTEXT`), the **editors-group logic**, and a phased plan
  for hosting, authentication, and content persistence.
- **[CUSTOMIZE.md](CUSTOMIZE.md)** — rebrand the paper for your school (the Brand
  design tab, or editing `config.js`).
- **[PROPOSAL.md](PROPOSAL.md)** — the ask itself, in two parts: one for Maret,
  one written to Finalsite for when it is forwarded on.
- **[FINALSITE-EMAIL.md](FINALSITE-EMAIL.md)** — one email: sent to whoever at
  the school deals with Finalsite, and written so that forwarding it to Finalsite
  is all they have to do.

## Project layout

| Path | Purpose |
|------|---------|
| `*.html` | Pages — public surfaces plus the `editor*.html` dashboard |
| `config.js` | Brand config (`WL_CONFIG`) — this is what makes the code *The Woodley Leaves* |
| `articles.js`, `writers.js`, `teams.js`, … | Content sources (`window.WL_*`) |
| `*-store.js` | CRUD / data layer — the seam for server-backed persistence |
| `auth.js` | Identity adapter (`window.WLAuth`; reads `WL_CONTEXT`) |
| `nav.js`, `brand.js`, `section.js`, … | Shared rendering |
| `stories/` | Generated — one real page per story, so links preview. Do not edit by hand |
| `story-url.js` | Where a story lives; holds the generated list of pages |

## Licence

The **code** is [MIT](LICENSE). The **journalism is not** — articles, artwork
and photographs remain their student authors' work, and republishing one needs
that author's permission. See [LICENSE](LICENSE) for the split.

Want the platform without the journalism? That's the
[template](https://github.com/ariel-378/student-newspaper-template).
