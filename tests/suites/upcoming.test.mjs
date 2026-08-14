// The Schedule tab: everything the paper has waiting, in the order it lands.
//
// Publish times were already per-item, but they were scattered — a ⏳ on one
// row of one section card, and another somewhere else. There was no way to
// answer "what goes out this week, and in what order", which is the actual
// question an editor planning an edition has.
//
// This covers the gathering (every store, one list, sorted) and the screen
// built on it.
import { loadPage, Check } from "../harness.mjs";

const opened = [];
async function open(page, opts) {
  const ctx = await loadPage(page, opts);
  opened.push(ctx);
  return ctx;
}

/** A datetime-local string, offset from now by whole hours. */
const hoursFromNow = h => {
  const d = new Date(Date.now() + h * 3600 * 1000);
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Fill one editor browser with a plan spread across the next few days. */
function seedPlan(W) {
  const poems = W.WLSections.firstWithType("Poems");
  W.WLArticles.save("plan-article", {
    title: "Monday's lead story", section: "News", byline: "By A Reporter",
    date: "September 7, 2026", body: ["Waiting."], publishAt: hoursFromNow(50),
  });
  W.WLCenterspread.save("plan-poem", {
    type: "poem", title: "Friday's poem", byline: "By A Poet",
    body: ["Waiting."], section: poems, publishAt: hoursFromNow(2),
  });
  W.WLCenterspread.save("plan-live", {
    type: "poem", title: "Already out", byline: "By A Poet", body: ["Live."], section: poems,
  });
  if (W.WLVideos) {
    W.WLVideos.save("plan-video", {
      title: "Tomorrow's highlights", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      publishAt: hoursFromNow(26),
    });
  }
}

export async function run() {
  const check = new Check();

  // ===== Gathering =====
  {
    const ctx = await open("editor-content.html");
    const W = ctx.window;
    check.ok("the scheduler can gather what's waiting", typeof W.WLSchedule.collect === "function");
    if (typeof W.WLSchedule.collect !== "function") { opened.forEach(c => c.close()); return check; }

    seedPlan(W);
    const plan = W.WLSchedule.collect();
    const titles = plan.map(x => x.title);

    check.ok("an upcoming article is in the plan", titles.includes("Monday's lead story"), titles.join(" | "));
    check.ok("so is an upcoming poem", titles.includes("Friday's poem"));
    check.ok("and an upcoming video", titles.includes("Tomorrow's highlights"));
    check.ok("something already published is not",
      !titles.includes("Already out"), "a live item was listed as upcoming");

    check.ok("every entry says what kind of thing it is", plan.every(x => !!x.kind), JSON.stringify(plan[0] || {}));
    check.ok("and which section it belongs to", plan.every(x => typeof x.section === "string"));
  }

  {
    const ctx = await open("editor-content.html");
    const W = ctx.window;
    seedPlan(W);
    const times = W.WLSchedule.collect().map(x => x.at);
    const sorted = times.slice().sort((a, b) => a - b);
    check.equal("the plan comes back in the order it will happen", times, sorted);
    check.ok("soonest first", W.WLSchedule.collect()[0].title === "Friday's poem",
      W.WLSchedule.collect().map(x => x.title).join(" | "));
  }

  {
    const ctx = await open("editor-content.html");
    check.equal("with nothing scheduled, the plan is empty", ctx.window.WLSchedule.collect(), []);
  }

  // ===== The screen =====
  {
    const ctx = await open("editor-schedule.html");
    check.ok("there is a Schedule page", !!ctx.$("#sched-list"));
    check.ok("it says so when nothing is waiting",
      /nothing scheduled/i.test(ctx.document.body.textContent),
      ctx.document.body.textContent.replace(/\s+/g, " ").slice(0, 160));
    check.clean("and renders cleanly when empty", ctx);
  }

  {
    const ed = await open("editor-content.html");
    seedPlan(ed.window);
    const stored = {};
    for (let i = 0; i < ed.window.localStorage.length; i++) {
      const k = ed.window.localStorage.key(i);
      if (k && k.startsWith("wl_")) stored[k] = ed.window.localStorage.getItem(k);
    }

    const ctx = await open("editor-schedule.html", { storage: stored });
    const text = ctx.document.body.textContent.replace(/\s+/g, " ");

    check.ok("the screen lists the upcoming article", text.includes("Monday's lead story"), text.slice(0, 200));
    check.ok("the upcoming poem", text.includes("Friday's poem"));
    check.ok("and the upcoming video", text.includes("Tomorrow's highlights"));
    check.ok("but not something already published", !text.includes("Already out"));

    const rows = ctx.$$("#sched-list .sched-item");
    check.ok("each one is its own row", rows.length >= 3, `${rows.length} rows`);
    check.ok("the soonest is listed first",
      rows.length && rows[0].textContent.includes("Friday's poem"),
      rows.length ? rows[0].textContent.replace(/\s+/g, " ").slice(0, 90) : "no rows");

    check.ok("rows are grouped under the day they land on", ctx.$$("#sched-list .sched-day").length >= 2,
      `${ctx.$$("#sched-list .sched-day").length} day headings`);
    check.ok("each row says what kind of thing it is",
      rows.length && /Article|Poem|Video/i.test(rows[0].textContent));
    check.clean("the screen renders cleanly with a full plan", ctx);
  }

  // ===== Deciding to run something early =====
  //  Plans change. Without this an editor has to find the piece in another tab
  //  and clear a date field by hand.
  {
    const ed = await open("editor-content.html");
    seedPlan(ed.window);
    const stored = {};
    for (let i = 0; i < ed.window.localStorage.length; i++) {
      const k = ed.window.localStorage.key(i);
      if (k && k.startsWith("wl_")) stored[k] = ed.window.localStorage.getItem(k);
    }

    const ctx = await open("editor-schedule.html", { storage: stored });
    const before = ctx.$$("#sched-list .sched-item").length;
    const first = ctx.$("#sched-list .sched-item");
    const title = first.querySelector(".sched-title").textContent;

    ctx.click(first.querySelector("[data-now]"));

    check.equal("publishing one now takes it off the plan",
      ctx.$$("#sched-list .sched-item").length, before - 1);
    check.ok("and it is gone from the list",
      !ctx.document.body.textContent.includes(title), title);
    check.ok("it is live for readers immediately",
      ctx.window.WLSchedule.collect().every(x => x.title !== title));
    check.clean("publishing early throws nothing", ctx);
  }

  {
    // The count has to follow, or the screen contradicts itself.
    const ed = await open("editor-content.html");
    ed.window.WLArticles.save("only-one", {
      title: "The only scheduled thing", section: "News", byline: "By A Reporter",
      date: "September 4, 2026", body: ["Waiting."], publishAt: hoursFromNow(30),
    });
    const stored = {};
    for (let i = 0; i < ed.window.localStorage.length; i++) {
      const k = ed.window.localStorage.key(i);
      if (k && k.startsWith("wl_")) stored[k] = ed.window.localStorage.getItem(k);
    }
    const ctx = await open("editor-schedule.html", { storage: stored });
    check.ok("one waiting item reads as one", /1 piece waiting/.test(ctx.$("#sched-count").textContent),
      ctx.$("#sched-count").textContent);

    ctx.click(ctx.$("[data-now]"));
    check.ok("and publishing it returns the screen to its empty state",
      /nothing scheduled/i.test(ctx.document.body.textContent),
      ctx.document.body.textContent.replace(/\s+/g, " ").slice(0, 120));
  }

  // ===== It is reachable, and it is editors-only =====
  {
    const ctx = await open("editor-content.html");
    check.ok("the dashboard's tab bar links to it",
      !!ctx.$('.ed-tabs a[href="editor-schedule.html"]'),
      [...ctx.$$(".ed-tabs a")].map(a => a.getAttribute("href")).join(", "));
  }

  {
    const ctx = await open("editor-schedule.html", { editor: false });
    check.ok("a reader who lands on it is asked for editor access",
      /editor/i.test(ctx.document.body.textContent),
      ctx.document.body.textContent.replace(/\s+/g, " ").slice(0, 120));
    check.ok("and is shown no part of the plan", !ctx.$("#sched-list .sched-item"));
  }

  // ===== Each tab explains the other =====
  //  Scheduling and publishing are sequential, not alternatives: a publish time
  //  decides WHEN a piece appears; publishing is what puts it on the site at
  //  all. Wording that blurred them led to "we have scheduling now, we can drop
  //  publishing" — which would have left the paper unable to reach anyone.
  {
    const ctx = await open("editor-schedule.html");
    const text = ctx.document.body.textContent.replace(/\s+/g, " ");
    check.ok("the Schedule tab says scheduling does not send anything to readers",
      /does not send it to readers|not a substitute/i.test(text), text.slice(0, 240));
    check.ok("and points at where publishing happens",
      /Download to publish/i.test(text) && !!ctx.$('a[href="editor-content.html"]'));
    check.ok("it no longer claims published items are already on the site",
      !/it is on the site/i.test(text), text.slice(0, 200));
  }

  {
    const ctx = await open("editor-content.html");
    const text = ctx.document.body.textContent.replace(/\s+/g, " ");
    // Assert the meaning, not one phrasing — the panel's line is written at
    // runtime and says something different once shared editing is configured.
    check.ok("the Content tab names what actually puts work on the site",
      /puts them on the site|publishes itself/i.test(text), text.slice(0, 240));
    check.ok("and that a publish date does not send anything anywhere",
      /does not send it anywhere|not a substitute|reaches nobody/i.test(text), text.slice(0, 240));
    check.ok("linking to the Schedule tab", !!ctx.$('a[href="editor-schedule.html"]'));
  }

  // ===== Unpublished work is called out on the plan =====
  {
    const ed = await open("editor-content.html");
    seedPlan(ed.window);
    const stored = {};
    for (let i = 0; i < ed.window.localStorage.length; i++) {
      const k = ed.window.localStorage.key(i);
      if (k && k.startsWith("wl_")) stored[k] = ed.window.localStorage.getItem(k);
    }
    const ctx = await open("editor-schedule.html", { storage: stored });
    const banner = ctx.$("#sched-unpublished");
    check.ok("a browser with unpublished changes says so on the plan",
      banner && !banner.hidden, banner ? "hidden" : "no banner");
    check.ok("and names the step that fixes it",
      banner && /Download to publish/i.test(banner.textContent), banner && banner.textContent);
  }

  {
    const ctx = await open("editor-schedule.html");
    const banner = ctx.$("#sched-unpublished");
    check.ok("with nothing unpublished, the warning stays out of the way",
      banner && banner.hidden);
  }

  opened.forEach(c => c.close());
  return check;
}
