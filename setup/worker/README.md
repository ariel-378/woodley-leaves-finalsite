# Shared editing: one paper, several editors

Without this, every editor's work lives in their own browser and reaches nobody
until someone downloads a file and commits it. With it:

- Editors see each other's work, including anything **scheduled**.
- Publishing happens on its own. Nobody clicks *Download to publish*.
- Readers still load a plain committed file, so the site stays fast and keeps
  working even if this service is down.

It runs on a **Cloudflare Worker** with a **KV** namespace. Free tier is far
more than a school paper needs.

> **Someone has to own this account.** Set it up on an address the paper keeps,
> not a personal one. A Worker nobody can sign into is how next year's staff
> loses shared editing.

---

## Setup (about 20 minutes, once)

### 1. Get the tools

```bash
npm install -g wrangler
wrangler login
```

### 2. Make the storage

```bash
cd setup/worker
wrangler kv namespace create PAPER
```

It prints an `id`. Paste it into `wrangler.toml` where it says `PASTE_KV_ID_HERE`.

### 3. Set the secrets

An **editor key** — any long random string. Everyone on the masthead will use
the same one, so treat it like a shared password, not a personal login.

```bash
wrangler secret put EDITOR_KEY
```

A **GitHub token**, so the Worker can publish for readers. Make a
[fine-grained personal access token](https://github.com/settings/tokens?type=beta)
scoped to **only your paper's repository**, with **Contents: read and write**
and nothing else.

```bash
wrangler secret put GITHUB_TOKEN
```

> The token lives here and only here. It is never sent to a browser — anyone
> who opened the dashboard could read it if it were.

### 4. Say which repo to publish to

In `wrangler.toml`, set `GITHUB_REPO` to `your-org/your-repo`, and
`ALLOWED_ORIGIN` to where the site is served from (for example
`https://yourschool.org`). Leaving the origin as `*` lets any page call the
Worker; the editor key still gates writes, but narrower is better.

### 5. Deploy

```bash
wrangler deploy
```

It prints a URL like `https://paper-content.yourname.workers.dev`.

### 6. Tell the site about it

In `config.js`:

```js
sync: {
  endpoint: "https://paper-content.yourname.workers.dev",
  key: "the same editor key you set above",
},
```

Then open the dashboard. The Publish panel should read **"Shared and up to
date."** Edit something in one browser and watch it appear in another within
about twenty seconds.

---

## What the editor key does and doesn't do

It stops a passer-by editing the paper. It is **not** per-person identity:
everyone shares it, it sits in each editor's browser, and anyone who has it can
edit. That is the same protection as a shared CMS login.

**Change it when an editor leaves**, the way you would any shared password:
`wrangler secret put EDITOR_KEY`, then update `config.js`.

**For real per-person access**, put [Cloudflare
Access](https://developers.cloudflare.com/cloudflare-one/policies/access/) in
front of the Worker and require Google sign-in on your school's domain. Then
each editor signs in as themselves and you can remove one person without
changing everybody's key.

---

## How it behaves

**Two editors at once.** Each browser sends only the keys it actually changed,
and the Worker merges them one key at a time. Two people working on different
things never overwrite each other. Two people editing the *same article* at the
same moment will still have one version win — this keeps a small newsroom out
of each other's way; it is not Google Docs.

**Offline.** Work keeps saving to the browser and goes up when the connection
returns. The panel says which state it is in.

**Publishing.** After a change the Worker commits `published-content.js` to the
repo, at most once every two minutes so the history is not one commit per
keystroke. A failed commit never fails an editor's save — the work is already
in KV and the next write tries again.

**If the Worker goes away.** Editors fall back to working in their own browser,
exactly as before, and the last published file keeps serving readers. Nothing
is lost; shared editing simply stops until it is back.

---

## Cost

Cloudflare's free tier covers 100,000 Worker requests and 1,000 KV writes a day.
A newsroom of ten editors saving constantly does not come close.
