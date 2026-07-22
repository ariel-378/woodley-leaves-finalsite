// Custom features: editor-written content that is NOT a game.
//
// A comic strip, a photo essay, an embedded map, a poll — anything an editor
// wants to build that the built-in content types don't cover. Each feature is:
//   { id, title, kicker, description, height, code }
// `code` is a self-contained HTML document (markup + <style> + <script>)
// rendered inside a sandboxed <iframe> on any section that declares the
// "Custom feature" content type.
//
// This is deliberately separate from WLGamesStore. Games belong with the
// puzzles on the Centerspread; features belong to whichever section an editor
// puts them in. Keeping two stores keeps the two ideas from blurring together
// in the dashboard, which is exactly what happened when there was only one.
//
// Like every other dashboard edit on this site, features live in the browser's
// localStorage. When the site is wired to a real CMS/back end, this store is
// the single place to swap for server-side persistence.
window.WLFeatures = (function () {
  const LS = "wl_custom_features";

  function read() {
    try {
      const v = JSON.parse(localStorage.getItem(LS) || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }

  function write(list) {
    try {
      localStorage.setItem(LS, JSON.stringify(list));
    } catch (e) {
      return false;
    }
    document.dispatchEvent(new CustomEvent("wl-features-change"));
    return true;
  }

  // Shipped defaults (window.WL_FEATURES) merge with editor-added ones; a
  // stored feature overrides a default with the same id.
  function getAll() {
    const base = Array.isArray(window.WL_FEATURES) ? window.WL_FEATURES : [];
    const byId = {};
    base.forEach(f => { if (f && f.id) byId[f.id] = f; });
    read().forEach(f => { if (f && f.id) byId[f.id] = f; });
    return Object.values(byId);
  }

  function get(id) { return getAll().find(f => f.id === id) || null; }

  function save(feature) {
    if (!feature || !feature.id) return false;
    const list = read();
    const i = list.findIndex(f => f.id === feature.id);
    if (i >= 0) list[i] = feature; else list.push(feature);
    return write(list);
  }

  function remove(id) { return write(read().filter(f => f.id !== id)); }

  function reset() {
    localStorage.removeItem(LS);
    document.dispatchEvent(new CustomEvent("wl-features-change"));
  }

  return { getAll, get, save, remove, reset };
})();
