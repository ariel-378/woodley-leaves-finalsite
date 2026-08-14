// Homepage layout configuration. Editors drag/select where each "block" goes:
// right-sidebar story cards, Video module, and "More from the
// newsroom" section. The homepage reads this config and places blocks into
// the right zones.
window.WLLayout = (function () {
  const LS = "wl_home_layout";
  const ZONES = ["right-sidebar", "below-main", "hidden"];

  const ZONE_LABELS = {
    "right-sidebar": "Right sidebar (inside the main grid's aside)",
    "below-main":    "Below the main content (full width)",
    "hidden":        "Hidden (not shown)"
  };

  const BLOCKS = {
    "ad-1":           { label: "Ad #1 (first in pool)" },
    "ad-2":           { label: "Ad #2" },
    "ad-3":           { label: "Ad #3" },
    "ad-4":           { label: "Ad #4" },
    "story-right-1":  { label: "Sidebar Story #1 (auto-filled)" },
    "story-right-2":  { label: "Sidebar Story #2 (auto-filled)" },
    "video-module":   { label: "Video Module (interview + reels)" },
    "more-section":   { label: "'More from the newsroom' section" }
  };

  const DEFAULT = {
    "right-sidebar": ["ad-1", "story-right-1", "story-right-2", "ad-2"],
    "below-main":    ["video-module", "more-section"],
    "hidden":        ["ad-3", "ad-4"]
  };

  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

  function getLayout() {
    let stored;
    try { stored = JSON.parse(localStorage.getItem(LS) || "null"); }
    catch { stored = null; }
    if (!stored) return clone(DEFAULT);
    // Ensure all zones present
    ZONES.forEach(z => { if (!Array.isArray(stored[z])) stored[z] = []; });
    // Any new blocks added since saved config go into hidden
    const placed = new Set(ZONES.flatMap(z => stored[z]));
    Object.keys(BLOCKS).forEach(b => {
      if (!placed.has(b)) stored.hidden.push(b);
    });
    // Strip any invalid block keys (removed since saved config)
    ZONES.forEach(z => { stored[z] = stored[z].filter(b => BLOCKS[b]); });
    return stored;
  }

  function setLayout(layout) {
    localStorage.setItem(LS, JSON.stringify(layout));
    document.dispatchEvent(new CustomEvent("wl-layout-change"));
  }

  function moveBlock(block, zone, position) {
    const l = getLayout();
    ZONES.forEach(z => { l[z] = l[z].filter(b => b !== block); });
    if (!l[zone]) l[zone] = [];
    const pos = typeof position === "number"
      ? Math.max(0, Math.min(position, l[zone].length))
      : l[zone].length;
    l[zone].splice(pos, 0, block);
    setLayout(l);
  }

  function shiftBlock(block, delta) {
    const l = getLayout();
    for (const z of ZONES) {
      const idx = l[z].indexOf(block);
      if (idx === -1) continue;
      const newIdx = idx + delta;
      if (newIdx < 0 || newIdx >= l[z].length) return;  // edge of zone
      l[z].splice(idx, 1);
      l[z].splice(newIdx, 0, block);
      setLayout(l);
      return;
    }
  }

  function reset() {
    localStorage.removeItem(LS);
    document.dispatchEvent(new CustomEvent("wl-layout-change"));
  }

  return { getLayout, setLayout, moveBlock, shiftBlock, reset, ZONES, ZONE_LABELS, BLOCKS, DEFAULT };
})();
