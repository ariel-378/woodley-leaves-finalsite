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

  // ── NYT-style tiers: one lead story, a row of cards, then smaller minis. ──
  function href(a) { return `article.html?id=${encodeURIComponent(a.id)}`; }
  function eyebrow(a) { return `<div class="sec-eyebrow">${window.WL_bylineTagsHtml ? WL_bylineTagsHtml(a) : escapeHtml(a.byline)}</div>`; }
  function deckHtml(a) { return a.deck ? `<p class="sec-deck">${escapeHtml(a.deck)}</p>` : ""; }

  function leadHtml(a) {
    return `
      <article class="sec-lead">
        <div class="sec-lead-text">
          ${eyebrow(a)}
          <h2><a href="${href(a)}">${escapeHtml(a.title)}</a></h2>
          ${deckHtml(a)}
        </div>
        <a class="sec-lead-media" href="${href(a)}">${thumbHtml(a)}</a>
      </article>`;
  }
  function cardHtml(a) {
    return `
      <article class="sec-card">
        <a class="sec-card-media" href="${href(a)}">${thumbHtml(a)}</a>
        ${eyebrow(a)}
        <h3><a href="${href(a)}">${escapeHtml(a.title)}</a></h3>
        ${deckHtml(a)}
      </article>`;
  }
  function miniHtml(a) {
    return `
      <article class="sec-mini">
        <a class="sec-mini-media" href="${href(a)}">${thumbHtml(a)}</a>
        ${eyebrow(a)}
        <h4><a href="${href(a)}">${escapeHtml(a.title)}</a></h4>
      </article>`;
  }

  function render() {
    const list = document.getElementById("article-list");
    if (!list) return;
    const section = list.dataset.section;
    if (!section) return;

    const articles = WLArticles.bySection(section);
    if (articles.length === 0) {
      list.innerHTML = `<div class="section-empty">No articles in this section yet.</div>`;
      return;
    }

    const lead = articles[0];
    const secondary = articles.slice(1, 4);   // up to 3 cards
    const more = articles.slice(4);            // the rest as minis

    let html = leadHtml(lead);
    if (secondary.length) html += `<div class="sec-grid">${secondary.map(cardHtml).join("")}</div>`;
    if (more.length) html += `<div class="sec-more">${more.map(miniHtml).join("")}</div>`;
    list.innerHTML = html;
  }

  document.addEventListener("DOMContentLoaded", render);
  document.addEventListener("wl-articles-change", render);
})();
