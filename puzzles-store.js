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

  function readPools() {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY) || "{}");
      return {
        bee:         Array.isArray(stored.bee)         && stored.bee.length         ? stored.bee         : DEFAULT_BEE.slice(),
        crossword:   Array.isArray(stored.crossword)   && stored.crossword.length   ? stored.crossword   : DEFAULT_CROSSWORD.slice(),
        connections: Array.isArray(stored.connections) && stored.connections.length ? stored.connections : DEFAULT_CONNECTIONS.slice()
      };
    } catch {
      return {
        bee: DEFAULT_BEE.slice(),
        crossword: DEFAULT_CROSSWORD.slice(),
        connections: DEFAULT_CONNECTIONS.slice()
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

  // ===== Public API =====
  return {
    // Read pools
    getBeePool()         { return readPools().bee; },
    getCrosswordPool()   { return readPools().crossword; },
    getConnectionsPool() { return readPools().connections; },

    // Today's pick
    todayBee()         { return pickToday(readPools().bee); },
    todayCrossword()   { return pickToday(readPools().crossword); },
    todayConnections() { return pickToday(readPools().connections); },

    // Index of today's pick within each pool (for UI labeling)
    todayBeeIndex()         { const p = readPools().bee;         return p.length ? dayIndex() % p.length : -1; },
    todayCrosswordIndex()   { const p = readPools().crossword;   return p.length ? dayIndex() % p.length : -1; },
    todayConnectionsIndex() { const p = readPools().connections; return p.length ? dayIndex() % p.length : -1; },

    // CRUD — Spelling Bee
    addBee(entry)       { const p = readPools(); p.bee.push(entry);  writePools(p); },
    setBeeAt(i, entry)  { const p = readPools(); p.bee[i] = entry;   writePools(p); },
    removeBeeAt(i)      { const p = readPools(); p.bee.splice(i, 1); writePools(p); },

    // CRUD — Crossword
    addCrossword(entry)       { const p = readPools(); p.crossword.push(entry);  writePools(p); },
    setCrosswordAt(i, entry)  { const p = readPools(); p.crossword[i] = entry;   writePools(p); },
    removeCrosswordAt(i)      { const p = readPools(); p.crossword.splice(i, 1); writePools(p); },

    // CRUD — Connections
    addConnections(entry)       { const p = readPools(); p.connections.push(entry);  writePools(p); },
    setConnectionsAt(i, entry)  { const p = readPools(); p.connections[i] = entry;   writePools(p); },
    removeConnectionsAt(i)      { const p = readPools(); p.connections.splice(i, 1); writePools(p); },

    // Reset everything to defaults
    reset() { localStorage.removeItem(KEY); document.dispatchEvent(new CustomEvent("wl-puzzles-change")); },

    DEFAULTS: { bee: DEFAULT_BEE, crossword: DEFAULT_CROSSWORD, connections: DEFAULT_CONNECTIONS }
  };
})();
