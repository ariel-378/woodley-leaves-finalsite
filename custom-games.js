// ============================================================================
// Custom Games — renders extra games on the Centerspread. Two ways in:
//
//  1. EDITORS (no code access): add a game from the dashboard → Games tab.
//     It is stored by games-store.js and rendered here inside a sandboxed
//     <iframe>, so pasted HTML/CSS/JS runs safely and can't touch the site.
//
//  2. DEVELOPERS: register a game in code with WLGames.register({ id, title,
//     render(container) }). See the template at the bottom of this file.
//
// Both render into <div id="cs-custom-games"> on centerspread.html.
// ============================================================================
(function () {
  "use strict";
  const registered = [];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function header(g) {
    const h = document.createElement("header");
    h.className = "section-hero";
    h.innerHTML =
      (g.kicker ? '<div class="kicker">' + esc(g.kicker) + "</div>" : "") +
      "<h2>" + esc(g.title || g.id) + "</h2>" +
      (g.description ? '<p class="section-hero-deck">' + esc(g.description) + "</p>" : "");
    return h;
  }

  // Editor-added game: pasted code runs in a sandboxed iframe (scripts allowed,
  // but no same-origin access — it cannot reach the page, cookies, or storage).
  function buildStoreGame(g) {
    const section = document.createElement("section");
    section.className = "cs-custom-game";
    section.id = "game-" + g.id;
    section.appendChild(header(g));

    const frame = document.createElement("iframe");
    frame.className = "cs-custom-game-frame";
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("title", g.title || "Game");
    frame.setAttribute("loading", "lazy");
    frame.style.width = "100%";
    frame.style.height = (parseInt(g.height, 10) || 500) + "px";
    frame.style.border = "0";
    frame.srcdoc = g.code || "";
    section.appendChild(frame);
    return section;
  }

  // Developer-registered game: render() populates a plain container.
  function buildDevGame(g) {
    const section = document.createElement("section");
    section.className = "cs-custom-game";
    section.id = "game-" + g.id;
    section.appendChild(header(g));
    const body = document.createElement("div");
    body.className = "cs-custom-game-body";
    section.appendChild(body);
    try {
      g.render(body);
    } catch (e) {
      body.innerHTML = '<p style="color:#b8002a;">This game could not be loaded.</p>';
      console.error("WLGames: '" + g.id + "' failed to render", e);
    }
    return section;
  }

  function mountAll() {
    const host = document.getElementById("cs-custom-games");
    if (!host) return;
    host.innerHTML = "";
    let stored = window.WLGamesStore ? WLGamesStore.getAll() : [];
    // A game dated forward is finished but not yet published.
    if (window.WLSchedule) stored = stored.filter(WLSchedule.isLive);
    stored.forEach(g => host.appendChild(buildStoreGame(g)));
    registered.forEach(g => host.appendChild(buildDevGame(g)));
  }

  window.WLGames = {
    register(game) {
      if (!game || !game.id || typeof game.render !== "function") {
        console.warn("WLGames.register expects { id, title, render(container) }");
        return;
      }
      if (registered.some(g => g.id === game.id)) {
        console.warn("WLGames: duplicate game id '" + game.id + "' ignored");
        return;
      }
      registered.push(game);
    },
    getAll() { return registered.slice(); },
    refresh() { mountAll(); }
  };

  // A game can report its own height, the same way custom features do. A
  // sandboxed frame has no same-origin access so it cannot be measured from
  // out here, and a game whose content changes — a story that moves between
  // passages — cannot be served by one fixed number.
  window.addEventListener("message", function (e) {
    const h = e.data && e.data.wlGameHeight;
    if (!h) return;
    document.querySelectorAll("iframe.cs-custom-game-frame").forEach(function (f) {
      if (f.contentWindow === e.source) f.style.height = Math.ceil(h) + "px";
    });
  });

  document.addEventListener("wl-games-change", mountAll);

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }
  ready(mountAll);
})();

// ============================================================================
// ▼▼▼  DEVELOPERS: ADD CODE-DEFINED GAMES BELOW  ▼▼▼
// (Editors don't need this — they use the dashboard → Games tab.)
//
// WLGames.register({
//   id: "memory-match",
//   kicker: "Centerspread · Games",
//   title: "Memory Match",
//   description: "Flip the cards two at a time to find every matching pair.",
//   render(container) {
//     container.innerHTML = `<button type="button" id="mm-start">Start</button>`;
//     container.querySelector("#mm-start").addEventListener("click", () => {
//       // game logic...
//     });
//   }
// });
// ▲▲▲  ADD CODE-DEFINED GAMES ABOVE  ▲▲▲
// ============================================================================
