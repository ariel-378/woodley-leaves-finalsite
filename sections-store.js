// Editor-managed list of the paper's sections. Seeded with the original
// sections; edits live in localStorage. Same store pattern as articles-store.js.
//
//   name   — display name AND the value stored on each article's `section`.
//   page   — where the section's nav link points.
//   nav    — false for grouping-only sections that never appear in reader nav
//            (Breaking drives the home-page banner, not a nav tab).
//   locked — structural sections that can't be renamed or removed.
//
// Renaming a section reassigns every article in it. Removing is blocked while a
// section still has articles, so nothing is orphaned.
window.WLSections = (function () {
  const LS = "wl_sections";

  // Order matters: this is the reader-nav order.
  const DEFAULTS = [
    { name: "Breaking", page: "index.html",    nav: false, locked: true  },
    { name: "News",     page: "news.html",     nav: true,  locked: false },
    { name: "Features", page: "features.html", nav: true,  locked: false },
    { name: "Op-Ed",    page: "opinion.html",  nav: true,  locked: false },
    { name: "Style",    page: "style.html",    nav: true,  locked: false },
    { name: "Sports",   page: "sports.html",   nav: true,  locked: false },
  ];

  // The home page has six fixed slots, each showing one section's featured
  // story. The mapping is stored so renaming a section carries its slot along.
  const LS_SLOTS = "wl_home_slots";
  const DEFAULT_SLOTS = {
    lede: "News", middle1: "Breaking", middle2: "Features",
    middle3: "Op-Ed", right1: "Style", right2: "Sports",
  };

  function read() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS) || "null");
      if (Array.isArray(raw) && raw.length) return raw;
    } catch { /* fall through to defaults */ }
    return DEFAULTS.map(s => ({ ...s }));
  }

  function readSlots() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_SLOTS) || "null");
      if (raw && typeof raw === "object") return { ...DEFAULT_SLOTS, ...raw };
    } catch { /* fall through to defaults */ }
    return { ...DEFAULT_SLOTS };
  }
  function writeSlots(slots) { localStorage.setItem(LS_SLOTS, JSON.stringify(slots)); }

  function homeSlots() { return readSlots(); }

  // Assign a section (or "" for none) to one of the fixed home-page slots.
  function setHomeSlot(key, name) {
    if (!(key in DEFAULT_SLOTS)) throw new Error("Unknown home slot.");
    name = (name || "").trim();
    if (name && !find(name)) throw new Error("That section doesn’t exist.");
    const slots = readSlots();
    slots[key] = name;
    writeSlots(slots);
    document.dispatchEvent(new CustomEvent("wl-sections-change"));
  }

  function write(listValue) {
    localStorage.setItem(LS, JSON.stringify(listValue));
    document.dispatchEvent(new CustomEvent("wl-sections-change"));
  }

  // New and renamed sections route through the generic reader page, since the
  // original static pages have their section hard-coded in data-section.
  function genericPage(name) { return "section.html?name=" + encodeURIComponent(name); }

  function list() { return read(); }
  function names() { return read().map(s => s.name); }
  function navSections() { return read().filter(s => s.nav); }
  function find(name) { return read().find(s => s.name === name) || null; }
  function pageFor(name) { const s = find(name); return s ? s.page : "index.html"; }

  function articleCount(name) {
    return window.WLArticles ? WLArticles.bySection(name).length : 0;
  }

  function add(name) {
    name = (name || "").trim();
    if (!name) throw new Error("Enter a section name.");
    if (find(name)) throw new Error("A section named “" + name + "” already exists.");
    const l = read();
    l.push({ name, page: genericPage(name), nav: true, locked: false });
    write(l);
  }

  function rename(oldName, newName) {
    newName = (newName || "").trim();
    if (!newName) throw new Error("Enter a section name.");
    const l = read();
    const s = l.find(x => x.name === oldName);
    if (!s) throw new Error("That section no longer exists.");
    if (s.locked) throw new Error("The " + oldName + " section can’t be renamed.");
    if (newName === oldName) return;
    if (l.some(x => x.name === newName)) throw new Error("A section named “" + newName + "” already exists.");

    const newPage = genericPage(newName);
    // Reassign every article filed under the old name.
    if (window.WLArticles) {
      const all = WLArticles.getAll();
      Object.entries(all).forEach(([id, a]) => {
        if (a.section === oldName) {
          WLArticles.save(id, { ...a, section: newName, sectionPage: newPage });
        }
      });
    }
    // Carry any home-page slot assignment along with the rename.
    const slots = readSlots();
    let slotsChanged = false;
    Object.keys(slots).forEach(k => {
      if (slots[k] === oldName) { slots[k] = newName; slotsChanged = true; }
    });
    if (slotsChanged) writeSlots(slots);

    s.name = newName;
    s.page = newPage;
    write(l);
  }

  function remove(name) {
    const l = read();
    const s = l.find(x => x.name === name);
    if (!s) return;
    if (s.locked) throw new Error("The " + name + " section can’t be removed.");
    const count = articleCount(name);
    if (count > 0) {
      throw new Error("Move or delete this section’s " + count + " article" + (count === 1 ? "" : "s") + " before removing it.");
    }
    // Clear any home-page slot that pointed at the removed section.
    const slots = readSlots();
    let slotsChanged = false;
    Object.keys(slots).forEach(k => {
      if (slots[k] === name) { slots[k] = ""; slotsChanged = true; }
    });
    if (slotsChanged) writeSlots(slots);
    write(l.filter(x => x.name !== name));
  }

  // dir: -1 moves up, +1 moves down.
  function move(name, dir) {
    const l = read();
    const i = l.findIndex(x => x.name === name);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
    write(l);
  }

  function reset() {
    localStorage.removeItem(LS);
    localStorage.removeItem(LS_SLOTS);
    document.dispatchEvent(new CustomEvent("wl-sections-change"));
  }

  return {
    list, names, navSections, find, pageFor, articleCount,
    add, rename, remove, move, reset,
    homeSlots, setHomeSlot,
  };
})();
