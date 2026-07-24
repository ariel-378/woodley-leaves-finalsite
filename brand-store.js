// ============================================================================
//  BRAND STORE — merges the defaults in config.js with a school's own branding
//  saved from the Design dashboard (editor-brand.html).
//
//  Precedence: config.js defaults  ←overridden by←  localStorage "wl_brand".
//  Nothing here is school-specific: config.js stays the code-level default, so
//  a school that never opens the Design tab sees exactly what config.js says.
//
//  SCOPE: like every other dashboard in this template, saved branding lives in
//  the editor's own browser (localStorage) — it is NOT published to readers.
//  To make branding permanent site-wide, use "Download config" in the Design
//  tab and hand the files to whoever deploys the site.
//
//  Load in <head> AFTER config.js and BEFORE brand.js.
// ============================================================================
window.WLBrand = (function () {
  var LS_KEY = "wl_brand";

  // Only these keys may be overridden from the editor — an unknown key in
  // storage is ignored rather than blindly merged into the live config.
  var FIELDS = ["name", "school", "tagline", "splashMark", "homeTeam", "colors", "fonts", "ornament", "favicon", "contacts", "footerNote", "submissions"];

  function readRaw() {
    try {
      var v = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
      return v && typeof v === "object" && !Array.isArray(v) ? v : {};
    } catch (e) {
      return {};   // corrupt storage must never take the masthead down
    }
  }

  function writeRaw(obj) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(obj));
      return { ok: true };
    } catch (e) {
      // Uploaded artwork is stored as a data URL, so the ~5MB quota is a real
      // ceiling. Report it instead of failing silently.
      return { ok: false, error: isQuotaError(e) ? "quota" : "unknown" };
    }
  }

  function isQuotaError(e) {
    return e && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22);
  }

  function defaults() { return window.WL_CONFIG || {}; }

  function fire() { document.dispatchEvent(new CustomEvent("wl-brand-change")); }

  // The merged config every page actually renders from. Shallow per field, with
  // `colors` merged key-by-key so overriding accent alone keeps the other colors.
  function get() {
    var base = defaults();
    var over = readRaw();
    var out = {};
    FIELDS.forEach(function (k) { if (base[k] !== undefined) out[k] = base[k]; });
    FIELDS.forEach(function (k) {
      if (over[k] === undefined) return;
      if (k === "colors") out.colors = Object.assign({}, base.colors || {}, over.colors || {});
      else out[k] = over[k];
    });
    return out;
  }

  // Like get(), but keeps every key config.js defines — including any the Design
  // tab doesn't surface yet. Only for the export: a downloaded config.js must be
  // a COMPLETE replacement, or settings the dashboard doesn't know about would
  // vanish the moment a school made their branding permanent.
  function fullConfig() {
    var base = defaults();
    var over = readRaw();
    var out = Object.assign({}, base);
    FIELDS.forEach(function (k) {
      if (over[k] === undefined) return;
      if (k === "colors") out.colors = Object.assign({}, base.colors || {}, over.colors || {});
      else out[k] = over[k];
    });
    return out;
  }

  // Everything the school has changed, for the Design form and the export.
  function overrides() { return readRaw(); }

  function isCustom(field) {
    var o = readRaw();
    return field ? o[field] !== undefined : Object.keys(o).length > 0;
  }

  // patch: { name?, colors?, ornament?, ... }. A field set to undefined is
  // cleared back to the config.js default — including a single color, so
  // emptying one field can never strand an override the UI can't undo.
  function save(patch) {
    var o = readRaw();
    Object.keys(patch || {}).forEach(function (k) {
      if (FIELDS.indexOf(k) === -1) return;
      if (patch[k] === undefined) { delete o[k]; return; }
      if (k === "colors") {
        var merged = Object.assign({}, o.colors || {}, patch.colors || {});
        Object.keys(merged).forEach(function (ck) {
          if (merged[ck] === undefined || merged[ck] === "") delete merged[ck];
        });
        if (Object.keys(merged).length) o.colors = merged; else delete o.colors;
        return;
      }
      o[k] = patch[k];
    });
    var res = writeRaw(o);
    if (res.ok) fire();
    return res;
  }

  function resetField(field) {
    var o = readRaw();
    delete o[field];
    var res = writeRaw(o);
    if (res.ok) fire();
    return res;
  }

  function reset() {
    localStorage.removeItem(LS_KEY);
    fire();
  }

  // ── Export ────────────────────────────────────────────────────────────────
  //  Turns the live merged config back into a config.js a developer can commit.
  //  Uploaded artwork is a data URL (huge, and unreadable in a diff), so it is
  //  exported as a separate file and referenced by name.
  function ornamentFileName(dataUrl) {
    var m = /^data:image\/([a-z0-9.+-]+)/i.exec(dataUrl || "");
    var ext = m ? m[1].toLowerCase() : "png";
    if (ext === "svg+xml") ext = "svg";
    if (ext === "jpeg") ext = "jpg";
    return "media/masthead-flourish." + ext;
  }

  function isDataUrl(s) { return typeof s === "string" && /^data:/i.test(s); }

  function exportConfigSource() {
    var cfg = fullConfig();          // not get() — the export must be complete
    var orn = cfg.ornament;
    var artNote = "";

    if (orn && typeof orn === "object" && isDataUrl(orn.file)) {
      var fname = ornamentFileName(orn.file);
      cfg = Object.assign({}, cfg, { ornament: Object.assign({}, orn, { file: fname }) });
      artNote =
        "//  NOTE: this config expects the uploaded artwork to be saved as\n" +
        "//        " + fname + "\n" +
        "//        (downloaded alongside this file).\n";
    }
    if (isDataUrl(cfg.favicon)) {
      cfg = Object.assign({}, cfg, { favicon: "media/favicon-upload" });
    }

    return "// ============================================================================\n" +
      "//  BRAND CONFIG — exported from the Design dashboard.\n" +
      "//  Replace config.js with this file to make the branding permanent for\n" +
      "//  every reader (the Design tab only changes the editor's own browser).\n" +
      artNote +
      "// ============================================================================\n" +
      "window.WL_CONFIG = " + JSON.stringify(cfg, null, 2) + ";\n";
  }

  // The uploaded artwork, ready to save into media/. null when the flourish is
  // a plain path (already a real file) or absent.
  function exportArtwork() {
    var orn = fullConfig().ornament;
    if (!orn || typeof orn !== "object" || !isDataUrl(orn.file)) return null;
    return { name: ornamentFileName(orn.file).replace(/^media\//, ""), dataUrl: orn.file };
  }

  return {
    get: get,
    overrides: overrides,
    isCustom: isCustom,
    save: save,
    resetField: resetField,
    reset: reset,
    exportConfigSource: exportConfigSource,
    exportArtwork: exportArtwork,
    isDataUrl: isDataUrl,
  };
})();
