// One real page per article, so a shared link previews properly.
//
// Every article was article.html?id=… — a single page that fetched its content
// in the browser and then rewrote its own <title> and og: tags. Anything that
// runs JavaScript sees the right thing. Nothing that builds a link preview runs
// JavaScript, so a story pasted into a group chat, iMessage or Slack showed the
// paper's name, no headline and no photo. For a school paper the group chat is
// the distribution, so that was the paper being unshareable.
//
// stories/<id>.html now carries the real values in the markup. These check what
// a crawler reads, which is the raw file — never the rendered DOM, because
// rendering is exactly what a crawler does not do.
import fs from "fs";
import path from "path";
import os from "os";
import { SITE, loadPage, Check } from "../harness.mjs";
import { build, articles, OUT_DIR } from "../../setup/build-stories.mjs";

const opened = [];
const dir = path.join(SITE, OUT_DIR);
const raw = f => fs.readFileSync(path.join(dir, f), "utf8");
const metaOf = (html, prop) =>
  (html.match(new RegExp(`<meta (?:property|name)="${prop}" content="([^"]*)"`)) || [, null])[1];

export async function run() {
  const check = new Check();
  const all = articles();
  const ids = Object.keys(all);

  check.ok("there are articles to generate from", ids.length > 0);
  check.ok("a page exists for every article",
    ids.every(id => fs.existsSync(path.join(dir, `${id}.html`))),
    ids.filter(id => !fs.existsSync(path.join(dir, `${id}.html`))).join(", "));

  // ===== The pages are current =====
  //  Same honesty mechanism as `npm run brand`: a script somebody has to
  //  remember to run is a script that will be forgotten, so forgetting fails
  //  here rather than shipping a stale headline to every crawler.
  {
    const { written, manifest } = build();
    check.equal("story pages are up to date — run `npm run stories` if this fails", written, 0);
    check.ok("the story list in story-url.js is up to date", manifest === false,
      "story-url.js did not list the same stories that exist — links would fall back");
  }

  // ===== What a crawler actually reads =====
  {
    const id = ids[0], a = all[id], html = raw(`${id}.html`);

    check.ok("the <title> is the story's, not the paper's",
      new RegExp(`<title>${a.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(html),
      (html.match(/<title>[^<]*/) || [""])[0]);
    check.equal("og:title is the headline", metaOf(html, "og:title"), a.title);
    check.ok("og:description is not empty", (metaOf(html, "og:description") || "").length > 10,
      metaOf(html, "og:description"));
    check.equal("twitter:title matches", metaOf(html, "twitter:title"), a.title);

    check.ok("none of it says only the paper's name",
      metaOf(html, "og:title") !== "The Woodley Leaves" && metaOf(html, "og:title") !== "The Wildcat Times",
      "the bug this whole change exists to fix");
  }

  {
    // A story with a photo must offer it, or the preview is a wall of text.
    const withPhoto = ids.find(id => (all[id].photo || "").trim());
    if (withPhoto) {
      const html = raw(`${withPhoto}.html`);
      check.ok("a story with a photo sets og:image", !!metaOf(html, "og:image"), "og:image was empty");
    } else {
      check.ok("no article has a photo, nothing to check", true);
    }
  }

  // ===== The page still works for a human =====
  {
    const id = ids[0];
    const ctx = await loadPage(`${OUT_DIR}/${id}.html`, { editor: false });
    opened.push(ctx);
    check.equal("it renders the right story", ctx.$("#art-title").textContent.trim(), all[id].title);
    check.ok("the body is there", ctx.document.body.textContent.length > 400);
    check.ok("it needs no query string", !ctx.window.location.search);
    check.clean("and renders without errors", ctx);
  }

  {
    // Relative paths have to survive being one directory down.
    const html = raw(`${ids[0]}.html`);
    check.ok("stylesheet resolves out of the folder", /href="\.\.\/styles\.css"/.test(html));
    check.ok("scripts resolve out of the folder", /src="\.\.\/articles-store\.js"/.test(html));
    check.ok("the skip link still points within the page", /href="#main-content"/.test(html),
      "a <base> tag or a bad rewrite would send it to the site root");
  }

  // ===== Old links keep working =====
  {
    const ctx = await loadPage("article.html", { editor: false, query: `?id=${ids[0]}` });
    opened.push(ctx);
    check.equal("article.html?id= still resolves", ctx.$("#art-title").textContent.trim(), all[ids[0]].title);
  }

  // ===== Deleted stories do not linger =====
  {
    const orphan = path.join(dir, "a-story-that-was-deleted.html");
    fs.writeFileSync(orphan, "<!-- stale -->");
    build();
    check.ok("a page with no article behind it is removed", !fs.existsSync(orphan),
      "a deleted story stayed reachable at its old URL");
  }

  // ===== A story with no page yet must not get a dead link =====
  //  Publishing is automatic and cannot run the generator, so an article can be
  //  live before its page exists. That window has to degrade to the old URL.
  {
    const ctx = await loadPage("index.html", { editor: false });
    opened.push(ctx);
    const href = ctx.window.WL_storyHref;

    check.ok("a story with a page gets the real page",
      href(ids[0]) === `${OUT_DIR}/${ids[0]}.html`, href(ids[0]));
    check.ok("a story with no page falls back to a URL that works",
      href("not-generated-yet") === "article.html?id=not-generated-yet",
      href("not-generated-yet"));
    check.ok("an id with characters needing escaping is encoded",
      href("a b&c") === "article.html?id=a%20b%26c", href("a b&c"));
    check.ok("the generated list matches the pages on disk",
      ids.every(id => ctx.window.WL_STORY_PAGES.includes(id)) &&
      ctx.window.WL_STORY_PAGES.length === ids.length);
  }

  // ===== An embargoed story must not leak =====
  //  The site enforces a publish time in the browser. A generated page puts the
  //  headline into the markup, where no JavaScript has to run to read it — so
  //  the generator has to enforce the same rule, or scheduling a story would
  //  publish it early to anyone who guessed the URL.
  {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "wl-stories-"));
    for (const f of ["article.html", "config.js", "schedule.js", "articles.js", "story-url.js"]) {
      fs.copyFileSync(path.join(SITE, f), path.join(scratch, f));
    }
    const future = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const past = new Date(Date.now() - 3600 * 1000).toISOString();
    fs.writeFileSync(path.join(scratch, "articles.js"), `window.WL_ARTICLES = ${JSON.stringify({
      "out-now": { title: "Already out", deck: "d", section: "News", body: "b", publishAt: past },
      "embargoed": { title: "SECRET HEADLINE", deck: "d", section: "News", body: "b", publishAt: future },
      "no-time": { title: "No schedule set", deck: "d", section: "News", body: "b" },
    })};`);
    fs.writeFileSync(path.join(scratch, "published-content.js"), "");

    const got = Object.keys(articles(scratch));
    check.ok("a story whose time has passed is generated", got.includes("out-now"), got.join(","));
    check.ok("a story with no publish time is generated", got.includes("no-time"), got.join(","));
    check.ok("a story scheduled for the future is NOT generated", !got.includes("embargoed"),
      "an embargoed headline would have been written into a public file");

    build(scratch);
    const files = fs.readdirSync(path.join(scratch, OUT_DIR));
    check.ok("no page exists for the embargoed story", !files.includes("embargoed.html"), files.join(","));
    const blob = files.map(f => fs.readFileSync(path.join(scratch, OUT_DIR, f), "utf8")).join("");
    check.ok("its headline appears nowhere in the generated output",
      !blob.includes("SECRET HEADLINE"));

    fs.rmSync(scratch, { recursive: true, force: true });
  }

  opened.forEach(c => c.close());
  return check;
}
