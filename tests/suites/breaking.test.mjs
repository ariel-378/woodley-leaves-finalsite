// The breaking-news banner picks one story. Which one.
//
// It used to be simply the newest article in Breaking. That is wrong the moment
// an editor deliberately features something: they have said "this is the story",
// and the banner ignored them because a later one existed. Featured wins; newest
// is the fallback when nothing is featured.
import { loadPage, Check } from "../harness.mjs";

const opened = [];

/** Seed Breaking with dated stories, then read what the banner ended up showing. */
async function bannerFor(seed) {
  const ed = await loadPage("editor-content.html");
  opened.push(ed);
  const W = ed.window;
  Object.keys(W.WLArticles.getAll()).forEach(id => {
    if (W.WLArticles.getById(id).section === "Breaking") W.WLArticles.remove(id);
  });
  seed(W);
  const stored = {};
  for (let i = 0; i < W.localStorage.length; i++) {
    const k = W.localStorage.key(i);
    if (k && k.startsWith("wl_")) stored[k] = W.localStorage.getItem(k);
  }
  const home = await loadPage("index.html", { editor: false, storage: stored });
  opened.push(home);
  const banner = home.$("#breaking-banner");
  return {
    home,
    shown: banner && banner.style.display !== "none"
      ? (banner.querySelectorAll("span")[1] || {}).textContent || ""
      : null,
  };
}

const story = (W, id, title, date) =>
  W.WLArticles.save(id, { title, section: "Breaking", byline: "By A Reporter", date, deck: "d", body: ["x"] });

export async function run() {
  const check = new Check();

  // ===== With nothing featured, the newest wins =====
  {
    const { shown } = await bannerFor(W => {
      story(W, "older", "The older breaking story", "September 1, 2026");
      story(W, "newest", "The newest breaking story", "September 3, 2026");
    });
    check.ok("the newest breaking story is shown", (shown || "").includes("The newest breaking story"), shown);
  }

  // ===== A featured pick beats a newer story =====
  {
    const { shown } = await bannerFor(W => {
      story(W, "featured-one", "The featured breaking story", "September 1, 2026");
      story(W, "newer", "A newer breaking story", "September 3, 2026");
      W.WLArticles.setFeatured("Breaking", "featured-one");
    });
    check.ok("featuring a story puts it in the banner",
      (shown || "").includes("The featured breaking story"), shown);
    check.ok("even though a newer one exists",
      !(shown || "").includes("A newer breaking story"), shown);
  }

  // ===== A featured pick that readers cannot see does not win =====
  //  Featuring something scheduled for Friday must not put Friday's headline in
  //  the banner today. The fallback has to take over.
  {
    const future = new Date(Date.now() + 48 * 3600 * 1000);
    const p = n => String(n).padStart(2, "0");
    const at = `${future.getFullYear()}-${p(future.getMonth() + 1)}-${p(future.getDate())}T09:00`;
    const { shown } = await bannerFor(W => {
      W.WLArticles.save("scheduled", {
        title: "Not out until Friday", section: "Breaking", byline: "By A", date: "September 5, 2026",
        deck: "d", body: ["x"], publishAt: at,
      });
      story(W, "live", "The live breaking story", "September 1, 2026");
      W.WLArticles.setFeatured("Breaking", "scheduled");
    });
    check.ok("a scheduled featured pick is not shown early",
      !(shown || "").includes("Not out until Friday"), shown);
    check.ok("and the banner falls back to a story readers can actually read",
      (shown || "").includes("The live breaking story"), shown);
  }

  // ===== Nothing in Breaking, no banner =====
  {
    const { home, shown } = await bannerFor(() => {});
    check.equal("with no breaking story the banner is hidden", shown, null);
    check.clean("and the home page renders cleanly", home);
  }

  // ===== Un-featuring returns it to the newest =====
  {
    const { shown } = await bannerFor(W => {
      story(W, "old-pick", "The old featured story", "September 1, 2026");
      story(W, "newer", "A newer breaking story", "September 3, 2026");
      W.WLArticles.setFeatured("Breaking", "old-pick");
      W.WLArticles.setFeatured("Breaking", null);
    });
    check.ok("removing the feature falls back to the newest",
      (shown || "").includes("A newer breaking story"), shown);
  }

  opened.forEach(c => c.close());
  return check;
}
