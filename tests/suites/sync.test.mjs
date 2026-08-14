// Shared editing: two editors, one paper.
//
// Every edit lived in one browser's localStorage, so a co-editor saw nothing
// until somebody downloaded a file and handed it over. This is the layer that
// keeps browsers in step through a shared store, so work — including what is
// scheduled — shows up for everyone without anyone exporting anything.
//
// The dangerous part is the merge. A naive "send everything I have" lets one
// editor's save flatten another's work, which is the exact class of silent loss
// this codebase keeps having to fix. So these lean hard on: only push what THIS
// browser changed, and never let an incoming change overwrite an edit that
// hasn't been sent yet.
import { loadPage, Check } from "../harness.mjs";

const opened = [];

/**
 * An editor's browser wired to a fake shared store. `server.data` is what the
 * backend holds; every request is recorded so the tests can assert what was
 * actually sent, not merely what ended up on screen.
 */
async function editorWith(server, storage = {}) {
  const ctx = await loadPage("editor-content.html", {
    storage,
    beforeParse(w) {
      w.WL_SYNC_TEST = server;
      w.fetch = (url, opts = {}) => {
        const method = (opts.method || "GET").toUpperCase();
        server.calls.push({ url: String(url), method, body: opts.body ? JSON.parse(opts.body) : null });
        if (server.offline) return Promise.reject(new Error("offline"));
        if (method === "GET") {
          return Promise.resolve({
            ok: true, status: 200,
            json: () => Promise.resolve({ version: server.version, data: server.data }),
          });
        }
        const changes = (opts.body ? JSON.parse(opts.body) : {}).changes || {};
        Object.keys(changes).forEach(k => {
          if (changes[k] === null) delete server.data[k];
          else server.data[k] = changes[k];
        });
        server.version++;
        return Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve({ version: server.version }),
        });
      };
    },
  });
  opened.push(ctx);
  ctx.window.WL_CONFIG.sync = { endpoint: "https://paper.example.workers.dev", key: "test-key" };
  return ctx;
}

const newServer = (data = {}) => ({ data, version: 1, calls: [], offline: false });
const settle = () => new Promise(r => setTimeout(r, 30));

export async function run() {
  const check = new Check();

  // ===== It only claims to be on when it has somewhere to go =====
  {
    const ctx = await loadPage("editor-content.html");
    opened.push(ctx);
    check.ok("there is a sync layer", !!ctx.window.WLSync);
    check.ok("with no endpoint configured it stays off",
      !ctx.window.WLSync.isConfigured());
    check.equal("and reports itself as off", ctx.window.WLSync.status().state, "off");
    check.clean("a site with no backend is unaffected", ctx);
  }

  // ===== Pulling another editor's work =====
  {
    const server = newServer({
      wl_articles_custom: { "from-a-co-editor": { title: "A co-editor's story", section: "News", body: ["Hers."] } },
    });
    const ctx = await editorWith(server);
    await ctx.window.WLSync.pullNow();
    await settle();

    check.ok("a co-editor's article arrives in this browser",
      !!ctx.window.WLArticles.getById("from-a-co-editor"),
      Object.keys(ctx.window.WLArticles.getAll()).join(", "));
    check.ok("and the dashboard is told to redraw",
      ctx.document.body.textContent.includes("A co-editor's story"),
      "the page did not re-render after a pull");
  }

  // ===== Pushing only what this browser changed =====
  {
    const server = newServer({
      wl_articles_custom: { "theirs": { title: "Someone else's", section: "News", body: ["Theirs."] } },
      wl_videos_custom: { "their-video": { title: "Their video" } },
    });
    const ctx = await editorWith(server);
    await ctx.window.WLSync.pullNow();
    await settle();

    ctx.window.WLStaff ? null : null;
    ctx.window.WLArticles.save("mine", { title: "My story", section: "News", body: ["Mine."] });
    await ctx.window.WLSync.pushNow();
    await settle();

    const push = server.calls.filter(c => c.method !== "GET").pop();
    check.ok("a push happened", !!push, server.calls.map(c => c.method).join(","));
    const sent = Object.keys((push && push.body && push.body.changes) || {});
    // Saving an article legitimately writes more than one articles key, so the
    // invariant is not a count — it is that untouched things never travel.
    check.ok("it sends the article keys this browser changed",
      sent.includes("wl_articles_custom"), sent.join(", "));
    check.ok("videos nobody here edited are not resent",
      !sent.includes("wl_videos_custom"), sent.join(", "));
    check.ok("and nothing outside articles is sent at all",
      sent.every(k => k.startsWith("wl_articles")), sent.join(", "));
  }

  // ===== One editor's save must not flatten another's =====
  {
    const server = newServer({
      wl_articles_custom: { "theirs": { title: "Theirs", section: "News", body: ["T."] } },
    });
    const ctx = await editorWith(server);
    await ctx.window.WLSync.pullNow();
    await settle();

    // Meanwhile, on the other side of the newsroom.
    server.data.wl_videos_custom = { "late-video": { title: "Added by a co-editor" } };
    server.version++;

    ctx.window.WLArticles.save("mine", { title: "Mine", section: "News", body: ["M."] });
    await ctx.window.WLSync.pushNow();
    await settle();

    check.ok("the co-editor's video is still on the server",
      !!server.data.wl_videos_custom, JSON.stringify(Object.keys(server.data)));
    check.ok("and this editor's article is there too",
      !!(server.data.wl_articles_custom || {}).mine, JSON.stringify(server.data.wl_articles_custom || {}));
    check.ok("without losing the article that was already there",
      !!(server.data.wl_articles_custom || {}).theirs);
  }

  // ===== An incoming change never clobbers unsent local work =====
  {
    const server = newServer({});
    const ctx = await editorWith(server);
    await ctx.window.WLSync.pullNow();
    await settle();

    // This editor writes something and has NOT pushed yet.
    ctx.window.WLArticles.save("in-progress", { title: "Half written", section: "News", body: ["Draft."] });

    // The server meanwhile has a different version of the same key.
    server.data.wl_articles_custom = { "other": { title: "From elsewhere", section: "News", body: ["E."] } };
    server.version++;

    await ctx.window.WLSync.pullNow();
    await settle();

    check.ok("the unsent draft survives the pull",
      !!ctx.window.WLArticles.getById("in-progress"),
      "a pull overwrote work that had not been sent — the bug this guards");
  }

  // ===== Offline is survivable, and says so =====
  {
    const server = newServer({});
    const ctx = await editorWith(server);
    server.offline = true;

    ctx.window.WLArticles.save("written-offline", { title: "Written offline", section: "News", body: ["O."] });
    await ctx.window.WLSync.pushNow();
    await settle();

    check.ok("the edit is still here", !!ctx.window.WLArticles.getById("written-offline"));
    check.equal("and sync says it is offline", ctx.window.WLSync.status().state, "offline");

    server.offline = false;
    await ctx.window.WLSync.pushNow();
    await settle();
    check.ok("when the connection returns, the work goes up",
      !!(server.data.wl_articles_custom || {})["written-offline"],
      JSON.stringify(Object.keys(server.data)));
    check.equal("and it reports itself synced", ctx.window.WLSync.status().state, "synced");
  }

  // ===== Deleting something deletes it for everyone =====
  {
    const server = newServer({ wl_videos_custom: { "gone": { title: "To be deleted" } } });
    const ctx = await editorWith(server);
    await ctx.window.WLSync.pullNow();
    await settle();

    ctx.window.localStorage.removeItem("wl_videos_custom");
    await ctx.window.WLSync.pushNow();
    await settle();
    check.ok("a removed key is removed on the server too",
      !server.data.wl_videos_custom, JSON.stringify(Object.keys(server.data)));
  }

  // ===== Scheduled work is shared like anything else =====
  {
    const server = newServer({});
    const ctx = await editorWith(server);
    const soon = new Date(Date.now() + 36 * 3600 * 1000);
    const p = n => String(n).padStart(2, "0");
    const at = `${soon.getFullYear()}-${p(soon.getMonth() + 1)}-${p(soon.getDate())}T${p(soon.getHours())}:${p(soon.getMinutes())}`;

    ctx.window.WLArticles.save("planned", {
      title: "Planned for Friday", section: "News", body: ["Later."], publishAt: at,
    });
    await ctx.window.WLSync.pushNow();
    await settle();

    const other = await editorWith(server);
    await other.window.WLSync.pullNow();
    await settle();

    check.ok("a second editor receives the scheduled piece",
      !!other.window.WLArticles.getById("planned"));
    check.ok("and sees it on their own plan",
      other.window.WLSchedule.collect().some(x => x.title === "Planned for Friday"),
      other.window.WLSchedule.collect().map(x => x.title).join(", "));
  }

  // ===== The editor is told what is happening =====
  {
    const server = newServer({});
    const ctx = await editorWith(server);
    await ctx.window.WLSync.pullNow();
    await settle();
    const el = ctx.$("#wl-sync-status");
    check.ok("the publish panel shows a sync status", !!el);
    check.ok("naming the state in words, not jargon",
      el && /shared|sync|saved|up to date/i.test(el.textContent), el && el.textContent);
  }

  // ===== Sync failing must never stop someone editing =====
  //  `fetch` can be absent, or blocked by a policy. It throws synchronously, so
  //  it escapes the promise handlers and would take the whole dashboard with
  //  it — every editor page, not just the sync status line.
  {
    const ctx = await loadPage("editor-content.html", {
      beforeParse(w) { delete w.fetch; },
    });
    opened.push(ctx);
    ctx.window.WL_CONFIG.sync = { endpoint: "https://paper.example.workers.dev", key: "k" };
    await ctx.window.WLSync.pullNow();
    await settle();

    check.clean("a browser with no fetch still loads the dashboard", ctx);
    check.equal("and sync simply reports itself offline", ctx.window.WLSync.status().state, "offline");

    ctx.window.WLArticles.save("still-works", { title: "Written anyway", section: "News", body: ["Yes."] });
    check.ok("and editing carries on working",
      !!ctx.window.WLArticles.getById("still-works"));
  }

  // ===== It must not become a condition of using this code =====
  //  These repos are offered to a host platform to integrate. Shared editing is
  //  a standalone answer for a paper with no host integration yet — if the host
  //  becomes the system of record it is switched off, or two systems write the
  //  same content and one overwrites the other. So it has to be genuinely
  //  optional, and the shipped default has to be off.
  {
    const ctx = await loadPage("editor-content.html");
    opened.push(ctx);
    check.ok("sync is a plain config block a school can empty",
      typeof (ctx.window.WL_CONFIG.sync || {}) === "object");
    check.ok("and emptying it turns the whole layer off",
      !ctx.window.WLSync.isConfigured(),
      "the harness blanks the endpoint; sync still thought it was on");
  }

  {
    const ctx = await loadPage("index.html", { editor: false });
    opened.push(ctx);
    check.clean("a reader's page never touches the sync layer", ctx);
    check.ok("readers do not even load it",
      ![...ctx.document.querySelectorAll("script")].some(x => (x.src || "").includes("sync.js")),
      "sync.js was loaded on a reader page");
  }

  opened.forEach(c => c.close());
  return check;
}
