// Merges static writer bios with editor-edited ones in localStorage.
window.WLWriters = (function () {
  const LS_CUSTOM = "wl_writers_custom";
  const LS_DELETED = "wl_writers_deleted";

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }
  function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function fire() { document.dispatchEvent(new CustomEvent("wl-writers-change")); }

  function getAll() {
    const base = window.WL_WRITERS || {};
    const custom = read(LS_CUSTOM, {});
    const deleted = read(LS_DELETED, []);
    const merged = {};
    Object.keys(base).forEach(slug => {
      if (!deleted.includes(slug)) merged[slug] = base[slug];
    });
    Object.keys(custom).forEach(slug => { merged[slug] = custom[slug]; });
    return merged;
  }
  function getBySlug(slug) { return getAll()[slug]; }
  function getByByline(byline) {
    const slug = window.WL_writerSlug ? window.WL_writerSlug(byline) : String(byline || "").toLowerCase().replace(/\s+/g, "-");
    return getBySlug(slug);
  }
  function save(slug, data) {
    const custom = read(LS_CUSTOM, {});
    custom[slug] = data;
    write(LS_CUSTOM, custom);
    const deleted = read(LS_DELETED, []).filter(x => x !== slug);
    write(LS_DELETED, deleted);
    fire();
  }
  function remove(slug) {
    const custom = read(LS_CUSTOM, {});
    if (custom[slug]) { delete custom[slug]; write(LS_CUSTOM, custom); }
    const base = window.WL_WRITERS || {};
    if (base[slug]) {
      const deleted = read(LS_DELETED, []);
      if (!deleted.includes(slug)) { deleted.push(slug); write(LS_DELETED, deleted); }
    }
    fire();
  }
  function isCustom(slug) {
    const custom = read(LS_CUSTOM, {});
    return slug in custom;
  }
  function reset() {
    localStorage.removeItem(LS_CUSTOM);
    localStorage.removeItem(LS_DELETED);
    fire();
  }

  // Utility — finds every unique byline used in articles, even if the writer
  // doesn't have a bio yet. Useful for "writers who still need a bio" lists.
  function listFromArticles() {
    if (!window.WLArticles) return [];
    const all = WLArticles.getAll();
    const seen = new Set();
    const writers = [];
    Object.values(all).forEach(a => {
      const byline = a.byline;
      if (!byline || seen.has(byline)) return;
      seen.add(byline);
      const slug = window.WL_writerSlug(byline);
      writers.push({ slug, byline, bio: getBySlug(slug) });
    });
    return writers.sort((a, b) => a.byline.localeCompare(b.byline));
  }

  return { getAll, getBySlug, getByByline, save, remove, isCustom, reset, listFromArticles };
})();
