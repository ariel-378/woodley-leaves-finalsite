// Renders the homepage's story slots from the article store.
// The lede comes from the editor-featured article (or falls back to the most
// recent article if no feature is set). Other slots auto-fill with the latest
// articles, deduplicated against the lede.
(function () {
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // HTML skeletons for every movable block on the homepage. layoutHomepage()
  // inserts these into the zones selected by the editor via the layout
  // dashboard, and the regular render functions below then fill each skeleton
  // with its dynamic content.
  const BLOCK_HTML = {
    "ad-1": '<div class="sidebar-ads" data-ads-offset="0" data-ads-limit="1"></div>',
    "ad-2": '<div class="sidebar-ads" data-ads-offset="1" data-ads-limit="1"></div>',
    "ad-3": '<div class="sidebar-ads" data-ads-offset="2" data-ads-limit="1"></div>',
    "ad-4": '<div class="sidebar-ads" data-ads-offset="3" data-ads-limit="1"></div>',
    "story-right-1": '<div id="home-right-1"></div>',
    "story-right-2": '<div id="home-right-2"></div>',
    "video-module": `<section class="home-video-module" id="home-video-module" hidden>
      <div class="section-header" style="margin-top: 40px;">
        <h2>Video</h2>
        <a href="videos.html" class="see-all" style="color: var(--accent); font-weight: 600;">See all →</a>
      </div>
      <a class="home-video-featured" id="home-video-featured" href="#"></a>
    </section>`,
    "more-section": `<div class="section-header" style="margin-top: 50px;">
      <h2>More from the newsroom</h2>
      <span class="see-all">Updated hourly</span>
    </div>
    <div class="home-grid">
      <section id="home-more-1"></section>
      <section id="home-more-2"></section>
      <aside><div class="sidebar-ads" data-ads-offset="2" data-ads-limit="2"></div></aside>
    </div>`
  };

  function layoutHomepage() {
    if (!window.WLLayout) return;
    const layout = WLLayout.getLayout();
    ["right-sidebar", "below-main"].forEach(zoneName => {
      const zone = document.querySelector(`[data-zone="${zoneName}"]`);
      if (!zone) return;
      const blocks = layout[zoneName] || [];
      zone.innerHTML = blocks.map((blockKey, i) => {
        const inner = BLOCK_HTML[blockKey] || "";
        const blockInfo = WLLayout.BLOCKS[blockKey];
        const label = blockInfo ? blockInfo.label : blockKey;
        const canUp = i > 0, canDown = i < blocks.length - 1;
        const zoneOpts = WLLayout.ZONES.map(z =>
          `<option value="${z}" ${z === zoneName ? "selected" : ""}>${z.replace("-", " ")}</option>`
        ).join("");
        return `<div class="wl-block" data-block="${blockKey}">
          <div class="wl-block-controls" aria-hidden="true">
            <span class="wl-block-label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
            <button type="button" class="wl-ctl" data-act="up" data-block="${blockKey}" ${canUp ? "" : "disabled"} aria-label="Move block up">↑</button>
            <button type="button" class="wl-ctl" data-act="down" data-block="${blockKey}" ${canDown ? "" : "disabled"} aria-label="Move block down">↓</button>
            <select class="wl-ctl-zone" data-block="${blockKey}" aria-label="Move to zone">${zoneOpts}</select>
          </div>
          ${inner}
        </div>`;
      }).join("");
    });

    // Wire control clicks (rebuilt each layout)
    document.querySelectorAll(".wl-block-controls .wl-ctl").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        const act = btn.dataset.act;
        const block = btn.dataset.block;
        WLLayout.shiftBlock(block, act === "up" ? -1 : 1);
      });
    });
    document.querySelectorAll(".wl-block-controls .wl-ctl-zone").forEach(sel => {
      sel.addEventListener("change", (e) => {
        e.preventDefault();
        WLLayout.moveBlock(e.target.dataset.block, e.target.value);
      });
      // Prevent dropdown clicks from bubbling into block links
      sel.addEventListener("click", e => e.stopPropagation());
    });
  }

  // Floating "Edit layout" / "Done editing" toggle, visible only to editors
  function setupLayoutToggle() {
    const isEditor = window.WLAuth && WLAuth.isEditor();
    let btn = document.getElementById("wl-layout-toggle");
    if (!isEditor) {
      if (btn) btn.remove();
      document.body.classList.remove("wl-layout-edit");
      return;
    }
    if (btn) return;
    btn = document.createElement("button");
    btn.id = "wl-layout-toggle";
    btn.className = "wl-layout-toggle";
    btn.type = "button";
    btn.textContent = "Edit layout";
    btn.addEventListener("click", () => {
      const on = document.body.classList.toggle("wl-layout-edit");
      btn.textContent = on ? "Done editing" : "Edit layout";
    });
    document.body.appendChild(btn);
  }
  function youtubeId(url) {
    if (!url) return null;
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/);
    return m ? m[1] : null;
  }
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
      return `<div class="card-video"><div class="photo wide"></div><span class="play-icon" aria-hidden="true">▶</span></div>`;
    }
    return `<div class="photo wide"></div>`;
  }

  function getAllSorted() {
    const all = WLArticles.getAll();
    return Object.entries(all)
      .map(([id, a]) => ({ id, ...a }))
      .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
  }

  function ledeHtml(a) {
    if (!a) return "";
    const role = a.role ? ` · ${escapeHtml(a.role)}` : "";
    return `
      ${thumbHtml(a)}
      <div class="kicker">${escapeHtml(a.section)}</div>
      <h2><a href="article.html?id=${encodeURIComponent(a.id)}">${escapeHtml(a.title)}</a></h2>
      <div class="byline">By ${window.WL_bylineTagsHtml ? WL_bylineTagsHtml(a) : escapeHtml(a.byline)}${role}</div>
    `;
  }

  function cardHtml(a, withThumb) {
    const media = withThumb ? thumbHtml(a) : "";
    return `
      <article class="story">
        ${media}
        <div class="kicker">${escapeHtml(a.section)}</div>
        <h3><a href="article.html?id=${encodeURIComponent(a.id)}">${escapeHtml(a.title)}</a></h3>
      </article>
    `;
  }

  function fillSlot(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  // Populate the breaking-news banner + popup from the latest Breaking
  // article. If none exist, hide both entirely.
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

  // Populate the homepage video module with the most recent interview.
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
    const thumbHtml = (info && info.type === "youtube")
      ? `<img src="https://img.youtube.com/vi/${info.id}/hqdefault.jpg" alt="${escapeHtml(featured.title)}" loading="lazy">`
      : `<div class="video-placeholder"></div>`;
    featEl.href = `video.html?id=${encodeURIComponent(featured.id)}`;
    featEl.innerHTML = `
      <div class="home-video-thumb">
        ${thumbHtml}
        <span class="video-play" aria-hidden="true">▶</span>
        ${featured.duration ? `<span class="video-duration">${escapeHtml(featured.duration)}</span>` : ""}
      </div>
      <div class="home-video-text">
        <div class="kicker">Interview</div>
        <h3>${escapeHtml(featured.title)}</h3>
        ${featured.description ? `<p>${escapeHtml(featured.description)}</p>` : ""}
        <div class="byline">By ${window.WL_bylineTagsHtml ? WL_bylineTagsHtml(featured) : escapeHtml(featured.byline)} · ${escapeHtml(featured.date)}</div>
      </div>
    `;
  }

  function render() {
    layoutHomepage();  // place block skeletons into their zones first
    const sorted = getAllSorted();
    renderBreaking(sorted);
    renderVideoModule();
    // Tell ads-store to populate any newly-placed .sidebar-ads containers
    document.dispatchEvent(new CustomEvent("wl-ads-change"));

    // Pick one article per section — the editor's "Feature" pick, or the
    // newest article in that section as a fallback. The lede is the biggest
    // story on the page; the other five slots fill the middle column and right
    // sidebar. The slot→section mapping lives in the sections store so renaming
    // a section keeps its home-page slot.
    function pick(section) {
      if (!section) return null;
      return WLArticles.getFeatured(section) || WLArticles.bySection(section)[0] || null;
    }
    const slots = (window.WLSections && WLSections.homeSlots)
      ? WLSections.homeSlots()
      : { lede: "News", middle1: "Breaking", middle2: "Features", middle3: "Op-Ed", right1: "Style", right2: "Sports" };
    const lede    = pick(slots.lede);
    const middle1 = pick(slots.middle1);
    const middle2 = pick(slots.middle2);
    const middle3 = pick(slots.middle3);
    const right1  = pick(slots.right1);
    const right2  = pick(slots.right2);

    fillSlot("home-lede", lede ? ledeHtml(lede) : "");

    const middle = [middle1, middle2, middle3].filter(Boolean);
    fillSlot("home-middle", middle.map((a, i) => cardHtml(a, i === 0)).join(""));

    fillSlot("home-right-1", right1 ? cardHtml(right1, false) : "");
    fillSlot("home-right-2", right2 ? cardHtml(right2, false) : "");

    // "More from the newsroom" — latest stories that aren't already surfaced
    // above (keeps the bottom of the page from repeating featured picks).
    const featuredIds = new Set([lede, middle1, middle2, middle3, right1, right2]
      .filter(Boolean).map(a => a.id));
    const more = sorted.filter(a => !featuredIds.has(a.id));
    fillSlot("home-more-1", more.slice(0, 2).map(a => cardHtml(a, false)).join(""));
    fillSlot("home-more-2", more.slice(2, 4).map(a => cardHtml(a, false)).join(""));
  }

  document.addEventListener("DOMContentLoaded", render);
  document.addEventListener("wl-articles-change", render);
  document.addEventListener("wl-videos-change", renderVideoModule);
  document.addEventListener("wl-layout-change", render);
  document.addEventListener("wl-auth-change", setupLayoutToggle);
  document.addEventListener("DOMContentLoaded", setupLayoutToggle);
})();
