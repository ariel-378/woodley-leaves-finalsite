// A new section starts empty.
//
// Sections declare content types, and the dashboard listed everything of that
// type in the whole paper under every section that declared it. So making an
// "Arcade" section and ticking Puzzle games showed the Centerspread's
// crossword, spelling bee, Connections and word search as Arcade's contents,
// with Edit and Delete beside each — before anyone had put anything there.
// Ticking Reveal-answer games dragged in the Centerspread's poems too.
//
// Articles never had the problem: they carry the section they belong to, and
// the dashboard filters on it. Everything else is now read the same way. An
// item that predates this carries no section and belongs where it has always
// appeared — the first section declaring its type — so nothing moved.
import { loadPage, sectionCard, Check } from "../harness.mjs";

const opened = [];
async function editor() {
  const ctx = await loadPage("editor-content.html");
  opened.push(ctx);
  return ctx;
}

/** The item rows the dashboard lists under one section. */
const itemsIn = (ctx, name) => {
  const card = sectionCard(ctx, name);
  return card ? [...card.querySelectorAll(".c-item")] : null;
};

/**
 * What a reader actually sees. The harness inlines every <script> into the
 * page, so body.textContent contains JavaScript source — including the poems
 * that ship as defaults in centerspread.js. Reading that instead of the
 * rendered page makes these checks pass no matter what renders.
 */
const visibleText = ctx => {
  const body = ctx.document.body.cloneNode(true);
  body.querySelectorAll("script, style, template").forEach(el => el.remove());
  return body.textContent.replace(/\s+/g, " ");
};

const titlesIn = (ctx, name) =>
  (itemsIn(ctx, name) || []).map(el => (el.querySelector(".c-item-title") || {}).textContent || "");

export async function run() {
  const check = new Check();

  // ===== A brand-new section holds nothing =====
  {
    const ctx = await editor();
    ctx.window.WLSections.add("Arcade", { contentTypes: ["Puzzle games", "Reveal-answer games"] });
    await new Promise(r => setTimeout(r, 20));

    const rows = itemsIn(ctx, "Arcade");
    check.ok("the new section appears in the dashboard", rows !== null);
    check.equal("and holds nothing at all", (rows || []).length, 0);
    check.ok("it says so, rather than showing another section's work",
      (sectionCard(ctx, "Arcade") || { textContent: "" }).textContent.includes("Nothing here yet"),
      (sectionCard(ctx, "Arcade") || { textContent: "" }).textContent.replace(/\s+/g, " ").slice(0, 120));
  }

  // ===== And the section that did hold them still does =====
  {
    const ctx = await editor();
    const before = titlesIn(ctx, "Centerspread");
    check.ok("the Centerspread still lists its puzzles",
      before.some(t => /Crossword/i.test(t)), before.join(", ").slice(0, 120));

    ctx.window.WLSections.add("Arcade", { contentTypes: ["Puzzle games", "Reveal-answer games"] });
    await new Promise(r => setTimeout(r, 20));

    const after = titlesIn(ctx, "Centerspread");
    check.equal("and adding another section takes nothing away from it", after, before);
  }

  // ===== Content added to a section belongs to it, and only it =====
  {
    const ctx = await editor();
    const W = ctx.window;
    W.WLSections.add("Arcade", { contentTypes: ["Reveal-answer games"] });
    W.WLCenterspread.save("arcade-riddle", {
      type: "prose", title: "A riddle for the Arcade", byline: "By A Reporter",
      body: ["Something to work out."], reveal: { summary: "Reveal", answer: "42" },
      section: "Arcade",
    });
    await new Promise(r => setTimeout(r, 20));

    check.ok("a piece created in the new section shows there",
      titlesIn(ctx, "Arcade").some(t => /Arcade/i.test(t)), titlesIn(ctx, "Arcade").join(", "));
    check.ok("and does not appear under the Centerspread",
      !titlesIn(ctx, "Centerspread").some(t => /A riddle for the Arcade/i.test(t)),
      titlesIn(ctx, "Centerspread").join(", ").slice(0, 160));
  }

  // ===== The same rule on the public pages =====
  {
    const ctx = await editor();
    ctx.window.WLSections.add("Arcade", { contentTypes: ["Reveal-answer games", "Poems"] });
    const stored = {};
    for (const k of ["wl_sections", "wl_cs_pieces", "wl_cs_order"]) {
      const v = ctx.window.localStorage.getItem(k);
      if (v) stored[k] = v;
    }

    // Titles are read from the store rather than written in here: the branded
    // site and the template ship different pieces, and a hard-coded one would
    // quietly stop testing anything on whichever repo it did not match.
    const othersTitles = ctx.window.WLCenterspread.list()
      .map(p => (p.title || "").trim()).filter(t => t.length > 6);

    const page = await loadPage("section.html", { editor: false, query: "?name=Arcade", storage: stored });
    opened.push(page);
    const text = visibleText(page);

    const leaked = othersTitles.filter(t => text.includes(t));
    check.equal("a reader visiting the new section is shown none of the Centerspread's pieces",
      leaked, []);
    check.ok("there were pieces that could have leaked", othersTitles.length > 0);
    check.clean("and the page renders cleanly", page);
  }

  // ===== Nothing moved off the Centerspread's own page =====
  {
    const page = await loadPage("centerspread.html", { editor: false });
    opened.push(page);
    const shown = page.$$(".print-piece").length;
    check.ok("the Centerspread still shows its own pieces", shown > 0,
      `it rendered ${shown} pieces`);
    check.clean("centerspread renders cleanly", page);
  }

  opened.forEach(c => c.close());
  return check;
}
