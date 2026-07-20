// Stores pools of puzzles (Spelling Bee / Crossword / Connections) in
// localStorage. Each day, a deterministic daily index picks one puzzle from
// each pool, so every visitor sees the same puzzle on the same day.
window.WLPuzzles = (function () {
  const KEY = "wl_puzzles_pools";

  // ===== Defaults — seed the pools with the original puzzles =====
  const DEFAULT_BEE = [{
    center: "T",
    outer: ["A", "E", "R", "L", "I", "N"],
    words: [
      "ANTE","ANTI","LATE","LENT","LITE","NEAT","RANT","RATE","RENT","RITE",
      "TAIL","TALE","TARE","TARN","TEAL","TEAR","TEEN","TENT","TERN","TIER",
      "TILE","TILT","TINE","TINT","TIRE","TREE",
      "ALERT","ALTER","ELATE","ENTER","INERT","INTER","IRATE","LATER","LITER",
      "NATAL","TIARA","TILER","TITAN","TRAIL","TRAIN","TRAIT","TRIAL",
      "ATTAIN","ATTIRE","LATTER","LITTER","NEATER","RATTAN","RATTLE","RELATE",
      "RENTAL","RETAIL","RETAIN","RETINA","TALENT","TATTER",
      "ENTRAIL","LATRINE","LITERAL","RATLINE","RETINAL"
    ]
  }];

  const DEFAULT_CROSSWORD = [{
    rows: ["BASIC","ARENA","SEEDS","INDIE","CASES"],
    across: {
      "1": "Fundamental; no frills",
      "6": "Venue for a big game or concert",
      "7": "What birds peck from a feeder",
      "8": "Low-budget film, informally",
      "9": "Legal matters in court"
    },
    down: {
      "1": "Cable channel tier, or beginner-friendly programming language",
      "2": "The Colosseum, for one",
      "3": "Sesame or poppy grains on a bagel",
      "4": "Describes a small record label or film studio",
      "5": "Boxes of wine or packs of water"
    }
  }];

  // NYT-Connections-style: 16 words split into 4 groups of 4, each with a
  // category label and a difficulty color (yellow easiest → purple hardest).
  const DEFAULT_CONNECTIONS = [{
    groups: [
      { difficulty: "yellow", category: "Woodley Leaves sections", words: ["NEWS", "FEATURES", "STYLE", "SPORTS"] },
      { difficulty: "green",  category: "Parts of a frog",         words: ["LEG", "EYE", "TONGUE", "TOE"] },
      { difficulty: "blue",   category: "Shades of green",         words: ["MOSS", "OLIVE", "EMERALD", "LIME"] },
      { difficulty: "purple", category: "___ leaf",                words: ["MAPLE", "TEA", "GOLD", "BAY"] }
    ]
  }];

  // Word search: a list of words hidden in an auto-generated grid. Each word is
  // shown to the player exactly as typed; only its letters go into the grid.
  const DEFAULT_WORDSEARCH = [{
    words: ["Allergies", "April Fools Day", "Bees", "Cherry Blossoms", "Cleaning",
            "Daylight Savings", "Flowers", "Gardening", "March", "May",
            "Picnic", "Rain", "Spring Break", "Sunshine"]
  }];

  function readPools() {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY) || "{}");
      return {
        bee:         Array.isArray(stored.bee)         && stored.bee.length         ? stored.bee         : DEFAULT_BEE.slice(),
        crossword:   Array.isArray(stored.crossword)   && stored.crossword.length   ? stored.crossword   : DEFAULT_CROSSWORD.slice(),
        connections: Array.isArray(stored.connections) && stored.connections.length ? stored.connections : DEFAULT_CONNECTIONS.slice(),
        wordsearch:  Array.isArray(stored.wordsearch)  && stored.wordsearch.length  ? stored.wordsearch  : DEFAULT_WORDSEARCH.slice()
      };
    } catch {
      return {
        bee: DEFAULT_BEE.slice(),
        crossword: DEFAULT_CROSSWORD.slice(),
        connections: DEFAULT_CONNECTIONS.slice(),
        wordsearch: DEFAULT_WORDSEARCH.slice()
      };
    }
  }

  function writePools(p) {
    localStorage.setItem(KEY, JSON.stringify(p));
    document.dispatchEvent(new CustomEvent("wl-puzzles-change"));
  }

  // Days since Jan 1, 2026. Used as the deterministic daily index.
  function dayIndex() {
    const start = Date.UTC(2026, 0, 1);
    const now = Date.now();
    return Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
  }

  function pickToday(pool) {
    if (!pool || pool.length === 0) return null;
    return pool[dayIndex() % pool.length];
  }

  // An editor can pin a specific puzzle as "today's", overriding the daily
  // rotation. Pins are stored per puzzle type and survive until cleared.
  const ACTIVE_KEY = "wl_puzzles_active";
  function readActive() { try { return JSON.parse(localStorage.getItem(ACTIVE_KEY) || "{}"); } catch { return {}; } }
  function writeActive(a) { localStorage.setItem(ACTIVE_KEY, JSON.stringify(a)); document.dispatchEvent(new CustomEvent("wl-puzzles-change")); }
  function activeIndexFor(type, pool) {
    if (!pool || pool.length === 0) return -1;
    const pinned = readActive()[type];
    if (typeof pinned === "number" && pinned >= 0 && pinned < pool.length) return pinned;
    return dayIndex() % pool.length;
  }
  function pickFor(type, pool) {
    const i = activeIndexFor(type, pool);
    return i < 0 ? null : pool[i];
  }
  function adjustActive(type, removedIndex) {
    const a = readActive();
    if (typeof a[type] !== "number") return;
    if (a[type] === removedIndex) { delete a[type]; writeActive(a); }
    else if (a[type] > removedIndex) { a[type] -= 1; writeActive(a); }
  }

  // ===== Public API =====
  return {
    // Read pools
    getBeePool()         { return readPools().bee; },
    getCrosswordPool()   { return readPools().crossword; },
    getConnectionsPool() { return readPools().connections; },

    // Today's pick (an editor pin overrides the daily rotation)
    todayBee()         { return pickFor("bee", readPools().bee); },
    todayCrossword()   { return pickFor("crossword", readPools().crossword); },
    todayConnections() { return pickFor("connections", readPools().connections); },

    // Index of today's pick within each pool (for UI labeling)
    todayBeeIndex()         { return activeIndexFor("bee", readPools().bee); },
    todayCrosswordIndex()   { return activeIndexFor("crossword", readPools().crossword); },
    todayConnectionsIndex() { return activeIndexFor("connections", readPools().connections); },

    // CRUD — Spelling Bee
    addBee(entry)       { const p = readPools(); p.bee.push(entry);  writePools(p); },
    setBeeAt(i, entry)  { const p = readPools(); p.bee[i] = entry;   writePools(p); },
    removeBeeAt(i)      { const p = readPools(); p.bee.splice(i, 1); writePools(p); adjustActive("bee", i); },

    // CRUD — Crossword
    addCrossword(entry)       { const p = readPools(); p.crossword.push(entry);  writePools(p); },
    setCrosswordAt(i, entry)  { const p = readPools(); p.crossword[i] = entry;   writePools(p); },
    removeCrosswordAt(i)      { const p = readPools(); p.crossword.splice(i, 1); writePools(p); adjustActive("crossword", i); },

    // CRUD — Connections
    addConnections(entry)       { const p = readPools(); p.connections.push(entry);  writePools(p); },
    setConnectionsAt(i, entry)  { const p = readPools(); p.connections[i] = entry;   writePools(p); },
    removeConnectionsAt(i)      { const p = readPools(); p.connections.splice(i, 1); writePools(p); adjustActive("connections", i); },

    // Word Search
    getWordsearchPool()          { return readPools().wordsearch; },
    todayWordsearch()            { return pickFor("wordsearch", readPools().wordsearch); },
    todayWordsearchIndex()       { return activeIndexFor("wordsearch", readPools().wordsearch); },
    addWordsearch(entry)         { const p = readPools(); p.wordsearch.push(entry);  writePools(p); },
    setWordsearchAt(i, entry)    { const p = readPools(); p.wordsearch[i] = entry;   writePools(p); },
    removeWordsearchAt(i)        { const p = readPools(); p.wordsearch.splice(i, 1); writePools(p); adjustActive("wordsearch", i); },

    // Pin / unpin which puzzle is shown (overrides the daily rotation)
    setActive(type, i) { const a = readActive(); a[type] = i; writeActive(a); },
    clearActive(type)  { const a = readActive(); delete a[type]; writeActive(a); },
    getActive(type)    { const a = readActive(); return typeof a[type] === "number" ? a[type] : null; },

    // Reset everything to defaults
    reset() { localStorage.removeItem(KEY); localStorage.removeItem(ACTIVE_KEY); document.dispatchEvent(new CustomEvent("wl-puzzles-change")); },

    DEFAULTS: { bee: DEFAULT_BEE, crossword: DEFAULT_CROSSWORD, connections: DEFAULT_CONNECTIONS }
  };
})();
