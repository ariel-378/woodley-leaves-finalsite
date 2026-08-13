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
  var FORMAT = "newspaper-content-bundle";
  var VERSION = 1;

  // The format identifier was once named after the first paper to use it.
  // Bundles exported under the old name still import — read accepts either,
  // write always emits the current one.
  var LEGACY_FORMATS = ["woodley-content-bundle"];
  function isBundleFormat(f) {
    return f === FORMAT || LEGACY_FORMATS.indexOf(f) !== -1;
  }

  // Keys that are per-device/session, not content — never bundled or applied.
  var EXCLUDE = {
    "wl_article_views": 1,             // reader analytics, per browser
    "wl_preview_role": 1,             // which role this browser is previewing
    "wl_splash_seen": 1,              // "don't show the splash again" flag
    "wl_subscribers": 1,             // local signup log (real ones go to the Sheet)
    "wl_submit_last": 1,             // signup rate-limit timestamp
    "wl_sections_pages_migrated": 1,   // one-time data migration markers
    "wl_sections_custom_migrated": 1,
    "wl_published_hash": 1,           // which published version this browser has applied
    "wl_last_backup": 1,              // when THIS browser last downloaded one
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
    if (!bundle || !isBundleFormat(bundle.format) || typeof bundle.data !== "object" || !bundle.data) {
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

  function saveFile(text, filename, type) {
    var blob = new Blob([text], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  // The transfer/backup artifact: plain JSON a co-editor loads with load().
  function download(filename) {
    saveFile(toJSON(), filename || "content-bundle.json", "application/json");
  }

  function summary() {
    var keys = contentKeys();
    return { keys: keys.length, bytes: toJSON().length };
  }

  // ── Published content (the reader-apply half of publishing) ───────────────
  //  A committed published-content.js sets window.WL_PUBLISHED to a bundle.
  //  applyPublished() seeds it into localStorage on page load so every reader
  //  sees the published content, and refreshes when a new version is published.
  //  A content-hash marker makes it idempotent: the same published version is
  //  applied once, so an editor's later drafts survive reloads — but a brand-new
  //  published version wins over local drafts (commit drafts to keep them).
  var MARKER = "wl_published_hash";

  function hashStr(s) {
    var h = 5381, i = s.length;
    while (i) h = (h * 33) ^ s.charCodeAt(--i);
    return (h >>> 0).toString(36);
  }

  function applyPublished() {
    var pub = window.WL_PUBLISHED;
    if (!pub || !isBundleFormat(pub.format) || typeof pub.data !== "object" || !pub.data) return false;
    var sig = hashStr(JSON.stringify(pub.data));
    var already;
    try { already = localStorage.getItem(MARKER); } catch (e) { return false; }
    if (already === sig) return false;   // this published version is already in place
    contentKeys().forEach(function (k) { localStorage.removeItem(k); });
    Object.keys(pub.data).forEach(function (k) {
      if (!isContentKey(k)) return;      // a published file can't smuggle a session key
      var v = pub.data[k];
      localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
    });
    try { localStorage.setItem(MARKER, sig); } catch (e) {}
    fireAll();
    return true;
  }

  // The publish artifact: a committable JS file that assigns WL_PUBLISHED.
  function toPublishedJS() {
    return "// ============================================================================\n" +
      "//  PUBLISHED CONTENT — exported from the editor's Publish panel.\n" +
      "//  Commit this file to publish every current edit to all readers. It is\n" +
      "//  applied on page load; readers refresh automatically when you re-publish.\n" +
      "// ============================================================================\n" +
      "window.WL_PUBLISHED = " + toJSON() + ";\n";
  }

  function downloadPublished() {
    saveFile(toPublishedJS(), "published-content.js", "application/javascript");
  }

  // Seed the published content as early as this file loads (before the stores
  // read localStorage), so the first render already shows it.
  applyPublished();

  // ── Optional in-page panel wiring ─────────────────────────────────────────
  //  If the host page includes the publish panel, wire its buttons. Guarded so
  //  the module is inert on pages that don't have it.
  function wirePanel() {
    var pub = document.getElementById("wl-publish-publish");
    var dl = document.getElementById("wl-publish-download");
    var file = document.getElementById("wl-publish-file");
    var status = document.getElementById("wl-publish-status");
    if (!pub && !dl && !file) return;

    function setStatus(msg) { if (status) status.textContent = msg; }

    // ── The backup nudge ────────────────────────────────────────────────────
    //  Drafts live in one browser. Clearing site data, a school laptop reimage,
    //  or a full quota all end the same way, and the writer finds out last. The
    //  bundle download already existed; nothing ever asked anyone to use it.
    var LAST_BACKUP = "wl_last_backup";
    var DAY_MS = 24 * 60 * 60 * 1000;
    var NAG_AFTER_DAYS = 7;

    function markBackedUp() {
      try { localStorage.setItem(LAST_BACKUP, String(Date.now())); } catch (e) { /* nudge is a nicety */ }
      renderNag();
    }
    function daysSinceBackup() {
      var raw;
      try { raw = localStorage.getItem(LAST_BACKUP); } catch (e) { return null; }
      if (!raw) return null;
      var t = parseInt(raw, 10);
      return isNaN(t) ? null : Math.floor((Date.now() - t) / DAY_MS);
    }

    function renderNag() {
      var host = document.getElementById("wl-publish-panel");
      if (!host) return;
      var el = document.getElementById("wl-backup-nag");
      if (!el) {
        el = document.createElement("p");
        el.id = "wl-backup-nag";
        el.style.cssText = "margin:10px 0 0;font-size:13px;line-height:1.5;";
        host.appendChild(el);
      }
      if (!summary().keys) { el.textContent = ""; return; }   // nothing to lose

      var days = daysSinceBackup();
      var stale = days === null || days >= NAG_AFTER_DAYS;
      el.style.color = stale ? "#b8002a" : "var(--muted)";
      el.textContent = days === null
        ? "You have never downloaded a backup. Drafts live in this browser only — if it is cleared, they are gone."
        : days === 0 ? "Last backup: today."
        : days === 1 ? "Last backup: yesterday."
        : "Last backup: " + days + " days ago." + (stale ? " Worth taking another." : "");
    }

    function refresh() {
      var s = summary();
      setStatus(s.keys
        ? (s.keys + " draft item group" + (s.keys === 1 ? "" : "s") + " in this browser. Publish to make them live for readers, or download to transfer.")
        : "No local edits — this browser shows the published content.");
      renderNag();
    }
    refresh();

    // Only record a backup that actually happened, and never fail quietly:
    // a click that produces no file and no message is how someone concludes
    // they are backed up when they are not.
    function attemptDownload(run, okMsg) {
      try {
        run();
      } catch (e) {
        setStatus("That download didn't start — your browser may be blocking it. " +
                  "Try again, or use a different browser before relying on this as a backup.");
        return;
      }
      markBackedUp();
      setStatus(okMsg);
    }

    if (pub) pub.addEventListener("click", function () {
      // The published file is a complete snapshot, so it counts as a backup.
      attemptDownload(downloadPublished,
        "Downloaded published-content.js. Commit it to the site to publish these edits to every reader.");
    });

    if (dl) dl.addEventListener("click", function () {
      attemptDownload(function () { download("content-bundle.json"); },
        "Downloaded content-bundle.json — send it to a co-editor to load, or keep it as a backup.");
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
          : "That file isn't a content bundle.");
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
    applyPublished: applyPublished, toPublishedJS: toPublishedJS, downloadPublished: downloadPublished,
    FORMAT: FORMAT, VERSION: VERSION, isBundleFormat: isBundleFormat,
  };
})();
