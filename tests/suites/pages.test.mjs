// Every page loads and renders without throwing, and every page ends up with a
// title that names both what you are looking at and the paper.
//
// Reader pages are checked signed-out (how a visitor sees them) and editor
// pages signed in, since most dashboards are gated behind editor access.
//
// These run against whatever config.js the repo ships, so nothing here spells
// out a paper name or an article id — the branded site and the template would
// disagree.

import { pages, loadPage, Check } from "../harness.mjs";

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

  return check;
}
