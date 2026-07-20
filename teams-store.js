// Merges default teams/brackets (from teams.js) with editor changes stored in
// localStorage. Same pattern as articles-store.js and puzzles-store.js.
window.WLTeams = (function () {
  const LS_TEAMS_CUSTOM    = "wl_teams_custom";
  const LS_TEAMS_DELETED   = "wl_teams_deleted";
  const LS_BRACKETS_CUSTOM = "wl_brackets_custom";
  const LS_BRACKETS_DELETED= "wl_brackets_deleted";

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }
  function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function fire() { document.dispatchEvent(new CustomEvent("wl-teams-change")); }

  // Sitewide on/off toggle for the sports-stats feature (Game of the Week,
  // team records, and playoff brackets). On by default.
  const LS_STATS_ENABLED = "wl_sports_enabled";
  function statsEnabled() {
    const v = localStorage.getItem(LS_STATS_ENABLED);
    return v === null ? true : v === "true";
  }
  function setStatsEnabled(on) {
    localStorage.setItem(LS_STATS_ENABLED, on ? "true" : "false");
    fire();
  }

  // ===== Teams =====
  function getAllTeams() {
    const base = window.WL_TEAMS || {};
    const custom = read(LS_TEAMS_CUSTOM, {});
    const deleted = read(LS_TEAMS_DELETED, []);
    const merged = {};
    Object.keys(base).forEach(slug => {
      if (!deleted.includes(slug)) merged[slug] = base[slug];
    });
    Object.keys(custom).forEach(slug => { merged[slug] = custom[slug]; });
    return merged;
  }
  function getTeam(slug) { return getAllTeams()[slug]; }
  function saveTeam(slug, data) {
    const custom = read(LS_TEAMS_CUSTOM, {});
    custom[slug] = data;
    write(LS_TEAMS_CUSTOM, custom);
    // un-delete if previously soft-deleted
    const deleted = read(LS_TEAMS_DELETED, []).filter(x => x !== slug);
    write(LS_TEAMS_DELETED, deleted);
    fire();
  }
  function removeTeam(slug) {
    const custom = read(LS_TEAMS_CUSTOM, {});
    if (custom[slug]) { delete custom[slug]; write(LS_TEAMS_CUSTOM, custom); }
    const base = window.WL_TEAMS || {};
    if (base[slug]) {
      const deleted = read(LS_TEAMS_DELETED, []);
      if (!deleted.includes(slug)) { deleted.push(slug); write(LS_TEAMS_DELETED, deleted); }
    }
    fire();
  }
  function isCustomTeam(slug) {
    const custom = read(LS_TEAMS_CUSTOM, {});
    return slug in custom;
  }

  // ===== Brackets =====
  function getAllBrackets() {
    const base = window.WL_BRACKETS || {};
    const custom = read(LS_BRACKETS_CUSTOM, {});
    const deleted = read(LS_BRACKETS_DELETED, []);
    const merged = {};
    Object.keys(base).forEach(slug => {
      if (!deleted.includes(slug)) merged[slug] = base[slug];
    });
    Object.keys(custom).forEach(slug => { merged[slug] = custom[slug]; });
    return merged;
  }
  function getBracket(slug) { return getAllBrackets()[slug]; }
  function saveBracket(slug, data) {
    const custom = read(LS_BRACKETS_CUSTOM, {});
    custom[slug] = data;
    write(LS_BRACKETS_CUSTOM, custom);
    const deleted = read(LS_BRACKETS_DELETED, []).filter(x => x !== slug);
    write(LS_BRACKETS_DELETED, deleted);
    fire();
  }
  function removeBracket(slug) {
    const custom = read(LS_BRACKETS_CUSTOM, {});
    if (custom[slug]) { delete custom[slug]; write(LS_BRACKETS_CUSTOM, custom); }
    const base = window.WL_BRACKETS || {};
    if (base[slug]) {
      const deleted = read(LS_BRACKETS_DELETED, []);
      if (!deleted.includes(slug)) { deleted.push(slug); write(LS_BRACKETS_DELETED, deleted); }
    }
    fire();
  }
  function isCustomBracket(slug) {
    const custom = read(LS_BRACKETS_CUSTOM, {});
    return slug in custom;
  }

  function reset() {
    [LS_TEAMS_CUSTOM, LS_TEAMS_DELETED, LS_BRACKETS_CUSTOM, LS_BRACKETS_DELETED, LS_FEATURED_GAME].forEach(k => localStorage.removeItem(k));
    fire();
  }

  // ===== Game of the Week =====
  const LS_FEATURED_GAME = "wl_featured_game";  // stores { teamSlug, date, opponent }

  function getFeaturedGameRef() {
    try { return JSON.parse(localStorage.getItem(LS_FEATURED_GAME) || "null"); }
    catch { return null; }
  }
  function setFeaturedGame(teamSlug, date, opponent) {
    localStorage.setItem(LS_FEATURED_GAME, JSON.stringify({ teamSlug, date, opponent }));
    fire();
  }
  function clearFeaturedGame() { localStorage.removeItem(LS_FEATURED_GAME); fire(); }

  // Resolves the editor-featured game (if still valid) OR falls back to the next
  // upcoming game across every team.
  function getFeaturedGame() {
    const ref = getFeaturedGameRef();
    if (ref) {
      const team = getTeam(ref.teamSlug);
      if (team) {
        const game = (team.upcoming || []).find(g => g.date === ref.date && g.opponent === ref.opponent);
        if (game) return { teamSlug: ref.teamSlug, teamName: team.name, sport: team.sport, manual: true, ...game };
      }
    }
    // Auto-pick: earliest upcoming game across all teams
    const teams = getAllTeams();
    let best = null;
    Object.entries(teams).forEach(([slug, t]) => {
      (t.upcoming || []).forEach(g => {
        const gd = new Date(g.date);
        if (isNaN(gd.getTime())) return;
        if (gd < new Date()) return;
        if (!best || gd < best._date) {
          best = { teamSlug: slug, teamName: t.name, sport: t.sport, manual: false, _date: gd, ...g };
        }
      });
    });
    if (best) { delete best._date; return best; }
    return null;
  }

  return {
    getAllTeams, getTeam, saveTeam, removeTeam, isCustomTeam,
    getAllBrackets, getBracket, saveBracket, removeBracket, isCustomBracket,
    reset,
    getFeaturedGame, getFeaturedGameRef, setFeaturedGame, clearFeaturedGame,
    statsEnabled, setStatsEnabled
  };
})();
