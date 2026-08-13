// Renders the homepage in a three-column, magazine-style layout: a left rail of
// two stories, a large centered hero in the middle, and a right rail of
// headline-plus-thumbnail items. Photos are used when present; without them each
// slot shows a placeholder box.
//
// Editors get an "Edit layout" mode that makes every story draggable — drop one
// onto another to reorder which story fills each slot. The arrangement is saved
// (WLHomeOrder) and shown to readers.
(function () {
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function youtubeId(url) {
    if (!url) return null;
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/);
    return m ? m[1] : null;
  }
  function href(a) { return `article.html?id=${encodeURIComponent(a.id)}`; }
  function byline(a) { return window.WL_bylineTagsHtml ? WL_bylineTagsHtml(a) : escapeHtml(a.byline); }

  // Byline plus date. A reader who can't tell whether a story is from this week
  // or last March can't decide whether to trust it or pass it on — and the
  // front page was the one place the date wasn't shown.
  function credit(a) {
    var by = byline(a);
    return a.date ? by + ' <span class="ha-date">· ' + escapeHtml(a.date) + "</span>" : by;
  }

  // Media slot: a photo, a video thumbnail, or a placeholder box that reserves
  // the space where the photo will go.
  function mediaImg(a, cls) {
    if (a.photo) {
      return `<img class="${cls}" src="${escapeHtml(a.photo)}" alt="${escapeHtml(a.title)}" loading="lazy">`;
    }
    const yt = youtubeId(a.video);
    if (yt) {
      return `<span class="${cls} ha-video"><img src="https://img.youtube.com/vi/${yt}/hqdefault.jpg" alt="${escapeHtml(a.title)}" loading="lazy"><span class="play-icon" aria-hidden="true">▶</span></span>`;
    }
    return `<span class="${cls} ha-ph" role="img" aria-label="Photo coming soon"></span>`;
  }

  function getAllSorted() {
    const all = WLArticles.getAll();
    return Object.entries(all)
      .map(([id, a]) => ({ id, ...a }))
      .filter(a => WLArticles.isVisible(a))
      .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
  }

  function heroHtml(a) {
    return `
      <a class="ha-hero-media" href="${href(a)}">${mediaImg(a, "ha-hero-img")}</a>
      <div class="ha-hero-body">
        <div class="kicker">${escapeHtml(a.section)}</div>
        <h2 class="ha-hero-title"><a href="${href(a)}">${escapeHtml(a.title)}</a></h2>
        ${a.deck ? `<p class="ha-hero-deck">${escapeHtml(a.deck)}</p>` : ""}
        <div class="ha-byline">${credit(a)}</div>
      </div>`;
  }

  function leftHtml(a) {
    return `
      <article class="ha-left-story" data-home-id="${escapeHtml(a.id)}">
        <a class="ha-left-media" href="${href(a)}">${mediaImg(a, "ha-left-img")}</a>
        <h3 class="ha-left-title"><a href="${href(a)}">${escapeHtml(a.title)}</a></h3>
        <div class="ha-byline">${credit(a)}</div>
      </article>`;
  }

  function rightHtml(a) {
    return `
      <article class="ha-right-item" data-home-id="${escapeHtml(a.id)}">
        <div class="ha-right-text">
          <h4 class="ha-right-title"><a href="${href(a)}">${escapeHtml(a.title)}</a></h4>
          <div class="ha-byline">${credit(a)}</div>
        </div>
        <a class="ha-right-thumb" href="${href(a)}">${mediaImg(a, "ha-right-img")}</a>
      </article>`;
  }

  // ===== Designated section blocks (below the hero) =====
  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  // Image for a section-block card: photo, YouTube still, or placeholder box
  // (the placeholder reuses .ha-ph so it fills the same aspect box).
  function imgTag(a, cls) {
    if (a.photo) {
      return `<img class="${cls}" src="${escapeHtml(a.photo)}" alt="${escapeHtml(a.title)}" loading="lazy">`;
    }
    const yt = youtubeId(a.video);
    if (yt) {
      return `<img class="${cls}" src="https://img.youtube.com/vi/${yt}/hqdefault.jpg" alt="${escapeHtml(a.title)}" loading="lazy">`;
    }
    return `<span class="${cls} ha-ph" role="img" aria-label="Photo coming soon"></span>`;
  }

  // The lead story of a block: large image, deck, prominent headline.
  function hsbLeadHtml(a) {
    return `
      <article class="hsb-lead">
        <a class="hsb-lead-media" href="${href(a)}">${imgTag(a, "hsb-lead-img")}</a>
        <div class="sec-eyebrow">${credit(a)}</div>
        <h3><a href="${href(a)}">${escapeHtml(a.title)}</a></h3>
        ${a.deck ? `<p class="sec-deck">${escapeHtml(a.deck)}</p>` : ""}
      </article>`;
  }
  // Secondary stories: compact rows with a small thumbnail.
  function hsbMiniHtml(a) {
    return `
      <article class="hsb-mini">
        <div class="hsb-mini-text">
          <h4><a href="${href(a)}">${escapeHtml(a.title)}</a></h4>
          <div class="sec-eyebrow">${credit(a)}</div>
        </div>
        <a class="hsb-mini-thumb" href="${href(a)}">${imgTag(a, "hsb-mini-img")}</a>
      </article>`;
  }

  // One block per editorial (article-holding) section, in nav order. Each block
  // leads with its newest story and stacks up to three more beside it; the lead
  // side alternates block-to-block for an editorial rhythm. Empty sections are
  // skipped so the homepage never shows a blank block.
  function sectionBlocksHtml() {
    if (!window.WLSections || !window.WLArticles) return "";
    const sections = WLSections.navSections()
      .filter(s => Array.isArray(s.contentTypes) && s.contentTypes.includes("Articles"));
    let shown = 0;
    return sections.map(s => {
      const arts = WLArticles.bySection(s.name).slice(0, 4);
      if (!arts.length) return "";
      const headingId = "hsb-" + slug(s.name);
      const flip = (shown++ % 2 === 1) ? " hsb-flip" : "";
      const [lead, ...rest] = arts;
      return `
        <section class="home-section-block${flip}" aria-labelledby="${headingId}">
          <div class="section-header">
            <h2 id="${headingId}"><a href="${escapeHtml(s.page)}">${escapeHtml(s.name)}</a></h2>
            <a class="see-all" href="${escapeHtml(s.page)}">See all →</a>
          </div>
          <div class="hsb-grid">
            ${hsbLeadHtml(lead)}
            <div class="hsb-cards">${rest.map(hsbMiniHtml).join("")}</div>
          </div>
        </section>`;
    }).join("");
  }

  function renderBreaking(sorted) {
    const banner = document.getElementById("breaking-banner");
    const overlay = document.getElementById("breaking-popup");
    if (!banner || !overlay) return;
    const breaking = sorted.find(a => a.section === "Breaking");
    if (!breaking) {
      banner.style.display = "none";
      overlay.style.display = "none";
      return;
    }
    banner.style.display = "";
    overlay.style.display = "";
    const bannerText = banner.querySelectorAll("span")[1];
    if (bannerText) bannerText.textContent = `${breaking.title} — click for details`;
    banner.setAttribute("aria-label", `Open breaking news — ${breaking.title}`);
    const h = document.getElementById("breaking-heading");
    const d = document.getElementById("breaking-desc");
    const cta = overlay.querySelector(".popup-cta");
    if (h) h.textContent = breaking.title;
    if (d) d.textContent = breaking.deck;
    if (cta) cta.href = `article.html?id=${encodeURIComponent(breaking.id)}`;
  }

  function renderVideoModule() {
    const wrap = document.getElementById("home-video-module");
    if (!wrap || !window.WLVideos) return;
    const videos = Object.entries(WLVideos.getAll())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
    if (videos.length === 0) { wrap.hidden = true; return; }
    wrap.hidden = false;

    const featured = videos[0];
    const featEl = document.getElementById("home-video-featured");
    const info = WLVideos.parseVideo(featured.url);
    const thumb = (info && info.type === "youtube")
      ? `<img src="https://img.youtube.com/vi/${info.id}/hqdefault.jpg" alt="${escapeHtml(featured.title)}" loading="lazy">`
      : `<div class="video-placeholder"></div>`;
    featEl.href = `video.html?id=${encodeURIComponent(featured.id)}`;
    featEl.innerHTML = `
      <div class="home-video-thumb">
        ${thumb}
        <span class="video-play" aria-hidden="true">▶</span>
        ${featured.duration ? `<span class="video-duration">${escapeHtml(featured.duration)}</span>` : ""}
      </div>
      <div class="home-video-text">
        <div class="kicker">Interview</div>
        <h3>${escapeHtml(featured.title)}</h3>
        ${featured.description ? `<p>${escapeHtml(featured.description)}</p>` : ""}
        <div class="byline">By ${byline(featured)} · ${escapeHtml(featured.date)}</div>
      </div>
    `;
  }

  function fill(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }

  // The logical slot order of the currently shown stories (hero, left, right,
  // more) as article ids — used by the drag-and-drop editor.
  let lastOrderIds = [];

  function render() {
    const sorted = getAllSorted();
    renderBreaking(sorted);

    // Breaking runs in the banner, so keep it out of the main story flow.
    const stories = sorted.filter(a => a.section !== "Breaking");

    // Apply the editor's saved order, if any; unlisted (e.g. new) stories fall
    // in afterwards, newest first.
    let ordered = stories;
    const custom = window.WLHomeOrder && WLHomeOrder.get();
    if (custom && custom.length) {
      const byId = new Map(stories.map(a => [a.id, a]));
      ordered = custom.map(id => byId.get(id)).filter(Boolean);
      stories.forEach(a => { if (!ordered.includes(a)) ordered.push(a); });
    }
    lastOrderIds = ordered.map(a => a.id);

    const hero = ordered[0];
    const left = ordered.slice(1, 3);
    const right = ordered.slice(3, 7);   // right rail: 4 stories

    const heroEl = document.getElementById("home-hero");
    if (heroEl) {
      heroEl.innerHTML = hero ? heroHtml(hero) : `<p class="ha-empty">No stories yet.</p>`;
      if (hero) heroEl.dataset.homeId = hero.id; else delete heroEl.dataset.homeId;
    }
    fill("home-left", left.map(leftHtml).join("") +
      `<div class="sidebar-ads ha-sponsor" data-ads-offset="0" data-ads-limit="1"></div>`);
    fill("home-right", right.map(rightHtml).join(""));

    const below = document.getElementById("home-below");
    if (below) {
      below.innerHTML = `
        <section class="home-video-module" id="home-video-module" hidden>
          <div class="section-header"><h2>Video</h2><a href="videos.html" class="see-all">See all →</a></div>
          <a class="home-video-featured" id="home-video-featured" href="#"></a>
        </section>
        ${sectionBlocksHtml()}`;
      renderVideoModule();
    }

    if (document.body.classList.contains("wl-home-edit")) enableDragDrop();

    // Let the ads store fill any placeholders we just rendered.
    document.dispatchEvent(new CustomEvent("wl-ads-change"));
  }

  // ===== Drag-and-drop layout editing (editors only) =====
  let dragId = null;

  // Reordering by dragging is pointer-only. The same move is offered as two
  // buttons per story so the front page can be arranged from the keyboard.
  function moveStory(id, dir) {
    const ids = lastOrderIds.slice();
    const from = ids.indexOf(id);
    const to = dir === "up" ? from - 1 : from + 1;
    if (from < 0 || to < 0 || to >= ids.length) return;
    ids.splice(from, 1);
    ids.splice(to, 0, id);
    WLHomeOrder.set(ids);   // fires wl-home-order-change → render()
    // Focus the same control on the re-rendered card so repeated presses work.
    setTimeout(() => {
      const btn = document.querySelector(`[data-home-id="${id}"] [data-home-move="${dir}"]`);
      if (btn) btn.focus();
    }, 0);
  }

  function addStoryMoveControls(el) {
    if (el.querySelector(":scope > .wl-home-move")) return;
    const title = (el.querySelector("h2, h3, .ha-hero-title, a") || {}).textContent || "story";
    const label = title.trim().slice(0, 40);
    const box = document.createElement("div");
    box.className = "wl-home-move";
    box.innerHTML = `
      <button type="button" class="wl-mc-btn" data-home-move="up" aria-label="Move “${label}” earlier">↑</button>
      <button type="button" class="wl-mc-btn" data-home-move="down" aria-label="Move “${label}” later">↓</button>
    `;
    box.querySelectorAll("[data-home-move]").forEach(b => {
      b.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        moveStory(el.dataset.homeId, b.dataset.homeMove);
      });
    });
    el.appendChild(box);
  }

  function enableDragDrop() {
    document.querySelectorAll("[data-home-id]").forEach(el => {
      addStoryMoveControls(el);
      el.setAttribute("draggable", "true");
      el.addEventListener("dragstart", (e) => {
        dragId = el.dataset.homeId;
        e.dataTransfer.effectAllowed = "move";
        try { e.dataTransfer.setData("text/plain", dragId); } catch (_) {}
        el.classList.add("wl-dragging");
      });
      el.addEventListener("dragend", () => {
        el.classList.remove("wl-dragging");
        document.querySelectorAll(".wl-drop-target").forEach(x => x.classList.remove("wl-drop-target"));
      });
      el.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (el.dataset.homeId !== dragId) el.classList.add("wl-drop-target");
      });
      el.addEventListener("dragleave", () => el.classList.remove("wl-drop-target"));
      el.addEventListener("drop", (e) => {
        e.preventDefault();
        el.classList.remove("wl-drop-target");
        const targetId = el.dataset.homeId;
        if (!dragId || dragId === targetId) return;
        const ids = lastOrderIds.slice();
        const from = ids.indexOf(dragId);
        const to = ids.indexOf(targetId);
        if (from < 0 || to < 0) return;
        ids.splice(from, 1);
        ids.splice(to, 0, dragId);
        WLHomeOrder.set(ids); // fires wl-home-order-change → render()
        dragId = null;
      });
    });
  }

  // Floating control bar, visible only to editors.
  function setupEditBar() {
    const isEditor = window.WLAuth && WLAuth.isEditor && WLAuth.isEditor();
    let bar = document.getElementById("wl-home-edit-bar");
    if (!isEditor) {
      if (bar) bar.remove();
      document.body.classList.remove("wl-home-edit");
      render();
      return;
    }
    if (bar) return;
    bar = document.createElement("div");
    bar.id = "wl-home-edit-bar";
    bar.className = "wl-home-edit-bar";
    bar.innerHTML =
      `<span class="wl-home-edit-hint" hidden>Drag a story onto another to reorder</span>` +
      `<button type="button" id="wl-home-edit-reset" hidden>Reset to newest</button>` +
      `<button type="button" id="wl-home-edit-toggle">Edit layout</button>`;
    document.body.appendChild(bar);

    document.getElementById("wl-home-edit-toggle").addEventListener("click", () => {
      const on = document.body.classList.toggle("wl-home-edit");
      document.getElementById("wl-home-edit-toggle").textContent = on ? "Done" : "Edit layout";
      document.getElementById("wl-home-edit-reset").hidden = !on;
      bar.querySelector(".wl-home-edit-hint").hidden = !on;
      render();
    });
    document.getElementById("wl-home-edit-reset").addEventListener("click", () => {
      if (!confirm("Reset the homepage to newest-first order?")) return;
      WLHomeOrder.clear();
    });
  }

  document.addEventListener("DOMContentLoaded", () => { render(); setupEditBar(); });
  document.addEventListener("wl-articles-change", render);
  document.addEventListener("wl-videos-change", render);
  document.addEventListener("wl-home-order-change", render);
  document.addEventListener("wl-auth-change", setupEditBar);
})();
