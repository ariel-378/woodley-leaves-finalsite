// The two kinds of editor-written code, and the line between them.
//
//   Custom game     added alongside the puzzles, stored in WLGamesStore,
//                   shown on the Centerspread
//   Custom feature  a comic strip, photo essay, embedded map — stored in
//                   WLFeatures, shown on any section declaring the type
//
// They share one form (code-editor.js) but must never share a destination.
// An earlier version had a single "Custom" that was both at once: one code
// blob per section, not addable more than once, and unreachable from the
// games chooser. These tests keep the two apart.

import { loadPage, sectionCard, Check } from "../harness.mjs";

export async function run() {
  const check = new Check();

  // ===== A custom game is offered with the other games =====
  {
    const ctx = await loadPage("editor-content.html");
    const { window, click, type, $ } = ctx;

    click(sectionCard(ctx, "Centerspread").querySelector('[data-c="add"]'));
    click($('#acm-list [data-acm="Puzzle games"]'));
    const kinds = ctx.$$("#acm-list [data-sk]");
    const customIdx = kinds.findIndex(b => b.textContent.includes("Custom game"));
    check.ok("a custom game can be added from the games chooser", customIdx >= 0,
      "custom games existed but were unreachable from the Content tab");

    click(kinds[customIdx]);
    check.ok("the code editor opens", $("#code-modal").classList.contains("visible"));
    check.equal("titled as a game", $("#code-modal-title").textContent, "Add a game");
    check.ok("it says where the game will appear", $("#code-where").textContent.includes("Centerspread"));
    check.ok("prefilled with a working example", $("#code-code").value.includes("<!doctype html>"));

    click($("#code-save"));
    check.ok("a title is required", $("#code-error").textContent.length > 0);

    type($("#code-title"), "Click Race");
    click($("#code-save"));
    check.ok("saved into the games store", !!window.WLGamesStore.getAll().find(g => g.id === "click-race"));
    check.ok("and NOT into the features store",
      !window.WLFeatures.getAll().some(f => f.id === "click-race"),
      "a game must not leak into the features list");
    check.clean("no errors adding a game", ctx);
  }

  // ===== A custom feature is a separate, repeatable piece =====
  {
    const ctx = await loadPage("editor-content.html");
    const { window, click, type, $ } = ctx;
    window.WLSections.setContentTypes("Features", ["Articles", "Custom feature"]);

    const addFeature = (title) => {
      click(sectionCard(ctx, "Features").querySelector('[data-c="add"]'));
      click($('#acm-list [data-acm="Custom feature"]'));
      type($("#code-title"), title);
      click($("#code-save"));
    };

    click(sectionCard(ctx, "Features").querySelector('[data-c="add"]'));
    click($('#acm-list [data-acm="Custom feature"]'));
    check.equal("titled as a feature", $("#code-modal-title").textContent, "Add a custom feature");
    check.ok("the example is a comic strip, not a game", $("#code-code").value.includes("comic"));
    check.ok("it says where the feature will appear",
      $("#code-where").textContent.includes("Custom feature"));
    type($("#code-title"), "Hall Pass Comics");
    click($("#code-save"));

    check.ok("saved into the features store",
      !!window.WLFeatures.getAll().find(f => f.id === "hall-pass-comics"));
    check.ok("and NOT into the games store",
      !window.WLGamesStore.getAll().some(g => g.id === "hall-pass-comics"),
      "a feature must not leak into the games list");

    // The old single-blob model could hold exactly one of these per section.
    addFeature("Photo Essay");
    check.ok("a section can hold more than one feature",
      window.WLFeatures.getAll().length >= 2,
      "adding a second feature replaced the first");
    check.clean("no errors adding features", ctx);
  }

  // ===== Features reach readers, sandboxed =====
  {
    const ctx = await loadPage("editor-content.html");
    const { window } = ctx;
    window.WLSections.setContentTypes("Features", ["Articles", "Custom feature"]);
    window.WLFeatures.save({
      id: "test-comic", title: "Test Comic", description: "Three panels.",
      code: "<!doctype html><html><body><p>Panel one.</p></body></html>", height: 320,
    });

    const storage = {};
    for (const k of Object.keys(window.localStorage)) storage[k] = window.localStorage.getItem(k);
    const reader = await loadPage("features.html", { editor: false, storage });

    const frames = reader.$$(".sec-custom-frame");
    check.ok("the feature renders on the section page", frames.length >= 1,
      "features-store.js may not be loaded on section pages");
    check.ok("its title is shown",
      reader.$$(".sec-custom-title").some(h => h.textContent === "Test Comic"));
    check.ok("it runs sandboxed with no same-origin access",
      frames.every(f => (f.getAttribute("sandbox") || "") === "allow-scripts"));
    check.ok("its height is honoured", frames.some(f => f.style.height === "320px"));
    check.clean("section page renders clean", reader);
  }

  // ===== The old single-blob "Custom" is migrated, not dropped =====
  {
    // A section saved by the previous version: type "Custom", code on the section.
    const legacy = JSON.stringify([
      { name: "News", page: "news.html", nav: true, locked: false,
        contentTypes: ["Articles", "Custom"], customCode: "<p>legacy comic</p>" },
    ]);
    const ctx = await loadPage("editor-content.html", {
      storage: { wl_sections: legacy },
    });
    const { window } = ctx;

    const types = window.WLSections.contentTypes("News");
    check.ok("the old type name is renamed", types.includes("Custom feature"), JSON.stringify(types));
    check.ok("the old name is gone", !types.includes("Custom"));

    const carried = window.WLFeatures.getAll().find(f => (f.code || "").includes("legacy comic"));
    check.ok("the old code became a real feature piece", !!carried,
      "migrating must not silently discard an editor's work");
    check.clean("no errors during migration", ctx);
  }

  return check;
}
