// Merges default ads with editor changes, and renders ad cards into page
// sidebars. Clicking any ad opens a modal with the full poster.
window.WLAds = (function () {
  const LS_CUSTOM = "wl_ads_custom";
  const LS_DELETED = "wl_ads_deleted";
  const LS_ENABLED = "wl_ads_enabled";   // sitewide on/off toggle for the ads feature

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }
  function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function fire() { document.dispatchEvent(new CustomEvent("wl-ads-change")); }

  // Ads are on by default; the editor can turn the whole feature off sitewide.
  function adsEnabled() {
    const v = localStorage.getItem(LS_ENABLED);
    return v === null ? true : v === "true";
  }
  function setAdsEnabled(on) {
    localStorage.setItem(LS_ENABLED, on ? "true" : "false");
    fire();   // re-render every placeholder (show them or clear them)
  }

  function getAll() {
    const base = window.WL_ADS || {};
    const custom = read(LS_CUSTOM, {});
    const deleted = read(LS_DELETED, []);
    const merged = {};
    Object.keys(base).forEach(id => {
      if (!deleted.includes(id)) merged[id] = base[id];
    });
    Object.keys(custom).forEach(id => { merged[id] = custom[id]; });
    return merged;
  }

  function list() {
    const all = getAll();
    return Object.entries(all).map(([id, a]) => ({ id, ...a }));
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
    const base = window.WL_ADS || {};
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

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // Return true if a given #rrggbb colour is dark enough that white text reads
  // better than black on it. Uses perceived luminance (ITU BT.709).
  function isDarkColor(hex) {
    if (!hex || typeof hex !== "string") return false;
    const m = hex.trim().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
    if (!m) return false;
    let c = m[1];
    if (c.length === 3) c = c.split("").map(ch => ch + ch).join("");
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 140;
  }

  // ===== Modal =====
  let modalOverlay = null;
  let lastFocused = null;

  function ensureModal() {
    if (modalOverlay) return;
    modalOverlay = document.createElement("div");
    modalOverlay.className = "ad-modal-overlay";
    modalOverlay.setAttribute("role", "dialog");
    modalOverlay.setAttribute("aria-modal", "true");
    modalOverlay.setAttribute("aria-labelledby", "ad-modal-title");
    modalOverlay.innerHTML = `
      <div class="ad-modal" role="document">
        <button class="ad-modal-close" id="ad-modal-close" aria-label="Close">×</button>
        <div id="ad-modal-body"></div>
      </div>
    `;
    document.body.appendChild(modalOverlay);
    modalOverlay.addEventListener("click", (e) => { if (e.target === modalOverlay) closeModal(); });
    modalOverlay.querySelector("#ad-modal-close").addEventListener("click", closeModal);
    modalOverlay.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  }

  function openModal(id) {
    const ad = getById(id);
    if (!ad) return;
    ensureModal();
    lastFocused = document.activeElement;
    const body = modalOverlay.querySelector("#ad-modal-body");
    const posterHtml = ad.posterUrl
      ? `<div class="ad-modal-poster"><img src="${escapeHtml(ad.posterUrl)}" alt="${escapeHtml(ad.title)} poster"></div>`
      : "";
    const linkHtml = ad.link
      ? `<a class="ad-modal-link" href="${escapeHtml(ad.link)}" target="_blank" rel="noopener">Open link →</a>`
      : "";
    body.innerHTML = `
      <div class="ad-modal-label">${escapeHtml(ad.kind || "Notice")}</div>
      <h2 id="ad-modal-title">${escapeHtml(ad.title)}</h2>
      ${ad.shortText ? `<div class="ad-modal-when">${escapeHtml(ad.shortText)}</div>` : ""}
      ${posterHtml}
      ${ad.details ? `<p class="ad-modal-details">${escapeHtml(ad.details)}</p>` : ""}
      ${linkHtml}
    `;
    modalOverlay.classList.add("visible");
    setTimeout(() => modalOverlay.querySelector("#ad-modal-close").focus(), 10);
  }

  function closeModal() {
    if (!modalOverlay) return;
    modalOverlay.classList.remove("visible");
    if (lastFocused && lastFocused.focus) lastFocused.focus();
    lastFocused = null;
  }

  // ===== Card rendering =====
  // Renders N ads into the given container. Ads with `hasPoster` get a small
  // thumbnail tile in the corner of the card.
  function renderInto(container, options) {
    if (!container) return;
    options = options || {};
    const limit = typeof options.limit === "number" ? options.limit : 2;
    const offset = options.offset || 0;
    const ads = list().slice(offset, offset + limit);
    container.innerHTML = "";
    ads.forEach(ad => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "ad ad-button";
      card.setAttribute("aria-label", `${ad.kind || "Ad"}: ${ad.title}. Click to expand.`);
      card.dataset.adId = ad.id;
      // Apply the editor-picked background if there is one, and flip the
      // text colour to white when the chosen colour is dark.
      if (ad.background) {
        card.style.background = ad.background;
        if (isDarkColor(ad.background)) card.classList.add("ad-dark");
      }
      const thumbHtml = ad.posterUrl
        ? `<div class="ad-thumb" style="background-image:url(${JSON.stringify(ad.posterUrl)});"></div>`
        : "";
      card.innerHTML = `
        ${thumbHtml}
        <div class="ad-text">
          <div class="ad-label">${escapeHtml(ad.kind || "Notice")}</div>
          <h4>${escapeHtml(ad.title)}</h4>
          <p>${escapeHtml(ad.shortText || "")}</p>
          <span class="ad-expand-hint">Tap to expand →</span>
        </div>
      `;
      card.addEventListener("click", () => openModal(ad.id));
      container.appendChild(card);
    });
  }

  // Fill every .sidebar-ads placeholder on the page. Placeholders can set
  // `data-ads-offset` and `data-ads-limit` to pick a slice of the ad pool.
  function renderAllPlaceholders() {
    const on = adsEnabled();
    document.querySelectorAll(".sidebar-ads").forEach(el => {
      if (!on) { el.innerHTML = ""; el.style.display = "none"; return; }
      el.style.display = "";
      const offset = +(el.dataset.adsOffset || 0);
      const limit = +(el.dataset.adsLimit || 2);
      renderInto(el, { offset, limit });
    });
    // Also attach click handlers to any static .ad elements that carry data-ad-id
    document.querySelectorAll(".ad[data-ad-id]").forEach(el => {
      if (el.dataset.adsWired) return;
      el.dataset.adsWired = "1";
      el.addEventListener("click", () => openModal(el.dataset.adId));
    });
  }

  document.addEventListener("DOMContentLoaded", renderAllPlaceholders);
  document.addEventListener("wl-ads-change", renderAllPlaceholders);

  return { getAll, list, getById, save, remove, isCustom, reset, openModal, closeModal, renderInto, adsEnabled, setAdsEnabled };
})();
