// Renders article cards into <div id="article-list" data-section="..."></div>
// on a section page. Re-renders when the editor changes data.
(function () {
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // Pull a YouTube ID out of a URL, if it is a YouTube link.
  function youtubeId(url) {
    if (!url) return null;
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/);
    return m ? m[1] : null;
  }

  // Returns HTML for the lede thumbnail. Uses photo if present, then YouTube
  // video thumbnail, else falls back to the cream placeholder.
  function thumbHtml(a) {
    if (a.photo) {
      return `<img class="card-photo" src="${escapeHtml(a.photo)}" alt="${escapeHtml(a.title)}">`;
    }
    const ytId = youtubeId(a.video);
    if (ytId) {
      return `<div class="card-video">
        <img class="card-photo" src="https://img.youtube.com/vi/${ytId}/hqdefault.jpg" alt="${escapeHtml(a.title)}">
        <span class="play-icon" aria-hidden="true">▶</span>
      </div>`;
    }
    if (a.video) {
      // Vimeo or unrecognized — placeholder with play overlay
      return `<div class="card-video"><div class="photo wide"></div><span class="play-icon" aria-hidden="true">▶</span></div>`;
    }
    return `<div class="photo wide"></div>`;
  }

  function render() {
    const list = document.getElementById("article-list");
    if (!list) return;
    const section = list.dataset.section;
    if (!section) return;

    const articles = WLArticles.bySection(section);
    list.innerHTML = "";

    if (articles.length === 0) {
      const empty = document.createElement("div");
      empty.className = "section-empty";
      empty.textContent = "No articles in this section yet.";
      list.appendChild(empty);
      return;
    }

    articles.forEach((a, i) => {
      const article = document.createElement("article");
      article.className = "story";
      // Top story (first) gets a media slot
      const mediaHtml = i === 0 ? thumbHtml(a) : "";
      article.innerHTML = `
        ${mediaHtml}
        <h3><a href="article.html?id=${encodeURIComponent(a.id)}">${escapeHtml(a.title)}</a></h3>
        <div class="byline">By ${escapeHtml(a.byline)} · ${escapeHtml(a.date)}</div>
      `;
      list.appendChild(article);
    });
  }

  document.addEventListener("DOMContentLoaded", render);
  document.addEventListener("wl-articles-change", render);
})();
