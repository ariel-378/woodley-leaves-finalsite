// Search page logic. Reads ?q=... (and optional &section=...) from the URL,
// searches the full article store for matches, ranks by relevance, and
// renders cards matching the section-page card style.
(function () {
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function highlight(text, query) {
    if (!text || !query) return escapeHtml(text || "");
    const safeQ = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${safeQ})`, "ig");
    return escapeHtml(text).replace(re, "<mark>$1</mark>");
  }

  function scoreMatch(a, q) {
    let score = 0;
    if ((a.title || "").toLowerCase().includes(q)) score += 10;
    if ((a.byline || "").toLowerCase().includes(q)) score += 8;
    if ((a.deck || "").toLowerCase().includes(q)) score += 5;
    if ((a.section || "").toLowerCase().includes(q)) score += 3;
    if ((a.body || []).join(" ").toLowerCase().includes(q)) score += 2;
    return score;
  }

  function runSearch(query, sectionFilter) {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const all = WLArticles.getAll();
    const results = [];
    Object.entries(all).forEach(([id, a]) => {
      if (!WLArticles.isVisible(a)) return;
      if (sectionFilter && a.section !== sectionFilter) return;
      const s = scoreMatch(a, q);
      if (s > 0) results.push({ id, relevance: s, ...a });
    });
    return results.sort((a, b) => {
      if (b.relevance !== a.relevance) return b.relevance - a.relevance;
      return (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0);
    });
  }

  // Keep the section filter in sync with the editor-managed sections list.
  function populateSectionFilter(selected) {
    const sel = document.getElementById("section-filter");
    if (!sel || !window.WLSections) return;
    const opts = ['<option value="">All sections</option>']
      .concat(WLSections.articleNames().map(n => `<option>${escapeHtml(n)}</option>`));
    sel.innerHTML = opts.join("");
    sel.value = selected || "";
  }

  function render() {
    const params = new URLSearchParams(location.search);
    const q = params.get("q") || "";
    const section = params.get("section") || "";

    document.getElementById("search-input").value = q;
    populateSectionFilter(section);

    const summary = document.getElementById("search-summary");
    const resultsEl = document.getElementById("search-results");

    if (!q) {
      summary.textContent = "";
      resultsEl.innerHTML = `<p class="search-empty">Type a keyword, topic, or writer above to search.</p>`;
      return;
    }

    const results = runSearch(q, section);

    if (results.length === 0) {
      summary.textContent = `No results for "${q}"${section ? ` in ${section}` : ""}`;
      resultsEl.innerHTML = `<p class="search-empty">No articles matched. Try a different keyword or remove the section filter.</p>`;
      return;
    }

    summary.textContent = `${results.length} result${results.length === 1 ? "" : "s"} for "${q}"${section ? ` in ${section}` : ""}`;
    resultsEl.innerHTML = results.map(a => `
      <article class="search-result">
        <div class="kicker">${escapeHtml(a.section)}</div>
        <h3><a href="${WL_storyHref(a.id)}">${highlight(a.title, q)}</a></h3>
        <div class="byline">By ${window.WL_bylineTagsHtml ? WL_bylineTagsHtml(a) : highlight(a.byline, q)} · ${escapeHtml(a.date)}</div>
      </article>
    `).join("");
  }

  // Submit handler — build query string and reload page so ?q= is shareable
  document.getElementById("search-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = document.getElementById("search-input").value.trim();
    const section = document.getElementById("section-filter").value;
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (section) params.set("section", section);
    const url = `${location.pathname}?${params.toString()}`;
    history.pushState({}, "", url);
    render();
  });

  window.addEventListener("popstate", render);
  document.addEventListener("wl-articles-change", render);
  render();
})();
