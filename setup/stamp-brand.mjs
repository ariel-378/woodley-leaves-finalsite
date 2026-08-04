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
}
