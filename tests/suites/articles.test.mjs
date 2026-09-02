// Articles: writing one in the Content tab, and managing it from its section card.

import { loadPage, sectionCard, seedArticles, Check } from "../harness.mjs";

export async function run() {
  const check = new Check();

  // ===== Creating an article inline =====
  {
    const ctx = await loadPage("editor-content.html");
    const { document, window, click, type, $ } = ctx;

    // "News" holds only Articles, so Add new content goes straight to the editor.
    click(sectionCard(ctx, "News").querySelector('[data-c="add"]'));
    check.ok("article editor opens in the Content tab", $("#ed-modal").classList.contains("visible"));
    check.equal("section is preset from the card", $("#ed-section").value, "News");

    type($("#ed-title"), "A Story Filed Inline!");
    check.equal("slug auto-suggests from the headline", $("#ed-id").value, "a-story-filed-inline");

    click($("#ed-save"));
    check.ok("deck is required", $("#ed-error").textContent.includes("Deck"));
    type($("#ed-deck"), "One-line summary.");
    click($("#ed-save"));
    check.ok("body is required", $("#ed-error").textContent.includes("Body"));

    type($("#ed-body"), "First paragraph.\n\nSecond paragraph.");
    type(document.querySelector("#ed-authors input"), "Ada Chen");

    // A second writer: co-written bylines must list everyone.
    click($("#ed-author-add"));
    const writers = ctx.$$("#ed-authors input");
    type(writers[1], "Ben Ruiz");

    // Tags now come from the list the masthead keeps, not from a free-text box:
    // tick the ones that apply. Typing a tag is no longer possible, which is
    // the point — it is how one tag stopped meaning three different things.
    window.WLTags.setEnabled(true);
    window.WLTags.add("Seniors");
    window.WLTags.add("Profile");
    window.WLArticleEditor.close();
    window.WLArticleEditor.open(null, { section: "News" });
    type($("#ed-title"), "A Story Filed Inline!");
    type($("#ed-deck"), "One-line summary.");
    type($("#ed-body"), "First paragraph.\n\nSecond paragraph.");
    type(document.querySelector("#ed-authors input"), "Ada Chen");
    click($("#ed-author-add"));
    type(ctx.$$("#ed-authors input")[1], "Ben Ruiz");
    // Tags are searched for and picked, not ticked from a list of everything.
    for (const q of ["senior", "profile"]) {
      type($("#ed-tag-search"), q);
      click(ctx.$("#ed-tag-results .ed-tag-option"));
    }
    click($("#ed-save"));

    check.ok("modal closes on save", !$("#ed-modal").classList.contains("visible"));
    const saved = window.WLArticles.getById("a-story-filed-inline");
    check.ok("article was stored", !!saved);
    check.equal("byline lists both writers", saved.byline, "Ada Chen, Ben Ruiz");
    check.equal("authors are kept separately", saved.authors, ["Ada Chen", "Ben Ruiz"]);
    check.equal("body split into paragraphs", saved.body.length, 2);
    check.equal("the ticked tags are saved, in the list's own spelling",
      saved.tags, ["Seniors", "Profile"]);
    check.equal("section page recorded", saved.sectionPage, "news.html");
    check.clean("no errors while filing", ctx);
  }

  // ===== Managing articles from the section card =====
  {
    const ctx = await loadPage("editor-content.html");
    const { window, click, $ } = ctx;
    seedArticles(window);

    const card = () => sectionCard(ctx, "News");
    const rows = () => card().querySelectorAll(".c-art");
    check.ok("section card lists its articles", rows().length >= 3);
    check.ok("sections without Articles have no list",
      !sectionCard(ctx, "Centerspread").querySelector(".c-art-list"));

    // Feature / unfeature
    const id = rows()[0].querySelector('[data-a="feature"]').dataset.id;
    click(rows()[0].querySelector('[data-a="feature"]'));
    check.equal("feature marks the top story", window.WLArticles.getFeaturedId("News"), id);
    check.ok("a Top story badge appears", !!card().querySelector(".c-badge-featured"));
    check.equal("button offers to unfeature", card().querySelector('[data-a="feature"]').textContent, "Unfeature");
    click(card().querySelector('[data-a="feature"]'));
    check.ok("unfeature clears it", !window.WLArticles.getFeaturedId("News"));

    // Edit opens prefilled
    click(card().querySelector('[data-a="edit"]'));
    check.ok("edit opens the editor", $("#ed-modal").classList.contains("visible"));
    check.ok("id is locked when editing", $("#ed-id").disabled);
    check.ok("headline is prefilled", $("#ed-title").value.length > 0);
    click($("#ed-cancel"));

    // Delete
    const before = rows().length;
    const doomed = card().querySelector('[data-a="delete"]').dataset.id;
    click(card().querySelector('[data-a="delete"]'));
    check.equal("delete removes the row", rows().length, before - 1);
    check.ok("delete removes the record", !window.WLArticles.getById(doomed));

    // Reset returns to the shipped article set and drops every local change.
    // The Maret site ships stories, the template ships none, so assert the
    // invariant that holds either way rather than assuming demo content exists.
    const shipped = Object.keys(window.WL_ARTICLES || {}).sort();
    window.WLArticles.setFeatured("News", rows()[0].querySelector('[data-a="feature"]').dataset.id);
    click($("#btn-reset"));
    check.equal("reset restores exactly the shipped articles",
      Object.keys(window.WLArticles.getAll()).sort(), shipped);
    check.ok("reset discards articles added locally",
      !shipped.includes("seed-one") ? !window.WLArticles.getById("seed-one") : true);
    check.equal("reset clears featured picks", window.WLArticles.getFeaturedId(), {});
    check.clean("no errors while managing", ctx);
  }

  // ===== Nothing may silently disappear =====
  {
    const ctx = await loadPage("editor-content.html");
    const { window } = ctx;
    window.WLArticles.save("stray-story", {
      title: "Stray Story", deck: "d", section: "No Such Section",
      byline: "X", date: "April 1, 2026", body: ["b"],
    });
    const unfiled = sectionCard(ctx, "Unfiled");
    check.ok("an article with no matching section shows under Unfiled", !!unfiled);
    check.ok("the Unfiled card holds it", unfiled && unfiled.querySelectorAll(".c-art").length >= 1);
    check.clean("no errors with an orphaned article", ctx);
  }

  // ===== Scheduling =====
  {
    const ctx = await loadPage("editor-content.html");
    const { window } = ctx;
    const future = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 16);
    window.WLArticles.save("future-story", {
      title: "Future Story", deck: "d", section: "News", byline: "X",
      date: "May 1, 2026", body: ["b"], publishAt: future,
    });
    check.ok("a future article is not published yet", !window.WLArticles.isPublished(
      window.WLArticles.getById("future-story")));
    const card = sectionCard(ctx, "News");
    check.ok("the editor sees a scheduled badge", !!card.querySelector(".c-badge-scheduled"));
    check.clean("no errors with a scheduled article", ctx);
  }

  return check;
}
