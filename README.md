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

- **Editor dashboard** — create and edit articles, and manage staff, sports, ads,
  videos, and the puzzles & games pages.
- **Editor-managed sections** — add, rename, reorder, and remove sections, and
  choose which section fills each home-page slot. The nav, section pages, home
  page, and search all update automatically.
- **Rearrange any page in place** — signed in as an editor, every page has a
  *Edit layout* toggle: drag its blocks into new rows and columns, or move them
  with the keyboard. Article pages, the video index, staff, search, tags, team
  pages and the centerspread all included. Each page keeps its own layout.
- **Brand config** — one file (`config.js`) sets the masthead, school, colors,
  logo, and footer across every page.
- **Host-ready auth** — designed to sit behind Finalsite, which provides login and
  decides who is an editor.

## Tests

```bash
npm install   # once — pulls jsdom, the only dependency
npm test
```

853 checks across 17 suites: every page loads clean, every editor control is
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

## Documentation

- **[FINALSITE.md](FINALSITE.md)** — how the site integrates with Finalsite: the
  identity contract (`WL_CONTEXT`), the **editors-group logic**, and a phased plan
  for hosting, authentication, and content persistence.
- **[CUSTOMIZE.md](CUSTOMIZE.md)** — rebrand the paper for your school (the Brand
  design tab, or editing `config.js`).
- **[EDITORIAL.md](EDITORIAL.md)** — who publishes, how corrections work, when a
  story comes down, and who holds the accounts. The half of running a paper that
  isn't software.

## Project layout

| Path | Purpose |
|------|---------|
| `*.html` | Pages — public surfaces plus the `editor*.html` dashboard |
| `config.js` | Brand config (`WL_CONFIG`) — this is what makes the code *The Woodley Leaves* |
| `articles.js`, `writers.js`, `teams.js`, … | Content sources (`window.WL_*`) |
| `*-store.js` | CRUD / data layer — the seam for server-backed persistence |
| `auth.js` | Identity adapter (`window.WLAuth`; reads `WL_CONTEXT`) |
| `nav.js`, `brand.js`, `section.js`, … | Shared rendering |

## Licence

The **code** is [MIT](LICENSE). The **journalism is not** — articles, artwork
and photographs remain their student authors' work, and republishing one needs
that author's permission. See [LICENSE](LICENSE) for the split.

Want the platform without the journalism? That's the
[template](https://github.com/ariel-378/student-newspaper-template).
