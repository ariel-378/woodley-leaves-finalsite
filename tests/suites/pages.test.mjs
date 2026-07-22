// Every page loads and renders without throwing.
//
// Reader pages are checked signed-out (how a visitor sees them) and editor
// pages signed in, since most dashboards are gated behind editor access.

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
  }

  return check;
}
