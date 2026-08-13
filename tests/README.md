# Tests

```bash
npm install     # once — pulls jsdom, the only dependency
npm test        # run everything
node tests/run.mjs sports articles    # run named suites
```

The site itself has **no build step and no runtime dependencies**. jsdom is a dev
dependency used only here, to load real pages and drive them the way an editor
would: clicking buttons and typing into fields, not calling internals. If a test
passes, that click path genuinely works.

## Suites

| Suite | What it covers |
|---|---|
| `pages` | Every page loads and renders without throwing — readers signed out, dashboards signed in |
| `interact` | Presses every control on every editor page, three passes, and requires nothing to throw |
| `lint` | Static checks: constants referenced but never declared, and stray `console.log` |
| `articles` | Writing an article inline, and managing it from its section card |
| `sports` | Teams, brackets, scheduled games, per-block visibility |
| `content` | Sections, content types, puzzles, poems, art, reveal items, videos |
| `reader` | Editor changes reaching public pages — and staying off them when hidden or scheduled |
| `a11y` | Keyboard and screen-reader paths through the core tasks: reading an article, and filing one |
| `layout` | The in-place layout editor on every page that offers it, driven for real rather than asserted from markup |
| `security` | Editor-pasted HTML/CSS/JS cannot reach the host page — no cookies, no storage, no DOM — plus escaping of reader-visible text |
| `bundle` | The content bundle: it captures content, ignores per-device keys, and reloads to the same state |
| `custom` | Custom games and custom features share one form but must never share a destination |
| `subscribe` | The Subscribe button end to end, and the Newsletter panel — including never reporting a signup that wasn't recorded |
| `favicon` | The tab icon: drawn letters, an uploaded image, and an export whose filenames match the files it downloads |
| `storage` | Uploads are shrunk before they are stored, and a full browser says so instead of losing the change silently |
| `publish` | The whole point: a story with a photo goes editor → published file → a stranger's browser, and renders |
| `crossword` | Actually playing the mini, on a keyboard and on a phone: direction on click, one letter per keypress, arrows, backspace, the controls |
| `ownership` | A new section starts empty — content belongs to one section, in the dashboard and on the public page |
| `schedule` | Every kind of content can be dated forward: hidden from readers, marked in the dashboard, one shared rule |
| `upcoming` | The Schedule tab: every store gathered into one list, in the order it goes out, and publishing early |
| `sync` | Shared editing: only your own changes go up, incoming ones never clobber unsent work, offline survives |

## Why these exist

Several suites grew out of a real bug that shipped unnoticed, because each only
broke on a path nobody had clicked:

- **`lint`** — `articles-store.js` called `localStorage.removeItem(LS_FEATURED)`,
  but the constant is `LS_FEATURED_MAP`. "Reset all changes" threw halfway
  through, so featured picks were never cleared and the dashboard never
  refreshed. It parses fine; only running that branch reveals it.
- **`interact`** — the bracket editor indexed `workingRounds[r]` with no
  existence check and read the index off `e.target` rather than
  `e.currentTarget`. A stale row threw, and because the throw escaped the
  handler it took the rest of the modal's wiring down with it.
- **`articles`** — an article whose section was renamed away belonged to no
  card and vanished from the dashboard. There is now an "Unfiled" card, and a
  test that keeps it honest.
- **`storage`** — uploads were stored at full size as base64. One phone photo
  is ~5.4MB encoded, more than the entire ~5MB budget, and of the twenty-one
  files that wrote to storage exactly one handled the quota error. Everywhere
  else the write threw into nothing and the change was gone.
- **`crossword`** — two bugs nobody could have seen from a rendering test. The
  grid opens with the top-left square selected, and a click on the
  already-selected square toggles direction — so a reader's first click flipped
  them into Down and the answer they typed for 1 Across went down the column.
  And the grid and the document both listened for `keydown` and both called the
  same handler, so a bubbled event was handled twice: one letter typed put two
  in the grid. Every other suite loaded the centerspread and checked it didn't
  throw, which it never did. A third followed: the grid is made of divs, and
  focusing a div opens no keyboard on a phone — so every square could be tapped
  and no letter could ever be typed.
- **`ownership`** — sections listed everything of a declared type in the whole
  paper, so a new section arrived pre-filled with another section's work: tick
  Puzzle games and the Centerspread's crossword, bee, Connections and word
  search appeared as yours, Delete buttons and all. Articles never had the
  problem because they carry their section and the dashboard filters on it.
- **`schedule`** — articles could be dated forward and nothing else could, so
  an edition could not be built ahead of time: a poem, a photo, a video or a
  game went live the instant it was saved. Worse, the rule for "is this live?"
  existed only inside articles-store, where nothing else could reach it.
- **`sync`** — the obvious design for shared editing ("send everything I have")
  silently destroys work: two editors both push a full snapshot and whoever
  saves second erases what the first added. These pin the two rules that stop
  it — push only what this browser changed, and never let an incoming key
  overwrite an edit that has not been sent yet.
- **`publish`** — the editor and the reader were only ever tested in the same
  browser, where `localStorage` does the work. The step between them — the file
  an editor downloads and commits — had never been run at all.
- **`favicon`** — an uploaded tab icon was exported into `config.js` as
  `media/favicon-upload`, with no extension for `brand.js` to read a type from,
  and the image was never downloaded at all. Every step reported success; a
  school following it got a config pointing at a file that did not exist.

## Adding a suite

Drop a `<name>.test.mjs` into `suites/` exporting `run()`, which returns a
`Check`:

```js
import { loadPage, Check } from "../harness.mjs";

export async function run() {
  const check = new Check();
  const ctx = await loadPage("editor-content.html");   // signed in as editor
  check.ok("something is true", condition, "detail shown on failure");
  check.equal("values match", actual, expected);
  check.clean("nothing threw", ctx);
  return check;
}
```

`loadPage` returns `{ window, document, errors, $, $$, click, type, pick }`.
`errors` accumulates anything thrown during load *and* during later
interaction, which is what `check.clean` inspects.

## Two things worth knowing

**Seed your own content.** `newspaper-template` ships with zero articles by
design. Any test that needs article rows must create them — `seedArticles(window)`
does it, and no-ops when the site already has content.

**A passing test proves nothing until you've seen it fail.** Both regression
tests above were verified by reintroducing the original bug and confirming the
suite goes red. Worth doing for anything new.
