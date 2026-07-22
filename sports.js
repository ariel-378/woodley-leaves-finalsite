// Populates the sports homepage: teams grid (with records) and the
// This Week schedule (all upcoming games across every team in the next 7 days).
(function () {
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function recordString(r) {
    const parts = [`${r.w}`, `${r.l}`];
    if (r.t) parts.push(`${r.t}`);
    return parts.join("-");
  }

  // ===== Teams grid =====
  function renderTeams() {
    const grid = document.getElementById("teams-grid");
    if (!grid) return;
    const teams = (window.WLTeams ? WLTeams.getAllTeams() : (window.WL_TEAMS || {}));
    grid.innerHTML = "";
    Object.entries(teams).forEach(([slug, t]) => {
      const card = document.createElement("a");
      card.className = "team-card";
      card.href = `team.html?team=${encodeURIComponent(slug)}`;
      const winPct = (t.record.w + t.record.l + t.record.t) > 0
        ? Math.round(100 * t.record.w / (t.record.w + t.record.l + t.record.t))
        : 0;
      card.innerHTML = `
        <div class="team-sport">${escapeHtml(t.sport)}</div>
        <h4>${escapeHtml(t.name)}</h4>
        <div class="team-record">
          <span class="record-big">${recordString(t.record)}</span>
          <span class="record-pct">${winPct}%</span>
        </div>
        <div class="team-record-label">W–L${t.record.t ? "–T" : ""}</div>
      `;
      grid.appendChild(card);
    });
  }

  // ===== Game of the Week =====
  function renderGameOfWeek() {
    const section = document.getElementById("game-of-week");
    if (!section || !window.WLTeams) return;
    const g = WLTeams.getFeaturedGame();
    if (!g) { section.hidden = true; section.innerHTML = ""; return; }
    section.hidden = false;

    const vs = g.home ? "vs." : "at";
    const dateObj = new Date(g.date);
    const dateStr = isNaN(dateObj.getTime())
      ? g.date
      : dateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const timeStr = g.time ? ` · ${escapeHtml(g.time)}` : "";
    const loc = g.home ? "Home" : "Away";
    const theme = g.theme ? `<div class="gotw-theme">👕 ${escapeHtml(g.theme)}</div>` : "";
    const note = g.note ? `<div class="gotw-note">${escapeHtml(g.note)}</div>` : "";
    const label = g.manual ? "Game of the Week" : "Up Next";

    section.innerHTML = `
      <div class="gotw-tag">${label}</div>
      <div class="gotw-body">
        <div class="gotw-text">
          <div class="gotw-kicker">${escapeHtml(g.sport)}</div>
          <h2 class="gotw-title">${escapeHtml(g.teamName)} <span class="gotw-vs">${vs}</span> ${escapeHtml(g.opponent)}</h2>
          <div class="gotw-meta">${escapeHtml(dateStr)}${timeStr} · ${loc}</div>
          ${note}
          ${theme}
          <a class="gotw-link" href="team.html?team=${encodeURIComponent(g.teamSlug)}">Team details →</a>
        </div>
      </div>
    `;
  }

  function blockOn(key) { return window.WLTeams ? WLTeams.blockEnabled(key) : true; }

  // Show/hide each stats block individually. We toggle the movable
  // [data-move-key] elements themselves — not their .wl-row wrappers, which
  // layout-editor.js rebuilds and would wipe an inline style from.
  function applyStatsVisibility() {
    const map = { "game-of-week": "games", "teams": "teams" };
    Object.entries(map).forEach(([key, block]) => {
      const el = document.querySelector(`[data-move-key="${key}"]`);
      if (el) el.style.display = blockOn(block) ? "" : "none";
    });
    // The "View playoff brackets" link follows the brackets block.
    const link = document.querySelector(".sports-more-link");
    if (link) link.style.display = blockOn("brackets") ? "" : "none";
  }

  function renderAll() {
    renderGameOfWeek();
    renderTeams();
    applyStatsVisibility();
  }
  document.addEventListener("DOMContentLoaded", renderAll);
  document.addEventListener("wl-teams-change", renderAll);
})();
