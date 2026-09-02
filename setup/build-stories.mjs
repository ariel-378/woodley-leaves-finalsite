// Write one real HTML page per article, so a shared link previews properly.
//
//   npm run stories        (also runs as part of `npm run brand`)
//
// WHY THIS EXISTS
//
// Every article was article.html?id=… — one page that fetched its content in
// the browser and then rewrote its own <title> and og: tags. Anything that runs
// JavaScript sees the right thing. Nothing that generates a link preview runs
// JavaScript. So pasting a story into a group chat, iMessage or Slack produced
// the paper's name, no headline and no photo, for every story ever written.
//
// For a school paper the group chat IS the distribution, so that was not a
// cosmetic bug — it was the paper being unshareable.
//
// This writes stories/<id>.html for each article: the same page, with the
// article's real title, description and image already in the markup, and its id
// baked in so article.html renders it without a query string.
//
// It is NOT a build step. The site still serves as-is; this is a script you run
// when the articles change, exactly like `npm run brand`. tests/suites/stories
// fails if the pages are stale, so forgetting is caught rather than shipped.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SITE = path.resolve(fileURLToPath(import.meta.url), "../..");
export const OUT_DIR = "stories";

/** Read a `window.WL_*` data file the way a browser would. */
function readGlobals(file, site = SITE) {
  const p = path.join(site, file);
  if (!fs.existsSync(p)) return {};
  const window = {};
  try { new Function("window", fs.readFileSync(p, "utf8"))(window); } catch { return {}; }
  return window;
}

/**
 * Every article a reader could reach, published content layered over the
 * shipped defaults — the same precedence the site itself applies.
 */
export function articles(site = SITE) {
  const base = readGlobals("articles.js", site).WL_ARTICLES || {};
  const out = { ...base };
  const pub = readGlobals("published-content.js", site).WL_PUBLISHED;
  const custom = pub && pub.data && pub.data.wl_articles_custom;
  if (custom) {
    const parsed = typeof custom === "string" ? JSON.parse(custom) : custom;
    Object.assign(out, parsed);
  }
  const deleted = pub && pub.data && pub.data.wl_articles_deleted;
  if (deleted) {
    const list = typeof deleted === "string" ? JSON.parse(deleted) : deleted;
    (Array.isArray(list) ? list : []).forEach(id => { delete out[id]; });
  }

  // A story scheduled for Friday must not get a Friday headline sitting in a
  // public file on Tuesday. On the live site the schedule is enforced in the
  // browser, but a generated page puts the headline, deck and photo into the
  // markup, where anyone who guesses the URL — or any crawler that finds it —
  // can read it without running a line of JavaScript. Embargoed means embargoed.
  //
  // This uses the site's own rule rather than a second copy of it, so the two
  // can never disagree about what is published.
  const schedule = readGlobals("schedule.js", site).WLSchedule;
  if (schedule && typeof schedule.isLive === "function") {
    for (const id of Object.keys(out)) {
      if (!schedule.isLive(out[id])) delete out[id];
    }
  }

  return out;
}

const esc = s => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A description for the preview: the deck, else the opening of the story. */
function summarise(a) {
  const text = (a.deck || (Array.isArray(a.body) ? a.body[0] : a.body) || "").toString().trim();
  return text.length > 200 ? text.slice(0, 197).trimEnd() + "…" : text;
}

/** Absolute where we can manage it — relative image paths do not preview. */
function imageFor(a, siteUrl) {
  const src = (a.photo || "").trim();
  if (!src) return "";
  if (/^(https?:|data:)/i.test(src)) return src;
  return siteUrl ? siteUrl.replace(/\/+$/, "") + "/" + src.replace(/^\/+/, "") : src;
}

/**
 * The story page is article.html with its <head> rewritten and its id baked in.
 * Reusing the page rather than templating a new one means these cannot drift
 * apart as the article page changes.
 */
export function storyPage(template, id, a, cfg) {
  const siteUrl = String(cfg.siteUrl || "").trim().replace(/\/+$/, "");
  const title = `${a.title} — ${cfg.name}`;
  const desc = summarise(a);
  const img = imageFor(a, siteUrl);
  const canonical = siteUrl ? `${siteUrl}/${OUT_DIR}/${id}.html` : "";

  let head = template.slice(template.indexOf("<head>"), template.indexOf("</head>"));

  const set = (pattern, replacement) => { head = head.replace(pattern, replacement); };
  set(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  set(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(desc)}">`);
  set(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${esc(a.title)}">`);
  set(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${esc(desc)}">`);
  // A photo tag with no photo is worse than none: some readers show an empty
  // frame where the image would be. Drop the tag when there is no image.
  set(/<meta property="og:image" content="[^"]*"\s*\/?>\n?/,
      img ? `<meta property="og:image" content="${esc(img)}">\n` : "");
  set(/<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${esc(a.title)}">`);
  set(/<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${esc(desc)}">`);
  set(/<meta name="twitter:image" content="[^"]*"\s*\/?>\n?/,
      img ? `<meta name="twitter:image" content="${esc(img)}">\n` : "");
  // summary_large_image asks for a big photo. Without one it renders as a
  // blank banner above the headline, so ask for the text-only card instead.
  if (!img) {
    set(/<meta name="twitter:card" content="[^"]*"\s*\/?>/,
        `<meta name="twitter:card" content="summary">`);
  }

  if (canonical) {
    head += `<link rel="canonical" href="${esc(canonical)}">\n`;
    head += `<meta property="og:url" content="${esc(canonical)}">\n`;
  }
  // Read by article.html instead of ?id=, so the URL stays clean.
  head += `<script>window.WL_ARTICLE_ID = ${JSON.stringify(id)};</script>\n`;

  let page = template.slice(0, template.indexOf("<head>")) + head + template.slice(template.indexOf("</head>"));

  // The page now lives one directory down. Rewrite relative references rather
  // than using <base href="../">, which would also send in-page anchors like
  // the skip link off to the site root.
  page = page.replace(/\b(src|href)="(?!https?:|mailto:|data:|#|\/)([^"]+)"/g,
    (m, attr, url) => `${attr}="../${url}"`);

  return page;
}

/** Article ids that would collide with a real page at the site root. */
function collisions(ids, site) {
  const roots = new Set(fs.readdirSync(site).filter(f => f.endsWith(".html")).map(f => f.replace(/\.html$/, "")));
  return ids.filter(id => roots.has(id));
}

const BEGIN = "/* BEGIN GENERATED — setup/build-stories.mjs rewrites this */";
const END = "/* END GENERATED */";

/** Rewrite the id list inside story-url.js. Returns true if the file changed. */
function writeManifest(site, ids) {
  const file = path.join(site, "story-url.js");
  const current = fs.readFileSync(file, "utf8");
  const start = current.indexOf(BEGIN);
  const end = current.indexOf(END);
  if (start === -1 || end === -1) {
    // Refuse rather than guess: a silently unwritten manifest means every link
    // quietly falls back, and nobody would notice until previews stayed broken.
    throw new Error("story-url.js has no generated region — cannot record story pages");
  }
  const body = ids.map(id => `  ${JSON.stringify(id)},`).join("\n");
  const next = current.slice(0, start + BEGIN.length) + "\n" + body +
               (body ? "\n  " : "  ") + current.slice(end);
  if (next === current) return false;
  fs.writeFileSync(file, next, "utf8");
  return true;
}

export function build(site = SITE) {
  const cfg = (() => {
    const window = {};
    new Function("window", fs.readFileSync(path.join(site, "config.js"), "utf8"))(window);
    return window.WL_CONFIG || {};
  })();

  const template = fs.readFileSync(path.join(site, "article.html"), "utf8");
  const all = articles(site);
  const ids = Object.keys(all);

  const clash = collisions(ids, site);
  if (clash.length) {
    // Refuse rather than overwrite a real page with a story.
    throw new Error(`article id(s) collide with site pages: ${clash.join(", ")}`);
  }

  const dir = path.join(site, OUT_DIR);
  fs.mkdirSync(dir, { recursive: true });

  // Remove pages for articles that no longer exist, so a deleted story stops
  // being reachable rather than lingering at its old URL.
  const wanted = new Set(ids.map(id => `${id}.html`));
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith(".html") && !wanted.has(f)) fs.unlinkSync(path.join(dir, f));
  }

  let written = 0;
  for (const id of ids) {
    const page = storyPage(template, id, all[id], cfg);
    const file = path.join(dir, `${id}.html`);
    const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    if (existing !== page) { fs.writeFileSync(file, page, "utf8"); written++; }
  }
  // Record which stories have a page, so a link is never made to one that does
  // not exist yet. See the note at the top of story-url.js.
  const manifest = writeManifest(site, ids);

  return { total: ids.length, written, manifest, siteUrl: String(cfg.siteUrl || "").trim() };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { total, written, siteUrl } = build();
  console.log(`Story pages: ${total} article(s), ${written} written or updated in ${OUT_DIR}/.`);

  // A link preview is built by a machine that fetched one page and will not
  // resolve a relative image against anything. Without siteUrl the headline and
  // description still work, but the photo does not — which is most of what makes
  // a shared story look like a story. Say so rather than quietly shipping it.
  if (!siteUrl) {
    console.log("");
    console.log("  Note: config.js has no siteUrl, so og:image is a relative path.");
    console.log("  Headlines and descriptions will preview correctly; the photo may not.");
    console.log("  Set siteUrl to the address the paper is published at, then re-run this.");
  }
}
