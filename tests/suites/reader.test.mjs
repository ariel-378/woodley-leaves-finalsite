// What readers actually get: content added in the editor has to reach the
// public pages, and hidden or scheduled content has to stay off them.

import { loadPage, Check } from "../harness.mjs";

/** Run an editor page, then carry its saved state into a reader page. */
async function thenRead(editorPage, act, readerPage) {
  const editor = await loadPage(editorPage);
  await act(editor);
  const storage = {};
  for (const key of Object.keys(editor.window.localStorage)) {
    storage[key] = editor.window.localStorage.getItem(key);
  }
  const reader = await loadPage(readerPage, { editor: false, storage });
  return { editor, reader };
}

export async function run() {
  const check = new Check();

  // ===== An article written in the editor appears on its section page =====
  {
    const { editor, reader } = await thenRead("editor-content.html", async ({ window }) => {
      window.WLArticles.save("reader-visible", {
        title: "A Story Readers Can See", deck: "Published now.", section: "News",
        byline: "Ada Chen", date: "April 20, 2026", body: ["Body."],
      });
    }, "news.html");
    check.ok("a published article reaches the section page",
      reader.document.body.textContent.includes("A Story Readers Can See"));
    check.clean("section page renders clean", reader);
    check.clean("editor stayed clean", editor);
  }

  // ===== A scheduled article stays hidden until its time =====
  {
    const future = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 16);
    const { reader } = await thenRead("editor-content.html", async ({ window }) => {
      window.WLArticles.save("reader-scheduled", {
        title: "Embargoed Until Next Week", deck: "Not yet.", section: "News",
        byline: "Ada Chen", date: "May 1, 2026", body: ["Body."], publishAt: future,
      });
    }, "news.html");
    check.ok("a scheduled article is not shown to readers",
      !reader.document.body.textContent.includes("Embargoed Until Next Week"));
  }

  // ===== A hidden section disappears from the nav =====
  {
    const { reader } = await thenRead("editor-content.html", async ({ window }) => {
      window.WLSections.setHidden("Style", true);
    }, "index.html");
    const nav = reader.document.querySelector(".sectionnav");
    check.ok("a hidden section leaves the nav", nav && !nav.textContent.includes("Style"));
    check.clean("home page renders clean with a hidden section", reader);
  }

  // ===== Content types render on whatever section declares them =====
  {
    const { reader } = await thenRead("editor-content.html", async ({ window }) => {
      window.WLCenterspread.save("test-poem", {
        type: "poem", title: "A Test Poem", body: "Line one\nLine two",
      });
      window.WLSections.setContentTypes("Features", ["Articles", "Poems"]);
    }, "features.html");
    check.ok("a poem renders on a section that declares Poems",
      reader.document.body.textContent.includes("A Test Poem"));
    check.ok("the block is labelled",
      reader.$$(".sec-block-title").some(h => h.textContent.includes("Poem")));
    check.clean("section page renders clean with mixed content", reader);
  }

  // ===== A video added in the editor reaches the videos page =====
  {
    const { reader } = await thenRead("editor-content.html", async ({ window }) => {
      window.WLVideos.save("test-video", {
        title: "A Test Video", url: "https://www.youtube.com/watch?v=abc123XYZ_9",
        byline: "Iris Tan", date: "April 16, 2026",
      });
    }, "videos.html");
    check.ok("the video appears for readers",
      reader.document.body.textContent.includes("A Test Video"));
  }

  // ===== The publish loop reaches a reader who never opened the editor =====
  // Every other case above hands the editor's own localStorage to the reader,
  // which is the same browser. Publishing is the path that crosses browsers:
  // an editor downloads published-content.js, someone commits it, and it loads
  // in <head> on every page. This is the only route by which a stranger's
  // browser — empty localStorage, never signed in — sees an editor's work, and
  // it was the one route nothing exercised end to end.
  {
    const editor = await loadPage("editor-content.html");
    editor.window.WLArticles.save("published-loop-story", {
      title: "Filed Before The Bell",
      deck: "A story that only exists because an editor published it.",
      section: "News", sectionPage: "news.html",
      byline: "Wire Staff", date: "May 20, 2026", body: ["One paragraph."],
    });

    const js = editor.window.WLBundle.toPublishedJS();
    check.ok("publishing produces a committable file", /window\.WL_PUBLISHED\s*=/.test(js));

    // Exactly what committing that file and loading any page does: the script
    // runs in <head>, content-bundle.js applies it, the page renders.
    const reader = await loadPage("news.html", { editor: false, beforeParse: w => {
      w.eval(js);
    }});

    check.ok("a reader with no local edits sees the published story",
      reader.document.body.textContent.includes("Filed Before The Bell"),
      "the published file did not reach a fresh browser");
    check.ok("and the reader is not shown editor tools",
      !reader.document.getElementById("wl-layout-toggle"));
    check.clean("the published page renders clean", reader);

    // Loading it twice must not double-apply or wipe the reader's own state.
    const again = await loadPage("news.html", { editor: false, beforeParse: w => {
      w.eval(js);
    }});
    check.ok("re-loading the same published version is stable",
      again.document.body.textContent.includes("Filed Before The Bell"));
    check.clean("no errors on a second load", again);
  }

  return check;
}
