// Stores editor-added games in localStorage so non-technical editors can add a
// game from the dashboard without touching the codebase. Each game is:
//   { id, title, kicker, description, height, code }
// `code` is a self-contained HTML document (markup + <style> + <script>) that
// the Centerspread renders inside a sandboxed <iframe>.
//
// Note: like every other dashboard edit on this site, games live in the
// browser's localStorage. When the site is wired to a real CMS/back end, this
// store is the single place to swap for server-side persistence.
window.WLGamesStore = (function () {
  const LS = "wl_custom_games";

  function read() {
    try {
      const v = JSON.parse(localStorage.getItem(LS) || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  function write(list) {
    localStorage.setItem(LS, JSON.stringify(list));
    document.dispatchEvent(new CustomEvent("wl-games-change"));
  }

  // Shipped defaults (window.WL_GAMES) merge with editor-added games; a stored
  // game overrides a default with the same id.
  function getAll() {
    const base = Array.isArray(window.WL_GAMES) ? window.WL_GAMES : [];
    const byId = {};
    base.forEach(g => { if (g && g.id) byId[g.id] = g; });
    read().forEach(g => { if (g && g.id) byId[g.id] = g; });
    return Object.values(byId);
  }
  function get(id) { return getAll().find(g => g.id === id) || null; }

  function save(game) {
    const list = read();
    const i = list.findIndex(g => g.id === game.id);
    if (i >= 0) list[i] = game; else list.push(game);
    write(list);
  }
  function remove(id) { write(read().filter(g => g.id !== id)); }
  function reset() { localStorage.removeItem(LS); document.dispatchEvent(new CustomEvent("wl-games-change")); }

  return { getAll, get, save, remove, reset };
})();
