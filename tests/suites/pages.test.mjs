// Every page loads and renders without throwing, and every page ends up with a
// title that names both what you are looking at and the paper.
//
// Reader pages are checked signed-out (how a visitor sees them) and editor
// pages signed in, since most dashboards are gated behind editor access.
//
// These run against whatever config.js the repo ships, so nothing here spells
// out a paper name or an article id — the branded site and the template would
// disagree.

import fs from "fs";
import path from "path";
import { SITE, pages, loadPage, Check } from "../harness.mjs";
import { readConfig, stamp, PLACEHOLDER_NAME } from "../../setup/stamp-brand.mjs";

// Pages that navigate on load by design; jsdom reports that as an error.
const REDIRECTS = new Set(["editor.html", "editor-puzzles.html", "editor-writers.html"]);

export async function run() {
  const check = new Check();

  for (const page of pages()) {
    if (REDIRECTS.has(page)) {
      const html = (await import("fs")).readFileSync(
        (await import("path")).join((await import("../harness.mjs")).SITE, page), "utf8");
      check.ok(`${page} redirects`, /location\.replace\(/.test(html) && /http-equiv="refresh"/i.test(html),
        "a redirect stub should set both a meta refresh and location.replace");
      continue;
    }

    const isEditor = page.startsWith("editor");
    const ctx = await loadPage(page, { editor: isEditor });
    check.clean(`${page} loads clean`, ctx);
    check.ok(`${page} renders content`, ctx.document.body.textContent.trim().length > 200,
      "page body looks empty");
    check.ok(`${page} keeps no placeholder paper name in its title`,
      !/The Student Times/.test(ctx.window.document.title), ctx.window.document.title);
  }

  // ===== Pages that title themselves keep that title =====
  // brand.js swaps the template paper name into <title>. It used to substitute
  // into a snapshot taken while the head was parsing, which is before the
  // inline script on a story page names the story — so re-applying on
  // DOMContentLoaded discarded the real title and every article, writer, tag,
  // team, video and section tab read as just the paper name.
  {
    const paper = (await loadPage("index.html", { editor: false }))
      .window.WL_CONFIG.name;

    // Whatever this repo's first article happens to be. The template ships no
    // stories at all, so the real-story cases only run where there is one.
    const seed = await loadPage("article.html", { editor: false });
    const all = seed.window.WLArticles.getAll();
    const id = Object.keys(all)[0];

    const cases = [
      ["article.html", "", "Article not found"],
      ["section.html", "?name=Sports", "Sports"],
      ["tag.html", "?tag=sports", "#sports"],
      ["writer.html", "?name=Nobody%20Here", "Writer not found"],
      ["team.html", "?id=nope", "Team not found"],
      ["video.html", "?id=nope", "Video not found"],
    ];
    if (id) cases.unshift(["article.html", `?id=${encodeURIComponent(id)}`, all[id].title]);

    for (const [page, query, lead] of cases) {
      const ctx = await loadPage(page, { editor: false, query });
      const title = ctx.window.document.title;
      check.equal(`${page}${query} titles itself`, title, `${lead} — ${paper}`);
    }

    // A Design-tab rename re-substitutes into the page's own title rather than
    // stacking onto the name already written there.
    if (id) {
      const ctx = await loadPage("article.html", { query: `?id=${encodeURIComponent(id)}` });
      const headline = ctx.window.WLArticles.getById(id).title;
      ctx.window.WLBrand.save({ name: "Renamed Paper" });
      check.equal("a rename keeps the story's own title",
        ctx.window.document.title, `${headline} — Renamed Paper`);
      check.clean("no errors renaming the paper", ctx);
    }
  }

  // ===== The shipped HTML already names the paper =====
  // brand.js fixes the name at runtime, which does nothing for link previews,
  // crawlers or anything else that reads the raw markup. `npm run brand` writes
  // it into each <head>; this fails if someone renames the paper in config.js
  // and forgets to re-run it.
  {
    const cfg = readConfig(SITE);
    for (const page of pages()) {
      const src = fs.readFileSync(path.join(SITE, page), "utf8");
      const head = (src.match(/<head>[\s\S]*?<\/head>/i) || [""])[0];
      const title = (head.match(/<title>([\s\S]*?)<\/title>/i) || [, ""])[1];

      check.ok(`${page} ships the real paper name in <head>`,
        !head.includes(PLACEHOLDER_NAME),
        `run "npm run brand" — <head> still says "${PLACEHOLDER_NAME}"`);
      check.ok(`${page} titles itself in the raw markup`,
        title.includes(cfg.name), `<title> is "${title}"`);
      check.equal(`${page} is stamped, so renames still work`,
        stamp(src, cfg), src,
        "stamping would change this file — it is out of date");
    }
  }

  // ===== A mistyped link lands somewhere useful =====
  //  GitHub Pages and most static hosts serve /404.html automatically. Without
  //  one, a stale link — and student papers accumulate those — is a blank host
  //  error page with no way back into the paper.
  {
    check.ok("the site ships a 404 page", fs.existsSync(path.join(SITE, "404.html")));

    const ctx = await loadPage("404.html", { editor: false });
    const text = ctx.document.body.textContent;
    check.ok("it explains what happened in plain words", /can't find that page/i.test(text), text.slice(0, 80));
    check.ok("it offers the front page", !!ctx.$('a[href="index.html"]'));
    check.ok("and a search box rather than a dead end", !!ctx.$('form[action="search.html"] input[type="search"]'));
    check.ok("it keeps itself out of the index", /name="robots"[^>]*noindex/i.test(
      fs.readFileSync(path.join(SITE, "404.html"), "utf8")));
    check.clean("the 404 page renders without errors", ctx);
  }

  // ===== robots.txt and the sitemap describe the real site =====
  {
    const cfg = readConfig(SITE);
    const robotsPath = path.join(SITE, "robots.txt");
    check.ok("robots.txt is present", fs.existsSync(robotsPath));

    const robots = fs.existsSync(robotsPath) ? fs.readFileSync(robotsPath, "utf8") : "";
    check.ok("it keeps crawlers out of the dashboards", /Disallow: \/editor-content\.html/.test(robots));
    check.ok("without blocking the paper itself", /^Allow: \/$/m.test(robots));

    const sitemapPath = path.join(SITE, "sitemap.xml");
    if (cfg.siteUrl) {
      check.ok("a configured siteUrl produces a sitemap", fs.existsSync(sitemapPath));
      const xml = fs.existsSync(sitemapPath) ? fs.readFileSync(sitemapPath, "utf8") : "";
      check.ok("listing the front page", xml.includes("<loc>" + cfg.siteUrl.replace(/\/+$/, "") + "/</loc>"));
      // A bare article.html renders an empty shell — exactly the thin content a
      // crawler is penalised for offering.
      check.ok("and no page that needs a query string to mean anything",
        !/\/(article|section|tag|team|writer|video)\.html<\/loc>/.test(xml),
        (xml.match(/\/(article|section|tag|team|writer|video)\.html<\/loc>/) || [""])[0]);
      check.ok("every listed page actually exists",
        [...xml.matchAll(/<loc>[^<]*?\/([a-z0-9-]+\.html)<\/loc>/g)]
          .every(m => fs.existsSync(path.join(SITE, m[1]))));
    } else {
      check.ok("with no siteUrl set, no sitemap is invented", !fs.existsSync(sitemapPath));
    }
  }

  // ===== The front page says when each story ran =====
  //  A reader who can't tell this week from last March can't decide whether to
  //  trust a story or pass it on. Every other surface showed the date already;
  //  the front page was the one that didn't.
  {
    const ctx = await loadPage("index.html", { editor: false });
    const dated = ctx.$$(".ha-byline, .sec-eyebrow").filter(el => el.querySelector(".ha-date"));
    const credited = ctx.$$(".ha-byline, .sec-eyebrow");
    check.ok("front-page stories carry a date beside the byline",
      credited.length > 0 && dated.length > 0,
      `${dated.length} of ${credited.length} credits showed a date`);
  }

  return check;
}
