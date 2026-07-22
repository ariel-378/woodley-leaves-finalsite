// Accessibility guarantees.
//
// Each check here corresponds to a real barrier found in an audit: something
// that stopped a keyboard or screen-reader user completing a core task —
// reading an article, or filing one.

import fs from "fs";
import path from "path";
import { SITE, pages, loadPage, sectionCard, seedArticles, Check } from "../harness.mjs";

const REDIRECTS = new Set(["editor.html", "editor-puzzles.html", "editor-writers.html"]);

export async function run() {
  const check = new Check();

  // ===== Every page can be skipped past its nav =====
  for (const page of pages()) {
    if (REDIRECTS.has(page)) continue;
    const src = fs.readFileSync(path.join(SITE, page), "utf8");
    check.ok(`${page}: has a skip link`, src.includes('class="skip-link"'));
    check.ok(`${page}: skip link has a target`, src.includes('id="main-content"'));
  }

  // ===== Validation errors are announced, not just shown =====
  {
    const files = fs.readdirSync(SITE).filter(f => /\.(js|html)$/.test(f));
    let errorBoxes = 0, unannounced = [];
    for (const file of files) {
      const src = fs.readFileSync(path.join(SITE, file), "utf8");
      for (const m of src.matchAll(/<div class="ed-error"([^>]*)>/g)) {
        errorBoxes++;
        if (!/role\s*=\s*"alert"/.test(m[1])) unannounced.push(`${file}: ${m[0]}`);
      }
    }
    check.ok("error boxes exist to check", errorBoxes >= 5, `found ${errorBoxes}`);
    check.ok("every validation error is a live region", unannounced.length === 0, unannounced.slice(0, 3).join(" | "));
  }

  // ===== Every modal close button has a name =====
  {
    const files = fs.readdirSync(SITE).filter(f => /\.(js|html)$/.test(f));
    const unnamed = [];
    for (const file of files) {
      const src = fs.readFileSync(path.join(SITE, file), "utf8");
      for (const m of src.matchAll(/<button[^>]*class="[^"]*ed-modal-close[^"]*"([^>]*)>/g)) {
        if (!/aria-label/.test(m[1])) unnamed.push(`${file}: ${m[0].slice(0, 60)}`);
      }
    }
    check.ok("no unnamed close buttons", unnamed.length === 0, unnamed.slice(0, 3).join(" | "));
  }

  // ===== Focus returns to the trigger when a modal closes =====
  {
    const ctx = await loadPage("editor-content.html");
    const { document, click, $ } = ctx;
    const trigger = sectionCard(ctx, "News").querySelector('[data-c="add"]');
    trigger.focus();
    click(trigger);
    await new Promise(r => setTimeout(r, 120));   // the editor focuses its first field on a timeout
    check.ok("focus moves into the article editor", $("#ed-modal").contains(document.activeElement),
      `focus was on <${(document.activeElement || {}).tagName}>`);
    click($("#ed-cancel"));
    check.equal("focus returns to the button that opened it",
      document.activeElement === trigger, true);
    check.clean("no errors during focus handling", ctx);
  }

  // ===== The spelling bee is operable without a mouse =====
  {
    const ctx = await loadPage("centerspread.html", { editor: false });
    const cells = ctx.$$(".sb-cell");
    check.ok("bee letters exist", cells.length > 0);
    check.ok("bee letters are real buttons",
      cells.every(c => c.tagName === "BUTTON"),
      "a div with a click handler is neither focusable nor announced as pressable");
    check.ok("bee letters have accessible names", cells.every(c => (c.getAttribute("aria-label") || c.textContent).trim()));

    // Pressing a letter by keyboard should build the current word.
    const before = (ctx.$("#sb-guess") || {}).textContent || "";
    ctx.click(cells[0]);
    const after = (ctx.$("#sb-guess") || {}).textContent || "";
    check.ok("pressing a letter enters it", after !== before, `"${before}" -> "${after}"`);
    check.clean("centerspread renders clean", ctx);
  }

  // ===== The crossword must not swallow keys before it is used =====
  {
    const ctx = await loadPage("centerspread.html", { editor: false });
    const { window, document } = ctx;
    // A reader pressing an arrow key without having touched the puzzle: the
    // event must not be cancelled, or the page cannot be scrolled by keyboard.
    const ev = new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true });
    document.body.dispatchEvent(ev);
    check.ok("arrow keys are not captured before the puzzle is focused",
      !ev.defaultPrevented,
      "the crossword claimed the keyboard on load (WCAG 2.1.4)");

    const letter = new window.KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true });
    document.body.dispatchEvent(letter);
    check.ok("letter keys are not captured before the puzzle is focused", !letter.defaultPrevented);
  }

  // ===== Connections selection is exposed, not colour-only =====
  {
    const ctx = await loadPage("centerspread.html", { editor: false });
    const tiles = ctx.$$(".cn-tile");
    check.ok("connections tiles exist", tiles.length > 0);
    check.ok("tiles report their selection state",
      tiles.every(t => t.hasAttribute("aria-pressed")),
      "selection was conveyed by colour alone");
    if (tiles.length) {
      ctx.click(tiles[0]);
      check.equal("selecting a tile updates aria-pressed",
        ctx.$$(".cn-tile")[0].getAttribute("aria-pressed"), "true");
    }
  }

  // ===== Reordering has a keyboard path =====
  {
    // Seed stories first: the template ships with an empty front page, and a
    // page with nothing to reorder would pass this vacuously.
    const seedCtx = await loadPage("editor-content.html");
    seedArticles(seedCtx.window);
    const storage = {};
    for (const k of Object.keys(seedCtx.window.localStorage)) {
      storage[k] = seedCtx.window.localStorage.getItem(k);
    }

    const ctx = await loadPage("index.html", { storage });
    const blocks = ctx.$$("[data-home-id]");
    check.ok("the front page has stories to reorder", blocks.length > 0);

    const toggle = ctx.$("#wl-home-edit-toggle");
    check.ok("the front page has an edit-layout toggle", !!toggle);
    if (toggle) ctx.click(toggle);

    const moves = ctx.$$("[data-home-move]");
    check.ok("front-page stories have keyboard move controls", moves.length > 0,
      "reordering was drag-and-drop only");
    check.ok("move controls are labelled",
      moves.every(b => (b.getAttribute("aria-label") || "").length > 0));

    // The control must actually reorder, not merely exist.
    if (moves.length && blocks.length > 1) {
      const firstId = blocks[0].dataset.homeId;
      const down = ctx.$(`[data-home-id="${firstId}"] [data-home-move="down"]`);
      if (down) {
        ctx.click(down);
        const after = ctx.$$("[data-home-id]").map(b => b.dataset.homeId);
        check.ok("pressing Move later actually reorders the page",
          after[0] !== firstId, `order unchanged: ${after.slice(0, 3).join(", ")}`);
      }
    }
  }

  // ===== Search results are announced =====
  {
    const src = fs.readFileSync(path.join(SITE, "search.html"), "utf8");
    check.ok("search results summary is a live region",
      /id="search-summary"[^>]*aria-live/.test(src) || /aria-live[^>]*id="search-summary"/.test(src));
  }

  return check;
}
