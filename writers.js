// Writer directory. Maps a byline slug to a display name. Everything else
// (bio, role, year, photo, email) has been cut — writer profile pages now
// just list every article by that byline.
// Blank template: no writers yet. Bylines you add via the editor populate
// writer pages automatically; add fixed display-name overrides here if needed.
window.WL_WRITERS = {};

// Turn a byline like "Alex Rivera" into a lookup slug "alex-rivera"
window.WL_writerSlug = function (byline) {
  return String(byline || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")  // strip accents
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

// The list of writer names on an article. Co-written articles carry an
// `authors` array; older articles have just a single `byline` string, which
// we treat as one author. Each name links to its own writer page.
window.WL_articleAuthors = function (a) {
  if (a && Array.isArray(a.authors) && a.authors.length) {
    return a.authors.map(function (n) { return String(n).trim(); }).filter(Boolean);
  }
  if (a && a.byline) return [String(a.byline).trim()];
  return [];
};

// Join names into a byline string: "A" / "A and B" / "A, B, and C".
window.WL_bylineText = function (names) {
  var n = (names || []).map(function (x) { return String(x).trim(); }).filter(Boolean);
  if (n.length === 0) return "";
  if (n.length === 1) return n[0];
  if (n.length === 2) return n[0] + " and " + n[1];
  return n.slice(0, -1).join(", ") + ", and " + n[n.length - 1];
};
