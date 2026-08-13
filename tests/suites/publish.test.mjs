// The whole point of the site: a story an editor writes reaches a stranger.
//
// That path had never been run. `published-content.js` shipped as a placeholder
// with a comment saying no content had been published yet, and every other test
// exercised the editor and the reader separately, in the same browser, where
// localStorage does the work. Nothing checked the step between them — the file
// an editor downloads, commits, and expects a reader on a different machine to
// receive.
//
// So these drive the real seam: write a story WITH A PHOTO in the editor,
// produce the publish artifact the panel produces, then load it into a browser
// that has never seen this site and confirm the story is there.
import { loadPage, inlineScripts, Check } from "../harness.mjs";
import jsdomPkg from "jsdom";

const { JSDOM, VirtualConsole } = jsdomPkg;
const tick = () => new Promise(r => setTimeout(r, 0));

/**
 * A reader's first visit: a brand-new browser, no localStorage, with the
 * committed published-content.js in place of the shipped placeholder. This is
 * the step that had never been tested.
 */
async function readerReceiving(publishedJS, page = "index.html") {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", e => errors.push(e.message.split("\n")[0]));

  const [file, query = ""] = page.split("?");
  const html = inlineScripts(file).replace(
    /<script>\s*\/\/ =+\s*\/\/\s*PUBLISHED CONTENT[\s\S]*?<\/script>/,
    `<script>${publishedJS}</script>`
  );

  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    url: "https://localhost/" + file + (query ? "?" + query : ""),
    virtualConsole: vc,
    beforeParse(w) { w.scrollTo = () => {}; w.alert = () => {}; },
  });
  await new Promise(res => { dom.window.addEventListener("load", res); setTimeout(res, 2000); });
  return { window: dom.window, document: dom.window.document, errors };
}

export async function run() {
  const check = new Check();

  const STORY = {
    id: "pipeline-proof",
    title: "Cafeteria adds a second lunch line",
    deck: "The wait is down to four minutes, students say",
    section: "News",
    byline: "By A Reporter",
    date: "September 4, 2026",
    body: [
      "The second line opened Monday, cutting the average wait from eleven minutes to four.",
      "Administrators say the change came from a student survey run last spring.",
    ],
    photo: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAA==",
    caption: "The new line at 12:05 p.m.",
  };

  // ===== An editor writes a story, and the publish artifact carries it =====
  let publishedJS = "";
  {
    const ctx = await loadPage("editor-content.html");
    const W = ctx.window;

    W.WLArticles.save(STORY.id, {
      title: STORY.title, deck: STORY.deck, section: STORY.section,
      byline: STORY.byline, date: STORY.date, body: STORY.body,
      photo: STORY.photo, caption: STORY.caption,
    });

    check.ok("the story is in the editor's browser", !!W.WLArticles.getById(STORY.id));

    publishedJS = W.WLBundle.toPublishedJS();
    check.ok("the publish panel produces a committable file", /window\.WL_PUBLISHED\s*=/.test(publishedJS));
    check.ok("carrying the story's text", publishedJS.includes(STORY.title));
    check.ok("its body", publishedJS.includes(STORY.body[0].slice(0, 40)));
    check.ok("and its photo", publishedJS.includes(STORY.photo.slice(0, 30)));
    check.clean("no errors publishing", ctx);
  }

  // ===== A reader who has never opened this site receives it =====
  {
    const r = await readerReceiving(publishedJS);
    check.ok("a first-time reader's browser accepts the published file",
      !!r.window.WL_PUBLISHED, "WL_PUBLISHED was not set");
    check.ok("and the story is there for them",
      !!(r.window.WLArticles && r.window.WLArticles.getById(STORY.id)),
      "the article did not survive the trip");

    const a = r.window.WLArticles && r.window.WLArticles.getById(STORY.id);
    if (a) {
      check.equal("with its headline intact", a.title, STORY.title);
      check.equal("its byline", a.byline, STORY.byline);
      check.equal("its full body", a.body.length, STORY.body.length);
      check.ok("and its photo", !!a.photo && a.photo === STORY.photo);
    }
    check.ok("no errors on the reader's first load", r.errors.length === 0, r.errors.slice(0, 2).join(" | "));
  }

  // ===== It is actually rendered, not merely present in memory =====
  {
    const r = await readerReceiving(publishedJS, "news.html");
    const text = r.document.body.textContent;
    check.ok("the headline appears on the section page", text.includes(STORY.title),
      "not found in the rendered News page");
    check.ok("and its deck with it", text.includes(STORY.deck));
  }

  {
    const r = await readerReceiving(publishedJS, "article.html?id=" + STORY.id);
    const text = r.document.body.textContent;
    check.ok("the article page renders the headline", text.includes(STORY.title));
    check.ok("and the body copy", text.includes(STORY.body[0].slice(0, 40)));
    check.ok("and the photo is on the page",
      [...r.document.querySelectorAll("img")].some(i => (i.getAttribute("src") || "").startsWith("data:image/jpeg")),
      "no img carried the published photo");
  }

  // ===== A second publish replaces the first, rather than doubling it =====
  {
    const ctx = await loadPage("editor-content.html");
    const W = ctx.window;
    W.WLArticles.save(STORY.id, {
      title: "Cafeteria adds a second lunch line (updated)", deck: STORY.deck,
      section: STORY.section, byline: STORY.byline, date: STORY.date, body: STORY.body,
    });
    const second = W.WLBundle.toPublishedJS();

    const r = await readerReceiving(second);
    const a = r.window.WLArticles && r.window.WLArticles.getById(STORY.id);
    check.ok("a re-publish reaches the reader as the new version",
      a && /updated/.test(a.title), a ? a.title : "missing");
  }

  // ===== The panel says how long it has been since a backup =====
  //  Drafts live in one browser. A cleared cache, a reimaged school laptop or a
  //  full quota all end the same way, and the writer finds out last. The bundle
  //  download already existed; nothing had ever asked anyone to use it.
  {
    // jsdom has no URL.createObjectURL, so a real download would throw and the
    // panel would correctly refuse to record a backup that never happened.
    // Stand the browser API in so the success path is what gets exercised.
    const ctx = await loadPage("editor-content.html", {
      beforeParse(w) {
        w.URL.createObjectURL = () => "blob:stub";
        w.URL.revokeObjectURL = () => {};
      },
    });
    ctx.window.WLArticles.save("nag-check", {
      title: "Something worth losing", section: "News", byline: "By A Reporter",
      date: "September 4, 2026", body: ["Draft."],
    });
    ctx.click(ctx.$("#wl-publish-download"));

    const nag = ctx.$("#wl-backup-nag");
    check.ok("the publish panel carries a backup line", !!nag);
    check.ok("which reads as today right after a download",
      nag && /today/i.test(nag.textContent), nag && nag.textContent);
    check.ok("and the panel confirms the download",
      /Downloaded content-bundle\.json/.test(ctx.$("#wl-publish-status").textContent),
      ctx.$("#wl-publish-status").textContent);
  }

  // ===== A download that never starts is not recorded as a backup =====
  {
    const ctx = await loadPage("editor-content.html");   // no createObjectURL
    ctx.window.WLArticles.save("nag-check-2", {
      title: "Draft", section: "News", byline: "By A Reporter", date: "September 4, 2026", body: ["…"],
    });
    ctx.click(ctx.$("#wl-publish-download"));

    check.ok("a failed download says so rather than doing nothing",
      /didn't start/i.test(ctx.$("#wl-publish-status").textContent),
      ctx.$("#wl-publish-status").textContent);
    check.ok("and is never recorded as a backup",
      !ctx.window.localStorage.getItem("wl_last_backup"),
      "a backup that did not happen was recorded");
  }

  {
    // A browser with drafts and no backup ever taken is the dangerous state,
    // and it is the one the panel should be loudest about.
    const ctx = await loadPage("editor-content.html", {
      storage: { wl_articles_custom: JSON.stringify({ "x": { title: "Unsaved work", section: "News", body: ["…"] } }) },
    });
    const nag = ctx.$("#wl-backup-nag");
    check.ok("with drafts and no backup, the panel says so",
      nag && /never/i.test(nag.textContent), nag ? nag.textContent : "no nag element");
    check.ok("and warns what that means",
      nag && /gone|lost|cleared/i.test(nag.textContent), nag && nag.textContent);
  }

  {
    // Nothing to lose, nothing to nag about.
    const ctx = await loadPage("editor-content.html");
    const nag = ctx.$("#wl-backup-nag");
    check.ok("a browser with no drafts is not nagged",
      !nag || nag.textContent.trim() === "", nag && nag.textContent);
  }

  // The backup timestamp is this browser's business, not content — it must not
  // ride along in a bundle and tell a co-editor they backed up when they didn't.
  {
    const ctx = await loadPage("editor-content.html");
    ctx.window.localStorage.setItem("wl_last_backup", String(Date.now()));
    check.ok("the backup date is never bundled or published",
      !ctx.window.WLBundle.isContentKey("wl_last_backup"));
  }

  return check;
}
