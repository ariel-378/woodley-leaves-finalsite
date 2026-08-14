// Editors can rearrange every page, not just the section pages.
//
// The in-place layout editor works off `data-move-key` blocks inside a
// `data-move-group`. For a long time only the five built-in section pages had
// them, so an article page, the video index, the staff list, a tag page, a team
// page and the centerspread were all fixed. Worse, adding the markup is only
// half of it: a page also has to load layout-editor.js, and nine of them did
// not — the group was there and nothing read it.
//
// These checks drive the real editor rather than asserting markup, because
// markup alone was exactly the state that looked correct and did nothing.
//
// The blocks are static, so a page renders its group whether or not the query
// string resolves to real content; nothing here depends on a particular
// article, team or tag existing.
import { loadPage, Check } from "../harness.mjs";

// Home is deliberately absent: it has its own zone-based layout editor in the
// dashboard (layout-store.js / WLLayout), not this in-place one.
const PAGES = [
  "news.html", "features.html", "opinion.html", "style.html", "sports.html",
  "section.html", "article.html", "videos.html", "video.html", "staff.html",
  "search.html", "brackets.html", "tag.html", "writer.html", "team.html",
  "centerspread.html",
];

export async function run() {
  const check = new Check();

  for (const page of PAGES) {
    const query = page === "section.html" ? "?name=News" : "";
    const ctx = await loadPage(page, { editor: true, query });
    const d = ctx.window.document;

    const blocks = [...d.querySelectorAll("[data-move-group] [data-move-key]")];
    const orphans = [...d.querySelectorAll("[data-move-key]")]
      .filter(el => !el.closest("[data-move-group]"));

    // One block is not an arrangement. Several pages hold only their article
    // list — so the rule is: a page with
    // something to rearrange offers the editor, and a page without one does not
    // offer an editor that would open empty.
    const rearrangeable = blocks.length >= 2;
    const toggle = !!d.getElementById("wl-layout-toggle");

    if (rearrangeable) {
      check.ok(`${page} loads the layout editor`, toggle,
        "markup is there but layout-editor.js is not loaded, so editors see no way in");
      check.ok(`${page} rebuilt its group into rows`,
        d.querySelector("[data-move-group] > .wl-row") !== null, "applyGroup did not run");
    } else {
      check.ok(`${page} has one block, so offers no empty layout editor`, !toggle,
        `${blocks.length} block(s) but the toggle appeared anyway`);
    }
    check.ok(`${page} leaves no movable block outside a group`, orphans.length === 0,
      orphans.map(o => o.dataset.moveKey).join(","));
    check.clean(`${page} lays out without errors`, ctx);
  }

  // Readers must never get the editing affordances.
  {
    const ctx = await loadPage("article.html", { editor: false });
    const d = ctx.window.document;
    check.ok("a reader sees no layout toggle", !d.getElementById("wl-layout-toggle"));
    check.ok("a reader sees no drag handles", d.querySelector("[data-move-dir]") === null);
    check.ok("but still sees the content", d.querySelector("[data-move-key]") !== null);
  }

  // A reorder has to outlive the page, which is the whole point.
  {
    const first = await loadPage("article.html", { editor: true });
    const keysOf = d => [...d.querySelectorAll("[data-move-group] [data-move-key]")]
      .map(e => e.dataset.moveKey);
    const before = keysOf(first.window.document);

    // Controls only exist once editing is switched on.
    first.window.document.getElementById("wl-layout-toggle").click();
    const up = first.window.document.querySelector('[data-move-key="related"] [data-move-dir="up"]');
    check.ok("turning editing on renders move controls", !!up);

    if (up) {
      up.click();
      const after = keysOf(first.window.document);
      check.ok("moving a block changes the order", after.join() !== before.join(),
        `${before.join()} did not change`);

      const stored = Object.fromEntries(
        Object.entries({ ...first.window.localStorage })
          .filter(([k]) => k.startsWith("wl_layout_")));
      check.ok("the order is saved", Object.keys(stored).length > 0,
        "nothing under wl_layout_* — a reload would lose it");

      const second = await loadPage("article.html", { editor: true, storage: stored });
      check.equal("and is still there on the next load",
        keysOf(second.window.document).join(), after.join());
      check.clean("no errors restoring a saved layout", second);
    }
  }

  return check;
}
