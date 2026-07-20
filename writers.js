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
  // Otherwise split the byline string into individual authors so co-written
  // pieces ("A and B" / "A, B, and C") are treated as separate writers.
  if (a && a.byline) {
    return String(a.byline)
      .split(/\s*,\s*and\s+|\s+and\s+|\s*,\s*/i)
      .map(function (n) { return n.trim(); })
      .filter(Boolean);
  }
  return [];
};

// Join names into a byline string. Authors are never combined with "and" — a
// plain comma list keeps every name distinct.
window.WL_bylineText = function (names) {
  return (names || []).map(function (x) { return String(x).trim(); }).filter(Boolean).join(", ");
};

// Render an article's authors as separate linked "tags" (never one combined
// string). Generic bylines (the editorial board, etc.) render as plain text.
window.WL_bylineTagsHtml = function (a) {
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  var generic = { "The Editorial Board": 1, "Submitted": 1, "School Communications": 1 };
  return WL_articleAuthors(a).map(function (name) {
    if (name && !generic[name] && window.WL_writerSlug) {
      return '<a class="byline-tag" href="writer.html?slug=' + encodeURIComponent(WL_writerSlug(name)) + '">' + esc(name) + '</a>';
    }
    return '<span class="byline-tag byline-tag-plain">' + esc(name) + '</span>';
  }).join("");
};
