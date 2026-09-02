// Tags an editor defines, and the choice not to have tags at all.
//
// Tags used to be a free-text box: whatever an editor typed became a tag. Two
// people typing "sports", "Sports" and "sport" produced three tag pages with
// one article each, and nothing told anybody. A paper's tags are a small,
// deliberate vocabulary or they are noise.
//
// So: editors keep a list, articles pick from it, and a paper that does not
// want tags can turn the whole thing off.
import { loadPage, sectionCard, Check } from "../harness.mjs";

const opened = [];
async function editor(storage = {}) {
  const ctx = await loadPage("editor-content.html", { storage });
  opened.push(ctx);
  return ctx;
}

export async function run() {
  const check = new Check();

  // ===== The store =====
  {
    const ctx = await editor();
    const T = ctx.window.WLTags;
    check.ok("there is a tags store", !!T);
    if (!T) { opened.forEach(c => c.close()); return check; }

    check.ok("a paper starts with tags switched off", !T.isEnabled(),
      "a feature nobody asked for should not appear on its own");
    check.equal("and an empty list", T.list(), []);
  }

  // ===== Keeping a list =====
  {
    const ctx = await editor();
    const T = ctx.window.WLTags;
    T.setEnabled(true);
    T.add("Profiles");
    T.add("Opinion");
    check.equal("tags are added in the order given", T.list(), ["Profiles", "Opinion"]);

    check.ok("the same tag twice is refused", !T.add("Profiles").ok);
    check.ok("and case does not sneak a duplicate past", !T.add("profiles").ok,
      "'profiles' was accepted alongside 'Profiles' — this is the bug the list exists to prevent");
    check.equal("so the list is unchanged", T.list().length, 2);

    check.ok("an empty tag is refused", !T.add("   ").ok);
    check.ok("whitespace is trimmed", T.add("  Sports  ").ok && T.list().includes("Sports"));
  }

  {
    const ctx = await editor();
    const T = ctx.window.WLTags;
    T.setEnabled(true);
    T.add("Profiles"); T.add("Opinion");
    T.remove("Profiles");
    check.equal("a tag can be removed", T.list(), ["Opinion"]);
    T.rename("Opinion", "Op-Ed");
    check.equal("and renamed", T.list(), ["Op-Ed"]);
  }

  // ===== Renaming a tag carries the articles with it =====
  //  The whole point of a fixed list is that a tag means one thing. A rename
  //  that left articles pointing at the old word would break that quietly.
  {
    const ctx = await editor();
    const W = ctx.window;
    W.WLTags.setEnabled(true);
    W.WLTags.add("Profiles");
    W.WLArticles.save("a1", { title: "A profile", section: "News", body: ["x"], tags: ["Profiles"] });

    W.WLTags.rename("Profiles", "People");
    check.equal("the article follows the rename", W.WLArticles.getById("a1").tags, ["People"]);
  }

  {
    const ctx = await editor();
    const W = ctx.window;
    W.WLTags.setEnabled(true);
    W.WLTags.add("Profiles");
    W.WLArticles.save("a1", { title: "A profile", section: "News", body: ["x"], tags: ["Profiles"] });

    W.WLTags.remove("Profiles");
    check.equal("removing a tag takes it off the articles too",
      W.WLArticles.getById("a1").tags || [], []);
  }

  // ===== Articles pick from the list, they do not invent =====
  {
    const ctx = await editor();
    const W = ctx.window;
    W.WLTags.setEnabled(true);
    W.WLTags.add("Sports");
    const cleaned = W.WLTags.clean(["Sports", "NotOnTheList", "sports"]);
    check.equal("only tags on the list survive", cleaned, ["Sports"],
      "an off-list tag was kept, which is how free-text sprawl comes back");
  }

  // ===== Turning it off =====
  {
    const ctx = await editor();
    const W = ctx.window;
    W.WLTags.setEnabled(true);
    W.WLTags.add("Sports");
    W.WLArticles.save("a1", { title: "A story", section: "News", body: ["x"], tags: ["Sports"] });
    W.WLTags.setEnabled(false);

    check.ok("switching tags off keeps the list", W.WLTags.list().includes("Sports"),
      "turning a feature off should not destroy the work behind it");
    check.ok("and keeps them on the articles",
      (W.WLArticles.getById("a1").tags || []).includes("Sports"));
    check.ok("so switching back on restores everything",
      (W.WLTags.setEnabled(true), W.WLTags.list().includes("Sports")));
  }

  // ===== What a reader sees =====
  {
    const ctx = await editor();
    const W = ctx.window;
    W.WLTags.setEnabled(true);
    W.WLTags.add("Sports");
    W.WLArticles.save("tagged", { title: "A tagged story", section: "News", byline: "By A", date: "September 2, 2026", body: ["x"], tags: ["Sports"] });
    const stored = {};
    for (let i = 0; i < W.localStorage.length; i++) {
      const k = W.localStorage.key(i);
      if (k && k.startsWith("wl_")) stored[k] = W.localStorage.getItem(k);
    }

    const on = await loadPage("article.html", { editor: false, query: "?id=tagged", storage: stored });
    opened.push(on);
    check.ok("with tags on, a reader sees them", !on.$("#article-tags").hidden,
      "the tag strip stayed hidden");

    stored.wl_tags = JSON.stringify({ ...JSON.parse(stored.wl_tags), enabled: false });
    const off = await loadPage("article.html", { editor: false, query: "?id=tagged", storage: stored });
    opened.push(off);
    check.ok("with tags off, the reader sees none", off.$("#article-tags").hidden,
      "tags rendered on an article after the system was switched off");
    check.clean("and the article still renders cleanly", off);
  }

  // ===== The editor UI =====
  {
    const ctx = await editor();
    check.ok("the Content tab has a place to manage tags", !!ctx.$("#tags-panel"));
    check.ok("with a switch for the whole system", !!ctx.$("#tags-enabled"));
    check.ok("and a way to add one", !!ctx.$("#tag-add"));
  }

  {
    const ctx = await editor();
    ctx.window.WLTags.setEnabled(true);
    ctx.window.WLTags.add("Sports");
    await new Promise(r => setTimeout(r, 20));
    check.ok("an added tag is listed in the panel",
      (ctx.$("#tags-list") || {}).textContent?.includes("Sports"),
      (ctx.$("#tags-list") || {}).textContent);
  }

  // ===== Picking tags on an article: search, not a wall of checkboxes =====
  //  A paper with thirty tags cannot show thirty checkboxes in a modal and call
  //  it a choice. Editors type a few letters and pick from what matches.
  async function editorWithTags(tags) {
    const ctx = await editor();
    ctx.window.WLTags.setEnabled(true);
    tags.forEach(t => ctx.window.WLTags.add(t));
    ctx.window.WLArticleEditor.open(null, { section: "News" });
    return ctx;
  }

  {
    const ctx = await editorWithTags(["Profiles", "Sports", "Opinion", "Science"]);
    check.ok("there is a search box, not a checkbox list", !!ctx.$("#ed-tag-search"));
    check.equal("no checkboxes are dumped on the page", ctx.$$(".ed-tag-box").length, 0);
    check.ok("nothing is suggested before you type", !ctx.$$("#ed-tag-results .ed-tag-option").length);
  }

  {
    const ctx = await editorWithTags(["Profiles", "Sports", "Opinion", "Science"]);
    ctx.type(ctx.$("#ed-tag-search"), "sc");
    const shown = ctx.$$("#ed-tag-results .ed-tag-option").map(o => o.textContent.trim());
    check.equal("typing filters the list", shown, ["Science"]);

    ctx.type(ctx.$("#ed-tag-search"), "o");
    const many = ctx.$$("#ed-tag-results .ed-tag-option").map(o => o.textContent.trim());
    check.ok("a looser match shows everything containing it",
      many.includes("Profiles") && many.includes("Opinion"), many.join(", "));
    check.ok("and excludes what does not match", !many.includes("Science"), many.join(", "));
  }

  {
    const ctx = await editorWithTags(["Profiles", "Sports"]);
    ctx.type(ctx.$("#ed-tag-search"), "pro");
    ctx.click(ctx.$("#ed-tag-results .ed-tag-option"));

    check.ok("picking one adds it as a chip",
      ctx.$$("#ed-tag-chips .ed-tag-chip").some(c => c.textContent.includes("Profiles")),
      ctx.$("#ed-tag-chips").textContent);
    check.equal("and clears the search so the next one is easy", ctx.$("#ed-tag-search").value, "");
    check.ok("a tag already chosen is not offered again",
      !ctx.$$("#ed-tag-results .ed-tag-option").some(o => o.textContent.includes("Profiles")));
  }

  {
    const ctx = await editorWithTags(["Profiles", "Sports"]);
    ctx.type(ctx.$("#ed-tag-search"), "pro");
    ctx.click(ctx.$("#ed-tag-results .ed-tag-option"));
    ctx.click(ctx.$("#ed-tag-chips .ed-tag-chip button"));
    check.equal("a chip can be removed", ctx.$$("#ed-tag-chips .ed-tag-chip").length, 0);
  }

  {
    const ctx = await editorWithTags(["Profiles"]);
    ctx.type(ctx.$("#ed-tag-search"), "somethingelse");
    check.equal("a tag that is not on the list matches nothing", ctx.$$("#ed-tag-results .ed-tag-option").length, 0);
    check.ok("and it says so rather than looking broken",
      /no tag|not on the list|no match/i.test(ctx.$("#ed-tag-results").textContent),
      ctx.$("#ed-tag-results").textContent);

    const box = ctx.$("#ed-tag-search");
    box.dispatchEvent(new ctx.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    check.equal("pressing Enter cannot invent a tag", ctx.$$("#ed-tag-chips .ed-tag-chip").length, 0,
      "free text got in, which is the thing the list exists to prevent");
  }

  {
    // Enter on a single match is the fast path an editor will actually use.
    const ctx = await editorWithTags(["Profiles", "Sports"]);
    const box = ctx.$("#ed-tag-search");
    ctx.type(box, "spo");
    box.dispatchEvent(new ctx.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    check.ok("Enter picks the only match",
      ctx.$("#ed-tag-chips").textContent.includes("Sports"), ctx.$("#ed-tag-chips").textContent);
  }

  {
    // Editing an article shows what it already has.
    const ctx = await editor();
    ctx.window.WLTags.setEnabled(true);
    ["Profiles", "Sports"].forEach(t => ctx.window.WLTags.add(t));
    ctx.window.WLArticles.save("a9", { title: "T", section: "News", body: ["x"], tags: ["Sports"] });
    ctx.window.WLArticleEditor.open("a9");
    check.ok("an article's existing tags appear as chips",
      ctx.$("#ed-tag-chips").textContent.includes("Sports"), ctx.$("#ed-tag-chips").textContent);
  }

  {
    const ctx = await editor();          // tags switched off
    ctx.window.WLArticleEditor.open(null, { section: "News" });
    check.ok("with tags off the whole field is gone",
      ctx.$("#ed-tags-wrap").style.display === "none");
  }

  opened.forEach(c => c.close());
  return check;
}
