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

## Why these exist

Each suite grew out of a real bug that shipped unnoticed, because all three only
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
