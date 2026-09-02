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
  function href(a) { return WL_storyHref(a.id); }
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
  // Overflow items (past the top 4) render as a clean text list — no media.
  function miniHtml(a) {
    return `
      <li class="sec-mini">
        <h4><a href="${href(a)}">${escapeHtml(a.title)}</a></h4>
        ${eyebrow(a)}
      </li>`;
  }

  // Render the section's article grid into an HTML string (empty if none).
  function articlesHtml(section) {
    let articles = WLArticles.bySection(section);
    if (articles.length === 0) return "";

    // Editors can pin a lead story via "Feature" in the dashboard — it moves to
    // the top spot. Otherwise the newest article leads. The rest stay
    // newest-first, and anything past the top 4 lists below.
    const featuredId = WLArticles.getFeaturedId ? WLArticles.getFeaturedId(section) : null;
    if (featuredId) {
      const idx = articles.findIndex(a => a.id === featuredId);
      if (idx > 0) articles = [articles[idx], ...articles.slice(0, idx), ...articles.slice(idx + 1)];
    }

    const lead = articles[0];
    const secondary = articles.slice(1, 4);   // up to 3 cards
    const more = articles.slice(4);            // everything past the top 4

    let html = leadHtml(lead);
    if (secondary.length) html += `<div class="sec-grid">${secondary.map(cardHtml).join("")}</div>`;
    if (more.length) {
      html += `<div class="sec-more-wrap">
        <h3 class="sec-more-title">More in ${escapeHtml(section)}</h3>
        <ul class="sec-more">${more.map(miniHtml).join("")}</ul>
      </div>`;
    }
    return html;
  }

  // Video grid for a section that holds "Videos". Reuses the Video page's card.
  function videoCardHtml(v) {
    const info = WLVideos.parseVideo(v.url);
    const thumb = (info && info.type === "youtube")
      ? `<img src="https://img.youtube.com/vi/${info.id}/hqdefault.jpg" alt="${escapeHtml(v.title)}" loading="lazy">`
      : `<div class="video-placeholder"></div>`;
    return `
      <a class="video-card" href="video.html?id=${encodeURIComponent(v.id)}">
        <div class="video-thumb">
          ${thumb}
          <span class="video-play" aria-hidden="true">▶</span>
          ${v.duration ? `<span class="video-duration">${escapeHtml(v.duration)}</span>` : ""}
        </div>
        <div class="video-body">
          <h4>${escapeHtml(v.title)}</h4>
          <div class="byline">By ${escapeHtml(v.byline)} · ${escapeHtml(v.date)}</div>
        </div>
      </a>`;
  }
  function videosHtml(section) {
    if (!window.WLVideos) return "";
    const videos = Object.entries(WLVideos.getAll())
      .filter(([, v]) => ownedHere(v, "Videos", section) && (!window.WLSchedule || WLSchedule.isLive(v)))
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
    if (!videos.length) return "";
    return `<h3 class="sec-block-title">Video</h3>
      <div class="video-grid wide">${videos.map(videoCardHtml).join("")}</div>`;
  }

  // Team-records grid for a section that holds "Sports stats".
  function sportsHtml() {
    if (!window.WLTeams) return "";
    const teams = WLTeams.getAllTeams();
    const slugs = Object.keys(teams);
    if (!slugs.length) return "";
    const cards = slugs.map(slug => {
      const t = teams[slug];
      const r = t.record || { w: 0, l: 0, t: 0 };
      const rec = r.t ? `${r.w}–${r.l}–${r.t}` : `${r.w}–${r.l}`;
      const total = r.w + r.l + (r.t || 0);
      const pct = total > 0 ? Math.round(100 * r.w / total) : 0;
      return `
        <a class="team-card" href="team.html?team=${encodeURIComponent(slug)}">
          <div class="team-sport">${escapeHtml(t.sport)}</div>
          <h4>${escapeHtml(t.name)}</h4>
          <div class="team-record"><span class="record-big">${rec}</span><span class="record-pct">${pct}%</span></div>
          <div class="team-record-label">W–L${r.t ? "–T" : ""}</div>
        </a>`;
    }).join("");
    return `<h3 class="sec-block-title">Team records</h3><div class="teams-grid">${cards}</div>`;
  }

  // Centerspread pieces (poems, art/photos, reveal-answer) reused on a section.
  function csBlocks(body) {
    return String(body || "").replace(/\r\n/g, "\n").split(/\n\s*\n/)
      .map(b => b.split("\n").filter(l => l.trim() !== "")).filter(b => b.length);
  }
  function csHead(p) {
    return `<div class="print-piece-head">${p.kicker ? `<div class="kicker">${escapeHtml(p.kicker)}</div>` : ""}<h3>${escapeHtml(p.title || "")}</h3>${p.byline ? `<div class="byline">${escapeHtml(p.byline)}</div>` : ""}</div>`;
  }
  function csBody(p) {
    if (p.type === "image") return p.image ? `<figure class="print-piece-figure"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.alt || "")}"></figure>` : "";
    if (p.type === "poem") {
      const stanzas = csBlocks(p.body).map(st => `<div class="poem-stanza">${st.map(l => `<p>${escapeHtml(l)}</p>`).join("")}</div>`).join("");
      return `<div class="poem-body">${stanzas}</div>`;
    }
    return `<div class="teacher-body">${csBlocks(p.body).map(par => `<p>${escapeHtml(par.join(" "))}</p>`).join("")}</div>`;
  }
  function csReveal(p) {
    if (!p.reveal || !(p.reveal.answer || "").trim()) return "";
    return `<details class="reveal"><summary>${escapeHtml(p.reveal.summary || "Reveal the answer")}</summary><div class="reveal-body">${escapeHtml(p.reveal.answer)}</div></details>`;
  }
  function csPiece(p) {
    return `<article class="print-piece${p.type === "poem" ? " poem-piece" : ""}">${csHead(p)}${csBody(p)}${csReveal(p)}</article>`;
  }
  // Which section a reader is looking at, for the ownership filter below.
  function ownedHere(item, type, section) {
    return !window.WLSections || WLSections.belongsTo(item, type, section);
  }

  function piecesBlock(title, predicate, shown, type, section) {
    if (!window.WLCenterspread) return "";
    const pieces = WLCenterspread.list()
      .filter(p => p && predicate(p) && !shown.has(p.id) && ownedHere(p, type, section)
                && (!window.WLSchedule || WLSchedule.isLive(p)));
    if (!pieces.length) return "";
    pieces.forEach(p => shown.add(p.id));
    return `<h3 class="sec-block-title">${escapeHtml(title)}</h3><div class="sec-pieces">${pieces.map(csPiece).join("")}</div>`;
  }

  // Interactive puzzles: embed the Centerspread's puzzles-only view so the real
  // crossword / spelling bee / connections / word search run here too. Same
  // origin, so their saved progress works exactly as on the Centerspread.
  function puzzlesHtml() {
    return `<h3 class="sec-block-title">Puzzles</h3>
      <iframe class="sec-puzzles-frame" src="centerspread.html?embed=puzzles" title="Puzzles" loading="lazy"></iframe>`;
  }
  // The embedded page reports its height; size the frame to match.
  // A custom feature can tell us how tall it actually is. A sandboxed frame has
  // no same-origin access, so we cannot measure it from out here — but it can
  // post its own height in. Features that do this size themselves at every
  // screen width; those that don't fall back to the Height field in the editor.
  window.addEventListener("message", function (e) {
    const fh = e.data && e.data.wlFeatureHeight;
    if (fh) {
      document.querySelectorAll("iframe.sec-custom-frame").forEach(function (f) {
        if (f.contentWindow === e.source) f.style.height = Math.ceil(fh) + "px";
      });
      return;
    }
    const h = e.data && e.data.wlEmbedHeight;
    if (!h) return;
    document.querySelectorAll("iframe.sec-puzzles-frame").forEach(function (f) {
      if (f.contentWindow === e.source) f.style.height = h + "px";
    });
  });

  function render() {
    const list = document.getElementById("article-list");
    if (!list) return;
    const section = list.dataset.section;
    if (!section) return;

    // A section renders each of the content types the editor gave it. Sections
    // with no declared types fall back to Articles (covers the static pages).
    const types = window.WLSections && WLSections.contentTypes ? WLSections.contentTypes(section) : [];
    const wantsArticles = types.length === 0 || types.includes("Articles");

    list.innerHTML = "";
    if (wantsArticles) list.insertAdjacentHTML("beforeend", articlesHtml(section));
    if (types.includes("Sports stats") && window.WLTeams) list.insertAdjacentHTML("beforeend", sportsHtml());
    if (types.includes("Videos") && window.WLVideos) list.insertAdjacentHTML("beforeend", videosHtml(section));

    // The built-in puzzles live in one section. Another section that ticks
    // Puzzle games starts empty and fills up with puzzles added to it, rather
    // than mirroring somebody else's.
    if (types.includes("Puzzle games") && WLSections.firstWithType("Puzzle games") === section) {
      list.insertAdjacentHTML("beforeend", puzzlesHtml());
    }

    const shownPieces = new Set();
    if (types.includes("Poems")) list.insertAdjacentHTML("beforeend", piecesBlock("Poems", p => p.type === "poem", shownPieces, "Poems", section));
    if (types.includes("Art/photos")) list.insertAdjacentHTML("beforeend", piecesBlock("Art & photos", p => p.type === "image", shownPieces, "Art/photos", section));
    if (types.includes("Reveal-answer games")) list.insertAdjacentHTML("beforeend", piecesBlock("Reveal & answer", p => !!(p.reveal && (p.reveal.answer || "").trim()), shownPieces, "Reveal-answer games", section));

    // Custom features: editor-written content that is not a game — a comic
    // strip, a photo essay, an embedded map. Each is its own piece, so a
    // section can hold several. Every one runs in a sandbox with no
    // same-origin access, so it cannot touch the page around it.
    if (types.includes("Custom feature") && window.WLFeatures) {
      const features = WLFeatures.getAll()
        .filter(f => f && (f.code || "").trim() && ownedHere(f, "Custom feature", section)
                  && (!window.WLSchedule || WLSchedule.isLive(f)));
      if (features.length) {
        const heading = document.createElement("h3");
        heading.className = "sec-block-title";
        heading.textContent = features.length === 1 ? "Feature" : "Features";
        list.appendChild(heading);

        features.forEach(f => {
          const wrap = document.createElement("div");
          wrap.className = "sec-custom";

          if (f.kicker) {
            const k = document.createElement("div");
            k.className = "kicker";
            k.textContent = f.kicker;
            wrap.appendChild(k);
          }
          if (f.title) {
            const h = document.createElement("h4");
            h.className = "sec-custom-title";
            h.textContent = f.title;
            wrap.appendChild(h);
          }
          if (f.description) {
            const d = document.createElement("p");
            d.className = "sec-custom-desc";
            d.textContent = f.description;
            wrap.appendChild(d);
          }

          const frame = document.createElement("iframe");
          frame.className = "sec-custom-frame";
          frame.setAttribute("sandbox", "allow-scripts");
          frame.setAttribute("title", f.title || (section + " feature"));
          frame.setAttribute("loading", "lazy");
          frame.style.height = (parseInt(f.height, 10) || 500) + "px";
          frame.srcdoc = f.code;
          wrap.appendChild(frame);
          list.appendChild(wrap);
        });
      }
    }

    if (!list.firstChild) {
      list.innerHTML = `<div class="section-empty">No content in this section yet.</div>`;
    }
  }

  document.addEventListener("DOMContentLoaded", render);
  document.addEventListener("wl-articles-change", render);
  document.addEventListener("wl-sections-change", render);
  document.addEventListener("wl-features-change", render);
  document.addEventListener("wl-videos-change", render);
  document.addEventListener("wl-teams-change", render);
  document.addEventListener("wl-centerspread-change", render);
})();
