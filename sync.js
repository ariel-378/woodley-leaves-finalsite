// ============================================================================
//  SYNC — one paper, several editors, no "download to publish".
//
//  Every edit is written to this browser's localStorage by its store. That is
//  private to one browser, so a co-editor saw nothing until somebody exported a
//  file and handed it over. This keeps browsers in step through a shared store,
//  so work — including what is scheduled — appears for everyone on its own.
//
//  Off by default. With no `sync.endpoint` in config.js nothing here runs and
//  the site behaves exactly as it did.
//
//  ── THE MERGE RULE, WHICH IS THE WHOLE PROBLEM ───────────────────────────────
//
//  The obvious design — "send everything I have" — quietly destroys work: two
//  editors both send a full snapshot, and whoever saves second erases whatever
//  the first added in between. So:
//
//    • Push only the keys THIS browser changed since it last synced, worked out
//      by comparing against a remembered baseline. Keys nobody here touched are
//      never sent, so they cannot be flattened.
//    • On pull, apply an incoming key only if this browser has NOT changed it.
//      Unsent local work always wins over the server until it has been pushed.
//
//  Both rules exist to protect the same thing: an editor's unsaved paragraph.
//
//  ── WHAT IT IS NOT ──────────────────────────────────────────────────────────
//
//  Not real-time collaboration. Two editors typing into the SAME article at the
//  same moment will still have one of them win — the loser's version goes to
//  the server and is then replaced. It keeps a newsroom of a few people out of
//  each other's way; it is not Google Docs.
// ============================================================================
window.WLSync = (function () {
  var PUSH_DEBOUNCE_MS = 1500;    // let a burst of typing settle before sending
  var POLL_MS = 20000;            // how often to look for a co-editor's work
  var BASELINE = "wl_sync_baseline";   // per-device: what we last agreed with the server

  var state = { state: "off", at: null, message: "" };
  var timer = null, poller = null, started = false;

  function config() {
    var c = (window.WL_CONFIG || {}).sync || {};
    return { endpoint: String(c.endpoint || "").trim().replace(/\/+$/, ""), key: String(c.key || "").trim() };
  }

  function isConfigured() { return !!config().endpoint; }

  function status() { return { state: state.state, at: state.at, message: state.message }; }

  function setState(s, message) {
    state = { state: s, at: Date.now(), message: message || "" };
    document.dispatchEvent(new CustomEvent("wl-sync-change"));
  }

  // ── The baseline ──────────────────────────────────────────────────────────
  //  What this browser and the server last agreed on, per key. Everything the
  //  merge rules need is a comparison against this.
  function readBaseline() {
    try {
      var v = JSON.parse(localStorage.getItem(BASELINE) || "{}");
      return v && typeof v === "object" ? v : {};
    } catch (e) { return {}; }
  }

  function writeBaseline(b) {
    try { localStorage.setItem(BASELINE, JSON.stringify(b)); } catch (e) { /* nudge only */ }
  }

  function currentValues() {
    var out = {};
    if (!window.WLBundle) return out;
    var snap = WLBundle.snapshot();
    Object.keys(snap.data).forEach(function (k) { out[k] = JSON.stringify(snap.data[k]); });
    return out;
  }

  /** Keys this browser has changed since it last agreed with the server. */
  function localChanges() {
    var base = readBaseline();
    var now = currentValues();
    var changed = {};
    Object.keys(now).forEach(function (k) {
      if (base[k] !== now[k]) changed[k] = JSON.parse(now[k]);
    });
    // A key we used to have and no longer do is a deletion, and has to travel.
    Object.keys(base).forEach(function (k) {
      if (!(k in now)) changed[k] = null;
    });
    return changed;
  }

  function request(method, body) {
    // Anything that goes wrong reaching the network has to come back as a
    // rejected promise, never as a throw. `fetch` can be missing outright, and
    // a synchronous throw here would escape the handlers below and take the
    // whole dashboard down — sync failing must never stop someone editing.
    if (typeof fetch !== "function") {
      return Promise.reject(new Error("no fetch in this browser"));
    }
    try {
      var cfg = config();
      var headers = { "Content-Type": "text/plain;charset=utf-8" };
      if (cfg.key) headers["X-Editor-Key"] = cfg.key;
      return fetch(cfg.endpoint + "/content", {
        method: method,
        headers: headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      return Promise.reject(e);
    }
  }

  // ── Pull ──────────────────────────────────────────────────────────────────
  function pullNow() {
    if (!isConfigured()) return Promise.resolve(false);
    setState("syncing");
    return request("GET").then(function (res) {
      if (!res.ok) { setState("error", "The shared store answered " + res.status + "."); return false; }
      return res.json().then(function (payload) {
        var remote = (payload && payload.data) || {};
        var base = readBaseline();
        var now = currentValues();
        var apply = {};

        Object.keys(remote).forEach(function (k) {
          var incoming = JSON.stringify(remote[k]);
          var mine = now[k];
          // Untouched here since the last sync? Then take theirs.
          var iChangedIt = mine !== undefined && mine !== base[k];
          if (iChangedIt) return;                  // unsent local work wins
          if (incoming === mine) return;           // already identical
          apply[k] = remote[k];
        });

        // Keys the server no longer has, which we have not changed, are gone.
        Object.keys(base).forEach(function (k) {
          if (k in remote) return;
          if (now[k] !== undefined && now[k] !== base[k]) return;   // changed here; keep
          if (now[k] !== undefined) apply[k] = null;
        });

        if (Object.keys(apply).length && window.WLBundle) WLBundle.merge(apply);

        // The baseline becomes what the server holds, plus anything of ours
        // still waiting to go up.
        var newBase = {};
        Object.keys(remote).forEach(function (k) { newBase[k] = JSON.stringify(remote[k]); });
        writeBaseline(newBase);

        setState("synced");
        return true;
      });
    }, function () {
      setState("offline", "No connection to the shared store — your work is safe in this browser.");
      return false;
    });
  }

  // ── Push ──────────────────────────────────────────────────────────────────
  function pushNow() {
    if (!isConfigured()) return Promise.resolve(false);
    var changes = localChanges();
    if (!Object.keys(changes).length) { setState("synced"); return Promise.resolve(true); }

    setState("syncing");
    return request("PUT", { changes: changes }).then(function (res) {
      if (!res.ok) {
        setState("error", res.status === 401 || res.status === 403
          ? "The shared store refused this editor key."
          : "The shared store answered " + res.status + ".");
        return false;
      }
      // Only now is it safe to say these keys are agreed.
      var base = readBaseline();
      Object.keys(changes).forEach(function (k) {
        if (changes[k] === null) delete base[k];
        else base[k] = JSON.stringify(changes[k]);
      });
      writeBaseline(base);
      setState("synced");
      return true;
    }, function () {
      setState("offline", "No connection to the shared store — your work is safe in this browser.");
      return false;
    });
  }

  function schedulePush() {
    if (!isConfigured()) return;
    clearTimeout(timer);
    timer = setTimeout(function () { pushNow(); }, PUSH_DEBOUNCE_MS);
  }

  function start() {
    if (started || !isConfigured()) return;
    started = true;
    pullNow().then(function () { pushNow(); });

    // Any store writing anything means there may be something to send.
    [
      "wl-brand-change", "wl-sections-change", "wl-articles-change",
      "wl-staff-change", "wl-writers-change", "wl-videos-change", "wl-teams-change",
      "wl-puzzles-change", "wl-features-change", "wl-games-change", "wl-home-order-change",
      "wl-layout-change", "wl-text-change", "wl-centerspread-change",
    ].forEach(function (evt) { document.addEventListener(evt, schedulePush); });

    poller = setInterval(function () { pullNow(); }, POLL_MS);

    // Leaving with something unsent is how work goes missing.
    window.addEventListener("beforeunload", function () {
      if (Object.keys(localChanges()).length) pushNow();
    });
  }

  function stop() {
    clearTimeout(timer); clearInterval(poller); started = false;
  }

  // ── Saying what is going on ───────────────────────────────────────────────
  //  An editor who cannot tell whether their work has left the building will
  //  either not trust it or, worse, trust it wrongly.
  function renderStatus() {
    var el = document.getElementById("wl-sync-status");
    if (!el) return;
    if (!isConfigured()) { el.hidden = true; return; }
    el.hidden = false;

    var s = status();
    var pending = Object.keys(localChanges()).length;
    el.className = "wl-sync" + (s.state === "offline" ? " is-offline" : s.state === "error" ? " is-error" : "");

    if (s.state === "offline") {
      el.innerHTML = "<strong>Working offline.</strong> Your changes are safe in this browser and " +
        "will go up on their own when the connection is back." +
        (pending ? " " + pending + " change" + (pending === 1 ? "" : "s") + " waiting." : "");
      return;
    }
    if (s.state === "error") {
      el.innerHTML = "<strong>Shared editing isn't working.</strong> " + escapeHtml(s.message) +
        " Your work is safe in this browser meanwhile.";
      return;
    }
    if (s.state === "syncing") { el.innerHTML = "<strong>Saving to the shared paper…</strong>"; return; }

    el.innerHTML = pending
      ? "<strong>Saving…</strong> " + pending + " change" + (pending === 1 ? "" : "s") + " on the way to your co-editors."
      : "<strong>Shared and up to date.</strong> Your co-editors can see this, and it publishes on its own — " +
        "nothing to download.";
  }

  function escapeHtml(x) {
    return String(x == null ? "" : x).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  document.addEventListener("wl-sync-change", renderStatus);
  [
    "wl-articles-change", "wl-sections-change", "wl-centerspread-change",
    "wl-videos-change", "wl-features-change", "wl-games-change",
  ].forEach(function (e) { document.addEventListener(e, renderStatus); });

  function boot() { start(); renderStatus(); }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  return {
    isConfigured: isConfigured, status: status, start: start, stop: stop,
    pullNow: pullNow, pushNow: pushNow, localChanges: localChanges,
  };
})();
