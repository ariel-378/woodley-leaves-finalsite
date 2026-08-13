// Planning an edition: everything can be dated forward, not just articles.
//
// Articles have always taken a publish date and time and stayed hidden until
// it arrived. Nothing else did — a poem, a photo, a video, a custom feature or
// a game went live the instant it was saved. So an editor could not build next
// week's edition ahead of time; they had to sit on the work and paste it in on
// the day.
//
// The rule is the same for every kind of content now, and it is one
// implementation rather than six: no publish time, or one already past, means
// live; a future one means scheduled, visible in the dashboard and nowhere
// else.
import { loadPage, sectionCard, Check } from "../harness.mjs";

const opened = [];
async function open(page, opts) {
  const ctx = await loadPage(page, opts);
  opened.push(ctx);
  return ctx;
}

/** A local datetime-local string, offset from now by whole hours. */
const hoursFromNow = h => {
  const d = new Date(Date.now() + h * 3600 * 1000);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** What a reader sees, without the script sources the harness inlines. */
const visibleText = ctx => {
  const body = ctx.document.body.cloneNode(true);
  body.querySelectorAll("script, style, template").forEach(el => el.remove());
  return body.textContent.replace(/\s+/g, " ");
};

const FUTURE = "A poem for next Friday";
const LIVE = "A poem for right now";

export async function run() {
  const check = new Check();

  // ===== One rule, in one place =====
  {
    const ctx = await open("editor-content.html");
    const S = ctx.window.WLSchedule;
    check.ok("there is a shared scheduler", !!S);
    if (!S) { opened.forEach(c => c.close()); return check; }

    check.ok("nothing scheduled means live", S.isLive({}));
    check.ok("an empty publish time means live", S.isLive({ publishAt: "" }));
    check.ok("a time already past means live", S.isLive({ publishAt: hoursFromNow(-2) }));
    check.ok("a time still to come means not yet", !S.isLive({ publishAt: hoursFromNow(2) }));
    check.ok("and that counts as scheduled", S.isScheduled({ publishAt: hoursFromNow(2) }));
    check.ok("something already live is not 'scheduled'", !S.isScheduled({ publishAt: hoursFromNow(-2) }));

    // A typo must not hide someone's work forever.
    check.ok("an unparseable date is treated as live, not lost",
      S.isLive({ publishAt: "next tuesday-ish" }));
  }

  // ===== Articles keep working, through the same rule =====
  {
    const ctx = await open("editor-content.html");
    const W = ctx.window;
    W.WLArticles.save("sched-article", {
      title: "Tomorrow's story", section: "News", byline: "By A Reporter",
      date: "September 4, 2026", body: ["Not yet."], publishAt: hoursFromNow(24),
    });
    check.ok("a future-dated article is still hidden from readers",
      !W.WLArticles.isVisible(W.WLArticles.getById("sched-article")));
  }

  // ===== A piece can be dated forward =====
  {
    const ctx = await open("editor-content.html");
    const W = ctx.window;
    const own = W.WLSections.firstWithType("Poems");

    W.WLCenterspread.save("poem-live", {
      type: "poem", title: LIVE, byline: "By A Poet", body: ["Now."], section: own,
    });
    W.WLCenterspread.save("poem-later", {
      type: "poem", title: FUTURE, byline: "By A Poet", body: ["Later."],
      section: own, publishAt: hoursFromNow(48),
    });
    await new Promise(r => setTimeout(r, 20));

    const card = sectionCard(ctx, own);
    const text = card ? card.textContent : "";
    check.ok("the editor still sees the scheduled poem", text.includes(FUTURE), text.slice(0, 160));
    check.ok("and marks it as scheduled rather than live",
      /⏳|Scheduled/i.test(text), text.replace(/\s+/g, " ").slice(0, 200));
  }

  {
    // The reader's side of the same thing.
    const ctx = await open("editor-content.html");
    const W = ctx.window;
    const own = W.WLSections.firstWithType("Poems");
    W.WLCenterspread.save("poem-live", { type: "poem", title: LIVE, byline: "By A Poet", body: ["Now."], section: own });
    W.WLCenterspread.save("poem-later", {
      type: "poem", title: FUTURE, byline: "By A Poet", body: ["Later."],
      section: own, publishAt: hoursFromNow(48),
    });

    const stored = {};
    for (const k of ["wl_sections", "wl_cs_pieces", "wl_cs_order"]) {
      const v = W.localStorage.getItem(k);
      if (v) stored[k] = v;
    }

    const page = await open("centerspread.html", { editor: false, storage: stored });
    const text = visibleText(page);
    check.ok("a reader sees the piece that is live", text.includes(LIVE), text.slice(0, 200));
    check.ok("and not the one dated for later", !text.includes(FUTURE),
      "a scheduled piece was published early");
    check.clean("the page renders cleanly", page);
  }

  // ===== Videos, features and games follow the same rule =====
  {
    const ctx = await open("editor-content.html");
    const S = ctx.window.WLSchedule;
    const later = { publishAt: hoursFromNow(12) };

    check.ok("a video can be dated forward", !S.isLive(later));
    check.ok("so can a feature", S.isScheduled(later));
    check.ok("and a game", S.isScheduled(later));
  }

  {
    const ctx = await open("editor-content.html");
    const W = ctx.window;
    const own = W.WLSections.firstWithType("Videos");
    if (own && W.WLVideos) {
      W.WLVideos.save("vid-later", {
        title: "Next week's highlights", section: own,
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        publishAt: hoursFromNow(72),
      });
      const stored = {};
      for (const k of ["wl_sections", "wl_videos"]) {
        const v = W.localStorage.getItem(k);
        if (v) stored[k] = v;
      }
      const page = await open("videos.html", { editor: false, storage: stored });
      check.ok("a scheduled video stays off the video page",
        !visibleText(page).includes("Next week's highlights"),
        visibleText(page).slice(0, 200));
    } else {
      check.ok("no Videos section in this build, nothing to check", true);
    }
  }

  // ===== The editors offer the field =====
  {
    const ctx = await open("editor-content.html");
    // The piece modal covers poems, art and reveal-answer items.
    check.ok("the piece editor has a publish date and time",
      !!ctx.$("#pc-publish") && ctx.$("#pc-publish").type === "datetime-local");
    check.ok("the video editor has one", !!ctx.$("#v-publish"));
  }

  {
    const ctx = await open("editor-content.html");
    ctx.window.WLCodeEditor.open({ kind: "feature" });
    check.ok("the custom feature and game editor has one too",
      !!ctx.$("#code-publish") && ctx.$("#code-publish").type === "datetime-local");
  }

  opened.forEach(c => c.close());
  return check;
}
