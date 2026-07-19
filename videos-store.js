// Merges static videos from videos.js with editor changes in localStorage.
// Same pattern as articles-store.js / teams-store.js.
window.WLVideos = (function () {
  const LS_CUSTOM = "wl_videos_custom";
  const LS_DELETED = "wl_videos_deleted";

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }
  function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function fire() { document.dispatchEvent(new CustomEvent("wl-videos-change")); }

  function getAll() {
    const base = window.WL_VIDEOS || {};
    const custom = read(LS_CUSTOM, {});
    const deleted = read(LS_DELETED, []);
    const merged = {};
    Object.keys(base).forEach(id => {
      if (!deleted.includes(id)) merged[id] = base[id];
    });
    Object.keys(custom).forEach(id => { merged[id] = custom[id]; });
    return merged;
  }
  function getById(id) { return getAll()[id]; }

  function save(id, data) {
    const custom = read(LS_CUSTOM, {});
    custom[id] = data;
    write(LS_CUSTOM, custom);
    const deleted = read(LS_DELETED, []).filter(x => x !== id);
    write(LS_DELETED, deleted);
    fire();
  }
  function remove(id) {
    const custom = read(LS_CUSTOM, {});
    if (custom[id]) { delete custom[id]; write(LS_CUSTOM, custom); }
    const base = window.WL_VIDEOS || {};
    if (base[id]) {
      const deleted = read(LS_DELETED, []);
      if (!deleted.includes(id)) { deleted.push(id); write(LS_DELETED, deleted); }
    }
    fire();
  }
  function isCustom(id) {
    const custom = read(LS_CUSTOM, {});
    return id in custom;
  }
  function reset() {
    localStorage.removeItem(LS_CUSTOM);
    localStorage.removeItem(LS_DELETED);
    fire();
  }

  // Extract YouTube/Vimeo ID for thumbnail + embed
  function parseVideo(url) {
    if (!url) return null;
    const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/);
    if (yt) return { type: "youtube", id: yt[1] };
    const vm = url.match(/vimeo\.com\/(\d+)/);
    if (vm) return { type: "vimeo", id: vm[1] };
    return null;
  }

  return { getAll, getById, save, remove, isCustom, reset, parseVideo };
})();
