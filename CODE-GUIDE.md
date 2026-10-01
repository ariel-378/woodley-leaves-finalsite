# A guide to the code

For a developer opening this repository for the first time. It explains how the
site is put together and where to change things.

If what you need is the **integration contract** — how identity arrives, where a
server-backed store would attach — that is [FINALSITE.md](FINALSITE.md), and it
is the one to read first. This file is the tour of the code underneath it.

---

## The shape of it

Plain HTML, CSS and JavaScript. **No framework, no build step, no runtime
dependencies, no bundler, no transpiler.** Every `.html` file in the repository
is served exactly as it appears here. The only dev dependency is `jsdom`, used
to run the tests.

That is a deliberate constraint rather than an accident of inexperience. A
student publication outlives the student who built it, and a toolchain that
needs maintaining is the thing that rots first.

```
18  reader pages        index, news, sports, article, search, tag, staff …
10  editor pages        editor-content, editor-brand, editor-sports …
15  stores              *-store.js — the data layer
 6  content files       articles.js, teams.js, writers.js, videos.js …
24  test suites         tests/suites/*.test.mjs
```

## How a page boots

Scripts load in order and each layer depends on the one before it. From a
reader page:

```
storage.js          quota-safe localStorage wrapper, image downscaling
schedule.js         is this item live yet?
config.js           WL_CONFIG — the paper's name, colours, fonts, endpoints
brand-store.js      per-browser overrides of config
published-content.js  WL_PUBLISHED — the committed snapshot (see below)
content-bundle.js   applies WL_PUBLISHED into localStorage
brand.js            paints the masthead, footer, fonts, colours
sections-store.js   which sections exist
story-url.js        WL_storyHref / WL_rootHref — URL helpers, see the trap below
nav.js              builds the section navigation
articles.js         WL_ARTICLES — the shipped articles
articles-store.js   reads/writes articles
…                   the rest of the stores and their content files
section.js          renders whatever page this is
auth.js             reads WL_CONTEXT, shows or hides editor chrome
text-editor.js      inline copy editing (?edit=1)
layout-editor.js    drag-to-rearrange blocks
```

Nothing is lazy-loaded and nothing is async. A page is finished when its
scripts have run.

## Where content comes from

Three layers, applied in this order:

1. **`articles.js` and friends** — the shipped defaults, committed to the repo.
2. **`published-content.js`** — a snapshot an editor published. On load,
   `content-bundle.js` writes its contents into `localStorage`.
3. **`localStorage`** — this browser's edits, the live state the stores read.

So `WLArticles.getAll()` is the shipped set, minus anything deleted, overlaid
with anything edited:

```js
function getAll() {
  const base = window.WL_ARTICLES || {};
  const custom = readJSON(LS_CUSTOM, {});
  const deleted = readJSON(LS_DELETED, []);
  // base, minus deleted, overlaid with custom
}
```

**This is the seam you would replace.** Point the stores at an API instead of
`localStorage` and everything above them is unchanged — see FINALSITE.md § 4.

## The store pattern

All 15 stores look the same. Each owns some `wl_*` keys, exposes CRUD, and
fires a DOM event when it changes:

```js
document.dispatchEvent(new CustomEvent("wl-articles-change"));
```

Renderers listen for those events and redraw. The full set:

```
wl-articles-change     wl-sections-change   wl-staff-change    wl-teams-change
wl-videos-change       wl-centerspread-change  wl-puzzles-change  wl-games-change
wl-features-change     wl-writers-change    wl-tags-change     wl-layout-change
wl-brand-change        wl-text-change       wl-auth-change     wl-sync-change
```

If you add a store, fire an event from every writer. If you add a renderer,
listen for the events it depends on. That is the whole convention.

## Generated story pages — read this before touching URLs

`stories/<id>.html` is one real page per article, written by
`setup/build-stories.mjs` with the headline, description and photo already in
the markup.

They exist because **no link preview runs JavaScript.** `article.html?id=…`
fills in its own title after loading, so a story pasted into a group chat
previewed as the name of the paper and nothing else.

**The trap:** those pages live one directory down, and anything built at
runtime is written relative to the site root. From `stories/` a bare
`news.html` resolves to `stories/news.html`, which does not exist. This
produced five separate bugs — the navigation, tag links, article photos, the
masthead flourish, and the stored layout.

So: **any URL constructed in JavaScript goes through `WL_rootHref()`** (in
`story-url.js`), which adds the `../` when it is needed and leaves absolute,
`data:`, `mailto:` and anchor URLs alone.

```js
img.src = WL_rootHref(a.photo);                       // right
html += `<a href="${WL_rootHref("search.html")}">`;   // right
img.src = a.photo;                                    // breaks on story pages
```

Three things that do **not** need it: static markup (the build rewrites it),
CSS `url()` (resolved against the stylesheet, not the page), and
`WL_storyHref()` (which already handles it).

The `stories` test suite checks every link and image on a generated page
resolves, and that tag links and the article photo were among what it checked.

## Reader pages and editor pages

Reader pages render content. Editor pages (`editor-*.html`) write it, and are
reachable only when `WLAuth.isEditor()` is true — which comes from
`window.WL_CONTEXT`, which the host sets. The site never authenticates anyone.

**What the role does is show and hide buttons.** It is not a security boundary
and was not designed as one; every real save has to be authorised server-side.
This is stated the same way in FINALSITE.md, and it is the single most
important sentence in this repository.

## Tests

```bash
npm test              # all 24 suites
npm test articles     # one suite
```

They run in `jsdom` and drive the real DOM — clicking buttons and typing into
fields rather than calling internals — so they fail when a user-visible thing
breaks rather than when an implementation detail moves.

When you fix a bug, the convention here is to check the new test **fails
without the fix**. Several tests in this repo passed while the thing they
claimed to cover was broken, because they tested a page in a state where the
broken thing did not render.

## Generators

Not a build step — they write files you commit.

```bash
npm run stories    # regenerate stories/ from articles.js
npm run brand      # stamp the paper's name into every <head>, then stories
npm run serve      # a local static server on :8000
```

`setup/build-demo.mjs` is scaffolding for the hosted preview only: it strips
shared-editing credentials and switches tags on. It is not part of the
platform.

## Where to change things

| To change | Edit |
|---|---|
| The paper's name, colours, fonts, contacts | `config.js` |
| Which sections exist | the Sections editor, or `sections-store.js` defaults |
| How an article page is laid out | `article.html`, then `npm run stories` |
| How a section page renders cards | `section.js` |
| The home page | `home.js` and `index.html` |
| The data layer (to a server) | the 15 `*-store.js` files — see FINALSITE.md § 4 |
| Identity | nothing here; the host sets `WL_CONTEXT` |

## Things that will surprise you

- **`applyPublished()` rejects a bundle whose `format` it does not recognise,
  and returns silently.** A malformed published file is served, ignored, and
  looks fine. Check `content-bundle.js` for the current format string.
- **Tags ship switched off.** A paper that does not want them should not have
  to remove them, so `WLTags.isEnabled()` is false until an editor turns it on.
  Code that reads tags must go through `WLTags.visibleFor()`.
- **Layouts are stored per page, keyed by filename**, overridable with
  `data-layout-page` on `<body>`. Story pages set it to `article` so they share
  the article layout rather than 25 private ones.
- **`responsive.css` loads after the per-page `<style>` blocks**, so at equal
  specificity it wins. A rule that looks like it should apply and does not is
  usually this.
- **Scheduled items are filtered at read time**, not at write time. Anything
  with a future `publishAt` is invisible to readers but present in the data.
