// ============================================================================
//  CENTERSPREAD STORE — the centerspread pieces (poems, prose-with-reveal,
//  standalone images) and which interactive puzzles appear on centerspread.html.
//
//  Defaults live in centerspread.js (window.WL_CENTERSPREAD); editor changes
//  from editor-centerspread.html are layered on top in localStorage, exactly
//  like articles. Everything here is per-browser demo storage — see
//  auth.js for the identity model.
//
//  A piece is: { id, type, kicker, title, byline, ...type fields, reveal? }
//    type "poem"  → body: stanzas separated by blank lines, lines by newlines
//    type "prose" → body: paragraphs separated by blank lines
//    type "image" → image (url or data URL), alt, intro?
//    reveal (optional, any type) → { summary, answer }
// ============================================================================
window.WLCenterspread = (function () {
  var LS_PIECES = "wl_cs_pieces";     // { [id]: piece }  editor overrides + new
  var LS_DELETED = "wl_cs_deleted";   // [id]             defaults removed
  var LS_ORDER = "wl_cs_order";       // [id]             display order
  var LS_PUZZLES = "wl_cs_puzzles";   // { key: bool }    which puzzles show

  // Every interactive puzzle on the page, and whether it shows by default.
  var PUZZLE_KEYS = ["crossword", "spellingbee", "connections", "wordsearch"];
  var PUZZLE_LABELS = {
    crossword: "Mini Crossword",
    spellingbee: "Spelling Bee",
    connections: "Connections",
    wordsearch: "Spring Word Search",
  };

  function read(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || "null");
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }
  function fire() { document.dispatchEvent(new CustomEvent("wl-centerspread-change")); }

  function defaults() {
    var d = window.WL_CENTERSPREAD || {};
    return Array.isArray(d.pieces) ? d.pieces : [];
  }
  function defaultPuzzles() {
    var d = (window.WL_CENTERSPREAD && window.WL_CENTERSPREAD.puzzles) || {};
    var out = {};
    PUZZLE_KEYS.forEach(function (k) { out[k] = d[k] !== false; });   // default on
    return out;
  }

  // ── Pieces ────────────────────────────────────────────────────────────────
  function getAllMap() {
    var base = {};
    defaults().forEach(function (p) { if (p && p.id) base[p.id] = p; });
    var custom = read(LS_PIECES, {});
    var deleted = read(LS_DELETED, []);
    var merged = {};
    Object.keys(base).forEach(function (id) {
      if (deleted.indexOf(id) === -1) merged[id] = base[id];
    });
    Object.keys(custom).forEach(function (id) { merged[id] = custom[id]; });
    return merged;
  }

  // Ordered list — saved order first, then any pieces not yet in it (new
  // defaults, freshly added) in their natural order.
  function list() {
    var map = getAllMap();
    var order = read(LS_ORDER, []);
    var seen = {};
    var out = [];
    order.forEach(function (id) {
      if (map[id] && !seen[id]) { out.push(map[id]); seen[id] = true; }
    });
    defaults().forEach(function (p) {
      if (p && map[p.id] && !seen[p.id]) { out.push(map[p.id]); seen[p.id] = true; }
    });
    Object.keys(map).forEach(function (id) {
      if (!seen[id]) { out.push(map[id]); seen[id] = true; }
    });
    return out;
  }

  function getById(id) { return getAllMap()[id]; }
  function isCustom(id) { return id in read(LS_PIECES, {}); }

  function save(id, data) {
    var custom = read(LS_PIECES, {});
    custom[id] = Object.assign({}, data, { id: id });
    if (!write(LS_PIECES, custom)) return { ok: false, error: "quota" };
    // Un-delete if this id was a removed default being re-created.
    var deleted = read(LS_DELETED, []).filter(function (x) { return x !== id; });
    write(LS_DELETED, deleted);
    // Append to order if new.
    var order = read(LS_ORDER, []);
    if (order.indexOf(id) === -1) { order.push(id); write(LS_ORDER, order); }
    fire();
    return { ok: true };
  }

  function remove(id) {
    var custom = read(LS_PIECES, {});
    if (custom[id]) { delete custom[id]; write(LS_PIECES, custom); }
    // If it was a shipped default, tombstone it so the merge hides it.
    var isDefault = defaults().some(function (p) { return p && p.id === id; });
    if (isDefault) {
      var deleted = read(LS_DELETED, []);
      if (deleted.indexOf(id) === -1) { deleted.push(id); write(LS_DELETED, deleted); }
    }
    write(LS_ORDER, read(LS_ORDER, []).filter(function (x) { return x !== id; }));
    fire();
  }

  function setOrder(ids) { write(LS_ORDER, ids.slice()); fire(); }

  function reset() {
    [LS_PIECES, LS_DELETED, LS_ORDER, LS_PUZZLES].forEach(function (k) { localStorage.removeItem(k); });
    fire();
  }

  // ── Puzzle visibility ───────────────────────────────────────────────────
  function puzzles() {
    var base = defaultPuzzles();
    var over = read(LS_PUZZLES, {});
    PUZZLE_KEYS.forEach(function (k) { if (typeof over[k] === "boolean") base[k] = over[k]; });
    return base;
  }
  function isPuzzleVisible(key) { return puzzles()[key] !== false; }
  function setPuzzleVisible(key, on) {
    if (PUZZLE_KEYS.indexOf(key) === -1) return;
    var over = read(LS_PUZZLES, {});
    over[key] = !!on;
    write(LS_PUZZLES, over);
    fire();
  }

  return {
    // pieces
    list: list, getById: getById, isCustom: isCustom,
    save: save, remove: remove, setOrder: setOrder, reset: reset,
    // puzzles
    PUZZLE_KEYS: PUZZLE_KEYS, PUZZLE_LABELS: PUZZLE_LABELS,
    puzzles: puzzles, isPuzzleVisible: isPuzzleVisible, setPuzzleVisible: setPuzzleVisible,
  };
})();
