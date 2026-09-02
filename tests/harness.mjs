// Test harness.
//
// The site has no build step, so pages are loaded into jsdom exactly as a
// browser would: same-dir <script src> tags are inlined and executed for real.
// Tests then drive the page through actual clicks and input events rather than
// calling internals, so they exercise what an editor would actually do.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import jsdomPkg from "jsdom";

const { JSDOM, VirtualConsole } = jsdomPkg;

export const SITE = path.resolve(fileURLToPath(import.meta.url), "../..");

/** Read a page and inline its same-directory scripts so jsdom can run them. */
export function inlineScripts(file) {
  const html = fs.readFileSync(path.join(SITE, file), "utf8");
  // Resolve relative to the page's own directory, so a generated story page in
  // stories/ can pull in ../articles-store.js the way a browser would.
  const from = path.dirname(path.join(SITE, file));
  return html.replace(/<script src="([^":]+\.js)"[^>]*><\/script>/g, (match, src) => {
    const p = path.resolve(from, src);
    return fs.existsSync(p) ? `<script>\n${fs.readFileSync(p, "utf8")}\n</script>` : "";
  });
}

/**
 * Read a page and inline its stylesheets, in the order the page links them, so
 * jsdom resolves the real cascade. Scripts are left alone — this is for asking
 * "which rule won?", not for driving the page.
 */
export function inlineStyles(file) {
  const html = fs.readFileSync(path.join(SITE, file), "utf8");
  return html.replace(/<link rel="stylesheet" href="([^"/:]+\.css)"[^>]*\/?>/g, (match, href) => {
    const p = path.join(SITE, href);
    return fs.existsSync(p) ? `<style>\n${fs.readFileSync(p, "utf8")}\n</style>` : "";
  });
}

/** Every .html file in the site root. */
export function pages() {
  return fs.readdirSync(SITE).filter(f => f.endsWith(".html")).sort();
}

/**
 * Load a page in jsdom.
 *
 * opts.editor   sign in as an editor (most dashboards are gated)
 * opts.confirm  what window.confirm returns (default true)
 * opts.storage  extra localStorage entries to seed before scripts run
 *
 * Returns { window, document, errors, $, click, type, pick }.
 * `errors` collects anything thrown during load or later interaction.
 */
/**
 * Blank out the shared-editing endpoint in a page's inlined config.
 *
 * A deployed site names a real Worker in config.js. Tests must not depend on
 * that — they would make live network calls, count somebody else's requests,
 * and fail on a laptop with no connection. Suites that exercise sync set their
 * own endpoint after load, against a stubbed fetch.
 */
function withoutSync(html) {
  return html.replace(/(sync:\s*\{[^}]*?endpoint:\s*")[^"]*(")/, "$1$2");
}

export async function loadPage(file, opts = {}) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", e => errors.push(e.message.split("\n")[0]));
  vc.on("error", (...args) => errors.push("console.error: " + args.join(" ").slice(0, 200)));

  // opts.query ("?name=Reviews") reaches pages that read location.search —
  // section.html resolves which section it is that way.
  const dom = new JSDOM(withoutSync(inlineScripts(file)), {
    runScripts: "dangerously",
    url: "https://localhost/" + file + (opts.query || ""),
    virtualConsole: vc,
    beforeParse(w) {
      if (opts.editor !== false) w.localStorage.setItem("wl_preview_role", "editor");
      for (const [k, v] of Object.entries(opts.storage || {})) w.localStorage.setItem(k, v);
      w.confirm = () => (opts.confirm === undefined ? true : opts.confirm);
      w.alert = () => {};
      w.prompt = () => "";
      w.scrollTo = () => {};
      w.addEventListener("error", e => errors.push("onerror: " + (e.message || "")));
      // opts.beforeParse runs last, with the window ready but no page script
      // executed yet — the slot a host platform (or a committed
      // published-content.js) occupies in a real page's <head>.
      if (opts.beforeParse) opts.beforeParse(w);
    },
  });

  const window = dom.window;
  await new Promise(resolve => {
    window.addEventListener("load", resolve);
    setTimeout(resolve, 2000);   // never hang the suite on a stalled page
  });

  const document = window.document;
  return {
    window, document, errors,
    $: sel => document.querySelector(sel),
    $$: sel => [...document.querySelectorAll(sel)],
    // Pages that start a timer (the crossword clock, for one) keep node's event
    // loop alive after the checks finish, so `npm test` never exits. Close the
    // window when a suite is done with it.
    close: () => window.close(),
    click: el => el && el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })),
    type: (el, value) => { el.value = value; el.dispatchEvent(new window.Event("input", { bubbles: true })); },
    pick: (el, value) => { el.value = value; el.dispatchEvent(new window.Event("change", { bubbles: true })); },
  };
}

/** The section card for a given section name in the Content tab. */
export function sectionCard(ctx, name) {
  return ctx.$$(".c-sec").find(c => {
    const el = c.querySelector(".c-sec-name");
    return el && el.textContent === name;
  });
}

/**
 * Seed a few articles. The template ships with none, so any test that needs
 * article rows must put them there itself rather than assume demo content.
 */
export function seedArticles(window, section = "News") {
  const { WLArticles } = window;
  if (Object.keys(WLArticles.getAll()).length) return false;
  [
    ["seed-one",   "First Seeded Story",  "Ada Chen", "April 19, 2026"],
    ["seed-two",   "Second Seeded Story", "Ben Ruiz", "April 18, 2026"],
    ["seed-three", "Third Seeded Story",  "Cy Park",  "April 17, 2026"],
  ].forEach(([id, title, byline, date]) => {
    WLArticles.save(id, { title, deck: "A seeded deck.", section, byline, date, body: ["Body text."] });
  });
  return true;
}

// ===== Assertions =====

export class Check {
  constructor() { this.failures = []; this.count = 0; }

  ok(label, condition, detail = "") {
    this.count++;
    if (!condition) this.failures.push(detail ? `${label} — ${detail}` : label);
  }

  equal(label, actual, expected) {
    this.count++;
    const a = JSON.stringify(actual), b = JSON.stringify(expected);
    if (a !== b) this.failures.push(`${label} — expected ${b}, got ${a}`);
  }

  /** No page or handler threw. */
  clean(label, ctx) {
    this.count++;
    if (ctx.errors.length) this.failures.push(`${label} — ${ctx.errors.slice(0, 3).join(" | ")}`);
  }
}
