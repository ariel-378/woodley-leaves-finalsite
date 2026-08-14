# Newspaper Platform — Finalsite Integration Guide

A framework-free (vanilla HTML/CSS/JS) student-newspaper website. It runs as a set
of static pages with a client-side data layer, an in-app editor dashboard, and a
brand-config file. It is designed to be dropped into a host platform such as
**Finalsite**, which supplies **authentication, the "who is an editor" decision,
and (in production) content persistence**.

This document explains:

1. How the site is structured.
2. How it plugs into Finalsite (the identity contract).
3. **The editors-group logic** — how a Finalsite group becomes an in-app editor.
4. A **detailed, phased plan** for Finalsite engineers to integrate this code with
   their own software.

---

## 1. Architecture at a glance

| Layer | What it is | Files |
|-------|-----------|-------|
| **Pages** | One static `.html` per surface (home, section pages, article, editor dashboard, etc.). No build step, no framework. | `index.html`, `news.html`, `article.html`, `section.html`, `editor*.html`, … |
| **Brand config** | The only file that changes per school: name, colors, logo, footer. Applied to every page by `brand.js`. | `config.js` (`window.WL_CONFIG`) |
| **Content source** | Plain JS objects on `window` (`WL_ARTICLES`, `WL_WRITERS`, `WL_TEAMS`, `WL_VIDEOS`, …). "Have your CMS emit this object." | `articles.js`, `writers.js`, `teams.js`, `videos.js`, … |
| **Data stores** | A thin CRUD layer per content type that **merges the static source with editor changes** and exposes `getAll/save/remove/...`. This is the seam to redirect at for production persistence. | `articles-store.js`, `sections-store.js`, `teams-store.js`, … |
| **Identity adapter** | Resolves the current user + role, renders the account bar, and gates editor tools. | `auth.js` (`window.WLAuth`) |
| **Editor tools** | The dashboard (`editor.html`) + per-domain editors, plus inline text/layout editing on public pages. Only shown to editors. | `editor*.html`, `text-editor.js`, `layout-editor.js` |

**Key idea:** the app never authenticates anyone itself. It reads an identity that
the host injects, and it reads/writes content through the store layer. Both of
those are the integration points for Finalsite.

---

## 2. The identity contract (`window.WL_CONTEXT`)

Before `auth.js` runs, the host injects a single global describing the signed-in
member. `auth.js` **trusts it verbatim**:

```html
<!-- Finalsite emits this, server-side, as the FIRST script in <head> -->
<script>
  window.WL_CONTEXT = {
    signedIn: true,
    user: { name: "Jane Doe", id: "jdoe" },
    role: "editor"        // "editor" for newspaper staff, "reader" for everyone else
  };
</script>
```

Rules (`auth.js`):

- `HOSTED = !!(WL_CONTEXT && WL_CONTEXT.signedIn)`. When true, the host is the sole
  source of truth.
- `role === "editor"` unlocks the editor experience. **Any other value → reader.**
- The display name is `user.name`, falling back to `user.id`, then `"Member"`.
- **When hosted, all in-app sign-in/sign-out UI is suppressed.** Logging in and out
  is Finalsite's job; the app shows only the member's name (and, for editors, a link
  to the dashboard).
- If `WL_CONTEXT` is absent, the app falls back to **standalone/demo mode**
  (per-browser localStorage accounts + a one-click "Editor preview"). This mode is
  for local development only and never appears in production.

**Injection ordering:** `WL_CONTEXT` must be defined before `auth.js` executes.
`auth.js` loads near the bottom of each page, but the safe, future-proof placement
is the **very first `<script>` in `<head>`**, above `config.js`.

### Who can *see* the paper

Visibility ("students & faculty only") is **not** enforced by this code. It is a
**Finalsite page-audience restriction** on the pages/section that host the site.
The app assumes that anyone who can load a page is allowed to read it.

---

## 3. Editors-group logic

This is the heart of the integration. The app has a **binary role**: a member is
either an **editor** (full dashboard + inline editing) or a **reader** (read-only).
That single bit comes entirely from Finalsite.

### 3.1 The mapping

1. A school administrator maintains a Finalsite **group** — e.g. **"Newspaper
   Editors"** (or a role/permission set, whichever Finalsite construct fits).
2. Newspaper staff (editors-in-chief, section editors, advisers) are added to that
   group. Everyone else in the community is not.
3. When Finalsite renders a page for a signed-in member, it checks group membership
   and emits:

   ```js
   role: memberIsInGroup("Newspaper Editors") ? "editor" : "reader"
   ```

4. The app reads `WL_CONTEXT.role` and behaves accordingly. **Group membership _is_
   the authorization** — there is no second in-app check, no editor password, no
   invite code.

```
Finalsite "Newspaper Editors" group  ──►  WL_CONTEXT.role = "editor"  ──►  editor tools unlocked
everyone else (authenticated reader)  ──►  WL_CONTEXT.role = "reader"  ──►  read-only
```

### 3.2 What the editor role unlocks

| Surface | Gate (in code) | Reader sees |
|---------|----------------|-------------|
| Editor Dashboard (`editor.html`) and every `editor-*.html` tab (articles, sections, sports, videos, writers, brand, centerspread) | `if (!user || !WLAuth.isEditor()) { …deny… }` | An "editor access required" notice; no dashboard |
| **Sections management** (add / rename / reorder / remove sections; choose which section fills each home-page slot) | inside the gated dashboard | n/a |
| Inline **text** editing on public pages (kickers, decks, datelines) | `WLAuth.isEditor()` in `text-editor.js` | Static text, no edit affordances |
| Inline **layout** editing (reorder page modules) | `WLAuth.isEditor()` in `layout-editor.js` | Fixed layout |
| Per-article **Feature / Delete**, comment moderation, etc. | `WLAuth.isEditor()` | Not rendered |

The account bar (`auth.js → renderTopbar`) shows editors an **"Editor Dashboard"**
link; readers see only their name.

### 3.3 Finer-grained roles (optional, future)

Today the role is a single flag. If the paper later needs **section-scoped editors**
(e.g. a Sports editor who can only touch Sports) or an **adviser/approver** tier,
extend the contract with an additional field, e.g.:

```js
role: "editor",
editorScopes: ["Sports", "Features"]   // optional; app would filter the dashboard
```

The app would need small changes to honor `editorScopes`; the identity contract is
designed to grow this way without breaking the binary `role`.

---

## 4. Content & persistence integration

This is the second integration point, and the one that needs the most engineering.

### 4.1 How it works today

- **Read:** each content type is a `window.WL_*` object baked into a `.js` file
  (`articles.js`, etc.). Section pages, the home page, and search read through the
  store layer, which merges that base object with edits.
- **Write:** the in-app editor writes to **`localStorage`** (keys prefixed `wl_`)
  via the store layer. Each store keeps a `*_custom` map (edits + new items) and a
  `*_deleted` list, and `getAll()` returns `base − deleted + custom`.

`localStorage` is **per-browser**: perfect for a self-contained demo, but in
production an editor's changes would live only in that editor's browser — invisible
to readers and to other editors. **Production must move persistence server-side.**

### 4.2 The seam

Every store follows the same tiny contract, so there is exactly **one place per
content type** to redirect:

```js
window.WLArticles = (function () {
  function getAll() { /* base (WL_ARTICLES) merged with stored edits */ }
  function getById(id) { … }
  function bySection(section) { … }
  function save(id, data) { /* persists an edit/new item, fires wl-articles-change */ }
  function remove(id) { … }
  // …
})();
```

Replacing the `localStorage` read/write inside these functions with Finalsite API
calls integrates the whole app — the pages and the editor UI keep working unchanged,
because they only ever talk to `WLArticles`, `WLSections`, etc.

Stores to wire: `articles-store`, `sections-store`, `writers-store`, `teams-store`,
`videos-store`, `centerspread-store`, `puzzles-store`, `views-store`,
`brand-store`, plus the editable static text (`wl_text_custom`).

### 4.3 Three integration models

| Model | Read path | Write path | Best when |
|-------|-----------|-----------|-----------|
| **A. CMS-native** | Finalsite emits the `WL_*` globals server-side from its own CMS | Editors use **Finalsite's** editing UI; the in-app dashboard is disabled | You want one CMS of record and minimal custom backend |
| **B. App-editor + API** | `WL_*` globals emitted from published content (or fetched) | Store layer's `save/remove` call **Finalsite REST/GraphQL** endpoints; server authorizes | You want to keep this app's tailored editor UX |
| **C. Hybrid / draft-publish** | Published content emitted server-side | App editor writes **drafts** to the API; a publish step promotes them | You need editorial review/approval before readers see changes |

Model **A** is the least code; model **B/C** preserve the bespoke editor dashboard
(sections management, home-slot picker, etc.) that this project adds.

---

## 5. Detailed integration plan for Finalsite

A phased path from "static demo" to "fully hosted." Each phase is independently
shippable.

### Phase 0 — Decide the editing model
- Choose model **A, B, or C** (§4.3). This determines whether the in-app editor
  dashboard stays or is replaced by Finalsite's CMS.
- Confirm the Finalsite construct that represents "newspaper staff" (group, role, or
  permission set).

### Phase 1 — Identity
- Emit `window.WL_CONTEXT` server-side as the first `<script>` in `<head>` on every
  page (§2).
- Map the **"Newspaper Editors" group → `role: "editor"`**, everyone else → `reader`
  (§3.1).
- Verify: editors see the dashboard link and pass the `isEditor()` gate; readers get
  the read-only experience; no in-app sign-in/out appears.

### Phase 2 — Audience
- Apply a Finalsite **page-audience restriction** so only the intended community
  (students & faculty) can load the pages (§2). This is the real access control for
  *reading*; the app does not enforce it.

### Phase 3 — Content read path
- Model A/C: have the CMS render each `WL_*` global (published content only) into the
  page, replacing the static `articles.js`-style files.
- Model B: ship a small adapter that fetches content and assigns `window.WL_*` before
  the stores load, **or** fetch inside each store's `getAll()`.
- Keep the **shape** of each object identical to the sample data files so the render
  code needs no changes. (Field references: see `articles.js`, `sections-store.js`
  defaults, etc.)

### Phase 4 — Content write path *(only if keeping the in-app editor — model B/C)*
- Replace `localStorage` reads/writes in each `*-store.js` with API calls.
- **Authorize writes on the server.** The client `role` is a UI convenience only —
  the write endpoints must independently verify the caller is in the editors group
  (see §6). Never trust `WL_CONTEXT.role` for mutations.
- Preserve the store events (`wl-articles-change`, `wl-sections-change`, …) so open
  pages re-render after a save.
- Port the **sections model** carefully: `sections-store.js` also reassigns an
  article's `section` on rename and blocks removal of non-empty sections — replicate
  that transactionally on the server.

### Phase 5 — Media & uploads
- The editor accepts image URLs and (in demo) base64 uploads stored in the browser.
  Route uploads to Finalsite's asset/DAM store and persist the returned URLs.

### Phase 6 — Brand & config
- `config.js` (`WL_CONFIG`) drives name, school, colors, logo, favicon, footer. Emit
  it from Finalsite site settings, or keep it as a per-site file. `brand.js` applies
  it globally — no change needed if the shape is preserved.

### Phase 7 — Hardening & rollout
- Security review (§6), content sanitization, accessibility/QA pass across
  breakpoints, then enable for the community.

---

## 6. Security notes

- **The client role is a UI gate, not a security boundary.** Anyone can set
  `WL_CONTEXT.role` in their own browser. That only reveals editor *buttons*; it must
  never grant real write access. **All mutations must be authorized server-side**
  against the actual editors group.
- **`WL_CONTEXT` must be server-rendered** from the authenticated session, not
  derived from anything the client controls.
- **Audience/visibility** is enforced by Finalsite's page restriction, not the app.
- **Content rendering** escapes user/content strings (`escapeHtml`) in the app; CMS
  content should also be sanitized at the source.
- No secrets belong in this codebase; it is entirely client-side.

---

## 7. What Finalsite must provide — checklist

- [ ] Inject `window.WL_CONTEXT` (signedIn, user, role) before `auth.js`, per page.
- [ ] A group/role representing newspaper editors, mapped to `role: "editor"`.
- [ ] A page-audience restriction gating who can read the paper.
- [ ] A content read path that supplies the `WL_*` globals (published content).
- [ ] *(Model B/C)* Authenticated, **server-authorized** endpoints for the store
      layer's `save`/`remove`, honoring the sections rules.
- [ ] *(Optional)* Asset upload handling for images.
- [ ] *(Optional)* `WL_CONFIG` from site settings.

---

## Running locally (standalone/demo)

No build step. Serve the folder with any static server, e.g.:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

With no `WL_CONTEXT` present, the site runs in demo mode: use the **"Editor preview"**
link in the account bar to open the dashboard without a host platform. All editor
changes persist only in your browser's `localStorage`.
