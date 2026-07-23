// ============================================================================
//  Content bundle — the single-file publish/transfer format.
//
//  Every editor change (articles, ads, staff, sections, puzzles, brand, inline
//  text, …) is saved to a `wl_*` localStorage key by its store. Those edits
//  live in ONE browser. This module gathers all of them into a single JSON
//  bundle that can be:
//    • downloaded and committed to the repo  → the published source of truth
//    • handed to a co-editor to load         → cross-computer transfer
//    • loaded to restore a previous state    → backup / rollback
//
//  It deliberately does NOT touch per-device keys (view counts, the editor's
//  preview role, the splash-seen flag, one-time migration markers): those are
//  local session state, not publishable content.
//
//  This is the editor-side half of the publish pipeline. Making a committed
//  bundle auto-apply for every reader is the next step and is intentionally
//  separate — this half is safe on any page and changes no reader behaviour.
// ============================================================================
window.WLBundle = (function () {
  var FORMAT = "woodley-content-bundle";
  var VERSION = 1;

  // Keys that are per-device/session, not content — never bundled.
  var EXCLUDE = {
    "wl_article_views": 1,             // reader analytics, per browser
    "wl_preview_role": 1,             // which role this browser is previewing
    "wl_splash_seen": 1,              // "don't show the splash again" flag
    "wl_subscribers": 1,             // local signup log (real ones go to the endpoint)
    "wl_submit_last": 1,             // submission rate-limit timestamp
    "wl_sections_pages_migrated": 1,   // one-time data migration markers
    "wl_sections_custom_migrated": 1,
  };

  // Every store's change event — fired after a load so all pages re-render.
  var EVENTS = [
    "wl-brand-change", "wl-sections-change", "wl-articles-change", "wl-ads-change",
    "wl-staff-change", "wl-writers-change", "wl-videos-change", "wl-teams-change",
    "wl-puzzles-change", "wl-features-change", "wl-games-change", "wl-home-order-change",
    "wl-layout-change", "wl-text-change", "wl-centerspread-change",
  ];

  function isContentKey(k) { return /^wl_/.test(k) && !EXCLUDE[k]; }

  function contentKeys() {
    var out = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (isContentKey(k)) out.push(k);
    }
    return out;
  }

  // Read every content key into one object. Values are parsed so the bundle is
  // human-readable JSON; a value that somehow isn't JSON is kept as a string.
  function snapshot() {
    var data = {};
    contentKeys().forEach(function (k) {
      var raw = localStorage.getItem(k);
      try { data[k] = JSON.parse(raw); } catch (e) { data[k] = raw; }
    });
    return { format: FORMAT, version: VERSION, data: data };
  }

  function toJSON() { return JSON.stringify(snapshot(), null, 2); }

  function fireAll() {
    EVENTS.forEach(function (n) { document.dispatchEvent(new CustomEvent(n)); });
  }

  // Replace all editable content with the bundle's — a clean, deterministic
  // restore, not a merge (so loading a bundle reproduces it exactly). Per-device
  // keys are left untouched.
  function load(bundle) {
    if (!bundle || bundle.format !== FORMAT || typeof bundle.data !== "object" || !bundle.data) {
      return { ok: false, error: "not-a-bundle" };
    }
    contentKeys().forEach(function (k) { localStorage.removeItem(k); });
    var applied = 0;
    Object.keys(bundle.data).forEach(function (k) {
      if (!isContentKey(k)) return;   // never let a bundle write a session key
      var v = bundle.data[k];
      localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
      applied++;
    });
    fireAll();
    return { ok: true, applied: applied };
  }

  // Wipe all edits back to the shipped defaults (the WL_* seed files).
  function clearAll() {
    contentKeys().forEach(function (k) { localStorage.removeItem(k); });
    fireAll();
  }

  function download(filename) {
    var blob = new Blob([toJSON()], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename || "content-bundle.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  function summary() {
    var keys = contentKeys();
    return { keys: keys.length, bytes: toJSON().length };
  }

  // ── Optional in-page panel wiring ─────────────────────────────────────────
  //  If the host page includes the publish panel, wire its buttons. Guarded so
  //  the module is inert on pages that don't have it.
  function wirePanel() {
    var dl = document.getElementById("wl-publish-download");
    var file = document.getElementById("wl-publish-file");
    var status = document.getElementById("wl-publish-status");
    if (!dl && !file) return;

    function setStatus(msg) { if (status) status.textContent = msg; }
    function refresh() {
      var s = summary();
      setStatus(s.keys
        ? (s.keys + " draft item group" + (s.keys === 1 ? "" : "s") + " in this browser. Download to publish or transfer.")
        : "No local edits — this browser shows the published content.");
    }
    refresh();

    if (dl) dl.addEventListener("click", function () {
      download("content-bundle.json");
      setStatus("Downloaded content-bundle.json. Commit it to publish for readers, or send it to a co-editor to load.");
    });

    if (file) file.addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        var obj;
        try { obj = JSON.parse(reader.result); }
        catch (err) { setStatus("That file isn't valid JSON — is it a content bundle?"); e.target.value = ""; return; }
        var res = load(obj);
        if (res.ok) refresh();
        setStatus(res.ok
          ? ("Loaded " + res.applied + " item group" + (res.applied === 1 ? "" : "s") + ". Every editor page now shows this content.")
          : "That file isn't a Woodley content bundle.");
        e.target.value = "";
      };
      reader.readAsText(f);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wirePanel);
  else wirePanel();

  return {
    snapshot: snapshot, toJSON: toJSON, load: load, clearAll: clearAll,
    download: download, summary: summary, isContentKey: isContentKey,
    FORMAT: FORMAT, VERSION: VERSION,
  };
})();
