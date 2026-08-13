// Write the configured paper name into every page's <head>.
//
//   npm run brand
//
// Why this exists: brand.js swaps the paper name in at runtime, which is fine
// for anyone looking at the site and useless for anyone who does not run
// JavaScript. Link previews (Slack, iMessage, Messenger), search crawlers and
// RSS readers all read the raw HTML, so they saw the template's placeholder
// name instead of the paper's. This stamps <title> and the og:/twitter: tags so
// the shipped markup is already correct.
//
// It is not a build step. The site serves as-is; run this only when the paper
// name or school in config.js changes. tests/suites/pages.test.mjs fails if the
// two ever drift apart, so a forgotten run does not go unnoticed.
//
// Each page records what it was stamped with on <html data-wl-name/-school>.
// brand.js reads that back as the string to substitute when an editor renames
// the paper from the Design tab, so renaming still works after stamping.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SITE = path.resolve(fileURLToPath(import.meta.url), "../..");

// What the pages ship with before anyone stamps them.
export const PLACEHOLDER_NAME = "The Student Times";
export const PLACEHOLDER_SCHOOL = "Your School";

export function readConfig(site = SITE) {
  const src = fs.readFileSync(path.join(site, "config.js"), "utf8");
  const window = {};
  new Function("window", src)(window);
  const cfg = window.WL_CONFIG || {};
  if (!cfg.name) throw new Error("config.js has no `name`");
  return cfg;
}

const escapeAttr = s =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const escapeRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The name/school a page was last stamped with, or the shipped placeholders. */
export function baselineOf(html) {
  const tag = (html.match(/<html\b[^>]*>/i) || [""])[0];
  const pick = attr => {
    const m = tag.match(new RegExp(`${attr}="([^"]*)"`, "i"));
    return m ? m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&") : null;
  };
  return {
    name: pick("data-wl-name") || PLACEHOLDER_NAME,
    school: pick("data-wl-school") || PLACEHOLDER_SCHOOL,
  };
}

/** Rewrite one page's <head> and its baseline attributes. Returns the new HTML. */
export function stamp(html, cfg) {
  const base = baselineOf(html);
  const school = cfg.school || PLACEHOLDER_SCHOOL;

  // Substitute both the last-stamped value and the original placeholder, so
  // re-stamping is idempotent and a never-stamped page still converts.
  const swap = text => {
    let out = text;
    for (const from of new Set([base.name, PLACEHOLDER_NAME])) {
      out = out.replace(new RegExp(escapeRe(from), "g"), () => cfg.name);
    }
    for (const from of new Set([base.school, PLACEHOLDER_SCHOOL])) {
      out = out.replace(new RegExp(escapeRe(from), "g"), () => school);
    }
    return out;
  };

  // Only the <head>. Body scripts keep the placeholder literal on purpose —
  // they are runtime-only, no crawler sees them, and brand.js still swaps them.
  let out = html.replace(/<head>[\s\S]*?<\/head>/i, head => swap(head));

  // The masthead flourish. brand.js swaps this at runtime from cfg.ornament,
  // but the src sits in static markup on 25 pages, so before scripts run the
  // browser requests whichever file the pages happened to ship with — a 404 for
  // any school that removed the template's default, and the wrong art for one
  // that replaced it. Point it at the configured file up front. No baseline is
  // needed: the attribute is addressed directly rather than matched on value.
  const ornament = typeof cfg.ornament === "string" ? cfg.ornament : (cfg.ornament || {}).file;
  if (ornament && /\.(svg|png|jpe?g|webp|avif)$/i.test(ornament)) {
    out = out.replace(
      /(<div class="masthead-ornament[^"]*"[^>]*>\s*<img\s+src=")[^"]*(")/gi,
      (_m, before, after) => before + escapeAttr(ornament) + after
    );
  }

  // Record what we just stamped with.
  out = out.replace(/<html\b[^>]*>/i, tag => {
    const cleaned = tag.replace(/\s+data-wl-(name|school)="[^"]*"/gi, "");
    return cleaned.replace(
      /\s*>$/,
      ` data-wl-name="${escapeAttr(cfg.name)}" data-wl-school="${escapeAttr(school)}">`
    );
  });

  return out;
}

export function pagesIn(site = SITE) {
  return fs.readdirSync(site).filter(f => f.endsWith(".html")).sort();
}

// Pages a search engine should never be offered: the dashboards, the redirect
// stubs, and the 404 itself.
const NOT_PUBLIC = /^(editor|404)/;

// Pages that are templates, not destinations. Each renders a single article,
// section, tag, team, writer or video chosen by a query string, so the bare URL
// shows an empty shell — exactly the thin content a crawler penalises.
const NEEDS_A_QUERY = new Set([
  "article.html", "section.html", "tag.html", "team.html", "writer.html", "video.html",
]);

/** The public pages, in the order a reader would meet them. */
export function publicPages(site = SITE) {
  const first = ["index.html"];
  const rest = pagesIn(site).filter(p => !NOT_PUBLIC.test(p) && !first.includes(p));
  return first.concat(rest);
}

/** The public pages that are worth listing in a sitemap on their own. */
export function indexablePages(site = SITE) {
  return publicPages(site).filter(p => !NEEDS_A_QUERY.has(p));
}

/**
 * A sitemap needs absolute URLs, and only the school knows its own domain, so
 * this is generated from `config.js → siteUrl` rather than committed with
 * somebody else's address baked in. No siteUrl means no sitemap — better than
 * one pointing at the wrong site.
 *
 * Article pages are deliberately absent: every story is `article.html?id=…`,
 * so there is no per-story URL to list. Fixing that means emitting real HTML
 * per article, which is a bigger change than this file.
 */
export function sitemapXml(cfg, site = SITE) {
  const base = String(cfg.siteUrl || "").trim().replace(/\/+$/, "");
  if (!base) return null;
  const urls = indexablePages(site).map(p => {
    const loc = p === "index.html" ? base + "/" : base + "/" + p;
    const priority = p === "index.html" ? "1.0" : "0.6";
    return `  <url>\n    <loc>${escapeAttr(loc)}</loc>\n    <priority>${priority}</priority>\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!-- Generated by \`npm run brand\` from config.js → siteUrl. Do not hand-edit. -->\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

/** robots.txt, with the sitemap line pointed at the configured domain. */
export function robotsTxt(cfg, site = SITE) {
  const base = String(cfg.siteUrl || "").trim().replace(/\/+$/, "");
  const blocked = pagesIn(site).filter(p => NOT_PUBLIC.test(p)).map(p => `Disallow: /${p}`);
  return `# Generated by \`npm run brand\`. Do not hand-edit.\n` +
    `#\n# The dashboards are noindex'd per-page as well; they are listed so a\n` +
    `# crawler does not spend its budget on pages only editors can use.\n` +
    `User-agent: *\nAllow: /\n${blocked.join("\n")}\n` +
    (base ? `\nSitemap: ${base}/sitemap.xml\n` : "");
}

// Running directly (rather than being imported by the tests) stamps the site.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cfg = readConfig();
  let changed = 0;
  for (const page of pagesIn()) {
    const file = path.join(SITE, page);
    const src = fs.readFileSync(file, "utf8");
    const out = stamp(src, cfg);
    if (out !== src) { fs.writeFileSync(file, out, "utf8"); changed++; }
  }
  console.log(`Stamped "${cfg.name}" / "${cfg.school || ""}" into ${changed} of ${pagesIn().length} pages.`);

  fs.writeFileSync(path.join(SITE, "robots.txt"), robotsTxt(cfg), "utf8");
  const xml = sitemapXml(cfg);
  if (xml) {
    fs.writeFileSync(path.join(SITE, "sitemap.xml"), xml, "utf8");
    console.log(`Wrote robots.txt and sitemap.xml for ${cfg.siteUrl}.`);
  } else {
    console.log(`Wrote robots.txt. No sitemap: set \`siteUrl\` in config.js to generate one.`);
  }
}
