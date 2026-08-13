/**
 * ============================================================================
 *  SHARED CONTENT STORE — a Cloudflare Worker.
 *
 *  Holds the paper's content so every editor sees the same thing, and commits
 *  it to the repo so readers get a fast static file. Two jobs:
 *
 *    GET  /content   what the paper currently holds        (editors)
 *    PUT  /content   merge one editor's changed keys in    (editors)
 *
 *  After a write it commits `published-content.js` to GitHub, so nobody ever
 *  clicks "download to publish". Readers keep loading a plain committed file —
 *  fast, and unaffected if this Worker is ever down.
 *
 *  ── WHY THE CREDENTIAL LIVES HERE ──────────────────────────────────────────
 *  The GitHub token can commit to the paper's repository. It is a Worker
 *  secret, readable only by this code — never sent to a browser. A token in the
 *  dashboard's JavaScript would be readable by anyone who opened the page.
 *
 *  ── WHAT THE EDITOR KEY IS AND IS NOT ──────────────────────────────────────
 *  X-Editor-Key gates writes. It is a shared password for the masthead, not
 *  per-person identity: anyone holding it can edit the paper, and it does sit
 *  in each editor's browser. That is the same level of protection as a shared
 *  CMS login, and it is enough to stop a passer-by editing the paper.
 *
 *  For real per-person access, put Cloudflare Access in front of this Worker
 *  and require Google sign-in on the school domain. See README.md.
 *
 *  SETUP: setup/worker/README.md
 * ============================================================================
 */

const COMMIT_DEBOUNCE_MS = 120000;   // at most one commit every two minutes
const CONTENT_KEY = "content";
const COMMIT_MARK = "last-commit";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (url.pathname !== "/content") return json({ error: "not found" }, 404, cors);

    if (request.method === "GET") {
      const stored = await env.PAPER.get(CONTENT_KEY, { type: "json" });
      return json({ version: (stored && stored.version) || 0, data: (stored && stored.data) || {} }, 200, cors);
    }

    if (request.method === "PUT") {
      if (!authorised(request, env)) return json({ error: "bad editor key" }, 403, cors);

      let body;
      try { body = await request.json(); }
      catch { return json({ error: "bad json" }, 400, cors); }

      const changes = (body && body.changes) || {};
      if (typeof changes !== "object") return json({ error: "no changes" }, 400, cors);

      const stored = (await env.PAPER.get(CONTENT_KEY, { type: "json" })) || { version: 0, data: {} };

      // Merge per key. Only what an editor actually changed is applied, so two
      // people working at once do not overwrite each other's untouched work.
      for (const [k, v] of Object.entries(changes)) {
        if (!/^wl_/.test(k)) continue;              // content keys only
        if (v === null) delete stored.data[k];
        else stored.data[k] = v;
      }
      stored.version = (stored.version || 0) + 1;
      stored.updatedAt = new Date().toISOString();
      await env.PAPER.put(CONTENT_KEY, JSON.stringify(stored));

      // Publishing for readers. Debounced: editors save constantly and the
      // repo does not need a commit per keystroke.
      let published = false;
      if (env.GITHUB_TOKEN && env.GITHUB_REPO) {
        const last = Number((await env.PAPER.get(COMMIT_MARK)) || 0);
        if (Date.now() - last > COMMIT_DEBOUNCE_MS) {
          await env.PAPER.put(COMMIT_MARK, String(Date.now()));
          try { await commitPublished(stored, env); published = true; }
          catch (e) {
            // A failed commit must not fail the editor's save — their work is
            // safely in KV and the next write will try again.
            console.error("commit failed:", e && e.message);
          }
        }
      }

      return json({ version: stored.version, published }, 200, cors);
    }

    return json({ error: "method not allowed" }, 405, cors);
  },
};

function authorised(request, env) {
  if (!env.EDITOR_KEY) return true;                 // unset = open; see README
  return request.headers.get("X-Editor-Key") === env.EDITOR_KEY;
}

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Editor-Key",
    "Access-Control-Max-Age": "86400",
  };
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** The file readers load. Same shape the dashboard's export produced. */
function publishedSource(stored) {
  const bundle = {
    format: "newspaper-content-bundle",
    version: 1,
    data: stored.data,
  };
  return "// ============================================================================\n" +
    "//  PUBLISHED CONTENT — written automatically by the shared content store.\n" +
    "//  Do not hand-edit: the next publish overwrites it.\n" +
    "//  Last updated: " + (stored.updatedAt || new Date().toISOString()) + "\n" +
    "// ============================================================================\n" +
    "window.WL_PUBLISHED = " + JSON.stringify(bundle, null, 2) + ";\n";
}

async function commitPublished(stored, env) {
  const path = env.GITHUB_PATH || "published-content.js";
  const branch = env.GITHUB_BRANCH || "main";
  const api = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "student-newspaper-sync",
    "Content-Type": "application/json",
  };

  // GitHub needs the blob sha of the file being replaced.
  let sha;
  const existing = await fetch(`${api}?ref=${encodeURIComponent(branch)}`, { headers });
  if (existing.ok) sha = (await existing.json()).sha;
  else if (existing.status !== 404) throw new Error(`read failed: ${existing.status}`);

  const res = await fetch(api, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: "content: publish editor changes",
      content: base64(publishedSource(stored)),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) throw new Error(`commit failed: ${res.status} ${await res.text()}`);
}

/** UTF-8 safe base64, which btoa alone is not. */
function base64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
