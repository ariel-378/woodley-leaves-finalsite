// Tracks article views. Each view is a timestamp; we filter by recency when
// computing "most read this week". localStorage-only — real deployment would
// aggregate views server-side so every reader contributes to the same tally.
window.WLViews = (function () {
  const LS_VIEWS = "wl_article_views";  // { articleId: [timestamp, timestamp, ...] }
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  function read() {
    try { return JSON.parse(localStorage.getItem(LS_VIEWS) || "{}"); }
    catch { return {}; }
  }
  function write(obj) { localStorage.setItem(LS_VIEWS, JSON.stringify(obj)); }

  function record(articleId) {
    if (!articleId) return;
    const views = read();
    views[articleId] = views[articleId] || [];
    views[articleId].push(Date.now());
    // Prune per-article to recent 30 days to keep storage small
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    views[articleId] = views[articleId].filter(t => t > cutoff);
    write(views);
  }

  function countFor(articleId, windowMs) {
    const views = read();
    const list = views[articleId] || [];
    if (!windowMs) return list.length;
    const cutoff = Date.now() - windowMs;
    return list.filter(t => t > cutoff).length;
  }

  // Returns [{articleId, count}] sorted desc. `windowMs` defaults to 7 days.
  function topArticles(limit, windowMs) {
    if (windowMs === undefined) windowMs = WEEK_MS;
    const views = read();
    const cutoff = Date.now() - windowMs;
    const ranked = Object.entries(views)
      .map(([id, list]) => ({ articleId: id, count: windowMs ? list.filter(t => t > cutoff).length : list.length }))
      .filter(r => r.count > 0)
      .sort((a, b) => b.count - a.count);
    return typeof limit === "number" ? ranked.slice(0, limit) : ranked;
  }

  function reset() {
    localStorage.removeItem(LS_VIEWS);
  }

  return { record, countFor, topArticles, reset, WEEK_MS };
})();
