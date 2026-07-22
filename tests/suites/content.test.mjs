// The Content tab: sections, their content types, and the in-page editors for
// puzzles, poems, art, reveal-answer items and videos.

import { loadPage, sectionCard, Check } from "../harness.mjs";

export async function run() {
  const check = new Check();

  // ===== Sections and their content types =====
  {
    const ctx = await loadPage("editor-content.html");
    const { window, click, $ } = ctx;

    check.ok("every section has a card", ctx.$$(".c-sec").length >= window.WLSections.list().length);

    // Hiding keeps the section but takes it out of the nav.
    const before = window.WLSections.navSections().length;
    click(sectionCard(ctx, "Style").querySelector('[data-c="hide"]'));
    check.ok("hiding a section is recorded", window.WLSections.isHidden("Style"));
    check.equal("hidden sections leave the nav", window.WLSections.navSections().length, before - 1);
    check.ok("the section still exists", !!window.WLSections.find("Style"));
    check.ok("the card is marked hidden", !!sectionCard(ctx, "Style").querySelector(".c-tag-hidden"));
    click(sectionCard(ctx, "Style").querySelector('[data-c="hide"]'));
    check.ok("showing it again restores the nav", !window.WLSections.isHidden("Style"));

    // Content types drive what a section can hold.
    check.ok("content types are listed as chips",
      sectionCard(ctx, "Sports").querySelectorAll(".c-chip").length >= 2);
    check.clean("no errors managing sections", ctx);
  }

  // ===== Puzzles =====
  {
    const ctx = await loadPage("editor-content.html");
    const { window, click, type, $ } = ctx;
    const openPuzzle = (index) => {
      click(sectionCard(ctx, "Centerspread").querySelector('[data-c="add"]'));
      click($('#acm-list [data-acm="Puzzle games"]'));
      click($(`#acm-list [data-sk="${index}"]`));
    };

    // Spelling Bee
    openPuzzle(0);
    click($("#bee-save"));
    check.ok("bee validates the centre letter", $("#bee-error").textContent.includes("Center"));
    type($("#bee-center"), "A");
    type($("#bee-outer"), "BCDEFG");
    type($("#bee-words"), "BADGE\nCAFE");
    click($("#bee-save"));
    const bee = window.WLPuzzles.getBeePool().at(-1);
    check.equal("bee puzzle saved", bee, { center: "A", outer: ["B","C","D","E","F","G"], words: ["BADGE","CAFE"] });

    // Word Search — commas or newlines both work, which is what editors expect.
    openPuzzle(3);
    type($("#ws-words"), "MARET, LEAVES, PRESS");
    click($("#ws-save"));
    check.equal("word search accepts comma-separated words",
      window.WLPuzzles.getWordsearchPool().at(-1).words, ["MARET", "LEAVES", "PRESS"]);

    // Connections
    openPuzzle(2);
    click($("#cn-save"));
    check.ok("connections validates the first group", $("#cn-error").textContent.length > 0);
    const groups = {
      yellow: ["Frog parts", "LEG, EYE, TONGUE, TOE"],
      green:  ["Trees", "OAK, ELM, ASH, FIR"],
      blue:   ["DC areas", "WOODLEY, DUPONT, ADAMS, LOGAN"],
      purple: ["___ press", "FREE, PRINTING, PRESS, FULL"],
    };
    for (const [colour, [category, words]] of Object.entries(groups)) {
      type($(`[data-cn-cat="${colour}"]`), category);
      type($(`[data-cn-words="${colour}"]`), words);
    }
    click($("#cn-save"));
    const cn = window.WLPuzzles.getConnectionsPool().at(-1);
    check.equal("connections stores four groups", cn.groups.length, 4);
    check.equal("first group parsed", cn.groups[0],
      { difficulty: "yellow", category: "Frog parts", words: ["LEG", "EYE", "TONGUE", "TOE"] });

    // Crossword opens (its grid is filled cell by cell).
    ctx.$$(".ed-modal-overlay").forEach(m => m.classList.remove("visible"));
    openPuzzle(1);
    check.ok("crossword builder opens", $("#cw-modal").classList.contains("visible"));

    check.clean("no errors building puzzles", ctx);
  }

  // ===== Poems, art and reveal-answer items =====
  {
    const ctx = await loadPage("editor-content.html");
    const { window, click, type, $ } = ctx;
    const openPiece = (type_) => {
      click(sectionCard(ctx, "Centerspread").querySelector('[data-c="add"]'));
      click($(`#acm-list [data-acm="${type_}"]`));
    };

    openPiece("Poems");
    click($("#pc-save"));
    check.ok("a piece needs a title", $("#pc-error").textContent.length > 0);
    type($("#pc-title"), "Spring at School");
    type($("#pc-byline"), "By R. Okafor");
    type($("#pc-body"), "Line one\nLine two\n\nNew stanza");
    click($("#pc-save"));
    const poem = window.WLCenterspread.getById("spring-at-school");
    check.ok("poem saved", !!poem);
    check.equal("poem keeps its type", poem.type, "poem");

    openPiece("Art/photos");
    type($("#pc-title"), "Courtyard in June");
    click($("#pc-save"));
    check.ok("art needs an image URL", $("#pc-error").textContent.length > 0);
    type($("#pc-image"), "media/courtyard.jpg");
    type($("#pc-alt"), "Students on the steps");
    click($("#pc-save"));
    const art = window.WLCenterspread.getById("courtyard-in-june");
    check.equal("art stores its alt text", art && art.alt, "Students on the steps");

    openPiece("Reveal-answer games");
    type($("#pc-title"), "Riddle of the Week");
    type($("#pc-body"), "What has keys but no locks?");
    click($("#pc-save"));
    check.ok("a reveal item needs an answer", $("#pc-error").textContent.includes("answer"));
    type($("#pc-reveal-answer"), "A piano");
    click($("#pc-save"));
    const riddle = window.WLCenterspread.getById("riddle-of-the-week");
    check.equal("the answer is stored behind a reveal", riddle && riddle.reveal.answer, "A piano");

    check.clean("no errors adding pieces", ctx);
  }

  // ===== Videos =====
  {
    const ctx = await loadPage("editor-content.html");
    const { window, click, type, $ } = ctx;

    // The Video section holds one content type, so the chooser is skipped.
    click(sectionCard(ctx, "Video").querySelector('[data-c="add"]'));
    check.ok("a single-type section opens its editor directly",
      $("#video-modal").classList.contains("visible"));

    type($("#vd-title"), "Behind the spring musical");
    type($("#vd-url"), "https://example.com/not-a-video");
    click($("#vd-save"));
    check.ok("a non-video link is rejected", $("#vd-error").textContent.includes("YouTube"));

    type($("#vd-url"), "https://www.youtube.com/watch?v=abc123XYZ_9");
    type($("#vd-date"), "2026-04-16");
    click($("#vd-save"));
    const video = window.WLVideos.getAll()["behind-the-spring-musical"];
    check.ok("video saved", !!video);
    check.equal("the date is written out for display", video && video.date, "April 16, 2026");
    check.clean("no errors adding a video", ctx);
  }

  return check;
}
