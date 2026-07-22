# Finalsite integration guide

For the school's Finalsite administrator. It covers what the site is, the one
hook Finalsite needs to provide, and — importantly — the one decision that has
to be made before the paper can publish for real.

---

## What this is

A complete student newspaper site: section pages, articles, sports records,
videos, puzzles, search, and an editor dashboard student editors use to publish
without touching code.

- **Vanilla HTML, CSS and JavaScript.** No framework, no build step, no server.
- **No runtime dependencies.** Nothing to install, patch, or keep up to date.
- **Deploys as static files.** Upload the directory; that is the whole deploy.

There are two repositories with identical code:

| Repo | Purpose |
|---|---|
| `newspaper-template` | The reusable platform. Ships with no content. |
| `woodley-leaves` | Maret's paper. Same code, plus `config.js` and content. |

Only `config.js` and the content files differ. A fix in one applies to both.

---

## Read this first: where content lives

**This is the decision that has to be made before launch.**

Today the editor dashboard saves everything to `localStorage` — the editor's own
browser. That is ideal for a demo: open the site, click *Editor preview*, change
anything, and it persists with no backend. It is **not** how the paper can
publish for real, because an article written on one laptop is not visible to
anyone else.

Every content type is read the same way: a **base** JavaScript object shipped in
a file, with the editor's local changes layered on top.

```js
window.WL_ARTICLES = { "article-id": { title, deck, section, byline, date, body: [...] } };
```

| Content | Base file | Store |
|---|---|---|
| Articles | `articles.js` | `articles-store.js` |
| Sections | built into `sections-store.js` | `sections-store.js` |
| Sports | `teams.js` | `teams-store.js` |
| Videos | `videos.js` | `videos-store.js` |
| Puzzles & pieces | `puzzles-store.js`, `centerspread.js` | `centerspread-store.js` |
| Staff | `staff-data.js` | `staff-store.js` |

### Three ways forward

**A. Demo / pilot — no work.** Leave it as is. Editors can explore the full
dashboard and nothing they do affects anyone else. Right for evaluation, and for
showing students the workflow. Not for publishing.

**B. Finalsite emits the content files — moderate work, recommended.** Articles
are authored in Finalsite; a template or export writes `articles.js` (and the
others) in the shape above. The site then serves real content to everyone, and
the built-in editor becomes a preview tool. This keeps the site dependency-free
and keeps Finalsite the system of record. `articles.js` already carries the note
*"or have your CMS emit this object."*

**C. Point the stores at an API — most work, most flexible.** Each `*-store.js`
is a small module with a clear read/write surface. Swapping `localStorage` for
`fetch` calls against a Finalsite endpoint would let students keep using this
dashboard as the real editing tool. Roughly one module per content type; the
rest of the site needs no changes, because everything already re-renders off the
`wl-*-change` events the stores fire.

We are happy to do B or C — we need to know which fits the school's setup.

---

## The one hook Finalsite provides: identity

The site never authenticates anyone. Finalsite does, and tells the page who is
looking. Set one global **before the page's scripts run**:

```html
<script>
  window.WL_CONTEXT = {
    signedIn: true,
    user: { name: "Jane Doe", id: "jdoe" },
    role: "editor"        // "editor" or "reader"
  };
</script>
```

That is the entire contract. `auth.js` reads it and trusts it.

| Field | Meaning |
|---|---|
| `signedIn` | `true` when Finalsite has an authenticated session |
| `user.name` | Display name in the top bar; falls back to `user.id`, then `"Member"` |
| `role` | `"editor"` unlocks the dashboard. Anything else is treated as a reader. |

**Timing matters.** `WL_CONTEXT` must be set before `auth.js` executes. A block
in the page head, or anything emitted above the site's own `<script>` tags, is
fine.

### Two separate questions

1. **Who may read the paper?** Finalsite's page-audience restriction. If the
   paper is students-and-faculty-only, set that in Finalsite. The site does not
   and cannot enforce it.
2. **Who may edit?** The Finalsite role mapped to `role: "editor"`. A school
   administrator assigns it. There is no in-app promotion, no code, no password.

### If `WL_CONTEXT` is absent

The site falls back to standalone mode: an *Editor preview* link that unlocks
the dashboard for that browser only. This is how the demo works. In production
the link disappears automatically once `WL_CONTEXT` is present — `auth.js`
refuses to enable preview when hosted.

---

## Setup checklist

- [ ] Upload the site directory as static files
- [ ] Inject `WL_CONTEXT` before the site's scripts (above)
- [ ] Map the school's editor role to `role: "editor"`
- [ ] Set the page audience for who may read the paper
- [ ] Decide on content: option A, B or C above
- [ ] Edit `config.js` — masthead, school name, colours, logo, footer contacts
- [ ] Optional: set `submissions.endpoint` for reader forms (below)
- [ ] Confirm the Content-Security-Policy allows the site's inline scripts

### Branding

`config.js` is the only file that differs between the template and a school's
paper. It sets the masthead name, school, tagline, colours, ornament, favicon
and footer contacts across every page. Editors can also adjust design in the
dashboard's **Brand design** tab, but those changes are per-browser previews —
`config.js` is what every reader sees.

### Reader forms (optional)

Newsletter signups, staff signups and story pitches post to a Google Apps Script
web app, so a static site can still deliver mail. Set
`config.js → submissions.endpoint`; see `setup/README.md`. Until it is set, the
forms tell the reader they are not configured and offer a `mailto:` fallback —
they never claim a pitch was received when it was not.

If the school would rather these went to a Finalsite form endpoint, that is a
one-line change in `submissions.js`.

---

## Security notes

- **No credentials in the site.** No passwords, tokens or API keys. Identity is
  entirely Finalsite's.
- **Editor-pasted code is sandboxed.** Sections may hold custom HTML/JS written
  by an editor. It runs in an `<iframe sandbox="allow-scripts">` with no
  same-origin access, so it cannot read the page, cookies or storage.
- **The submissions endpoint is public** by nature — it ships in page source.
  Validation happens in the Apps Script; client checks only save a round trip.
- **Reader input is never trusted.** All dynamic values are escaped before
  rendering.

---

## Maintenance

```bash
npm install   # once — jsdom, used only by the tests
npm test      # 239 checks across 7 suites
```

Tests load real pages and drive them by clicking and typing, so a green run
means those paths genuinely work. See `tests/README.md`. There is nothing to
build and no dependency to keep current — `npm install` is for the test suite
alone; the site itself ships as-is.

---

## Questions we would like answered

1. Content: option **A**, **B** or **C**?
2. Which Finalsite role should map to `role: "editor"`?
3. Should reader forms go to Finalsite instead of Google Apps Script?
4. Is the paper public, or restricted to the school community?
