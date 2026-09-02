// ============================================================================
//  TAGS — a list the editors keep, not a box anyone can type into.
//
//  Tags used to be free text: whatever was typed into the article editor became
//  a tag. That produces "Sports", "sports" and "sport" as three separate tag
//  pages holding one article each, and nothing anywhere says so. A paper's tags
//  are a small deliberate vocabulary or they are noise.
//
//  So the masthead agrees a list, and articles pick from it. Nothing else can
//  become a tag.
//
//  OFF BY DEFAULT. A paper that does not want tags should not have to remove
//  them; `enabled` is false until somebody turns it on, and with it off no tag
//  appears in the editor or on the site.
//
//  Turning it off HIDES, it does not delete. The list survives, the tags stay
//  on their articles, and switching back on restores exactly what was there —
//  the same rule the rest of this site follows about not destroying work a
//  toggle can't undo.
// ============================================================================
window.WLTags = (function () {
  var LS = "wl_tags";
  var MAX_LEN = 32;

  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(LS) || "null");
      if (v && typeof v === "object") {
        return { enabled: v.enabled === true, list: Array.isArray(v.list) ? v.list : [] };
      }
    } catch (e) { /* corrupt storage must not take the paper down */ }
    return { enabled: false, list: [] };
  }

  function write(state) {
    localStorage.setItem(LS, JSON.stringify(state));
    document.dispatchEvent(new CustomEvent("wl-tags-change"));
  }

  function isEnabled() { return read().enabled; }
  function list() { return read().list.slice(); }

  function setEnabled(on) {
    var s = read();
    s.enabled = !!on;
    write(s);                       // the list is deliberately left alone
    return { ok: true };
  }

  /** Same tag, differently typed. The comparison the free-text box never made. */
  function same(a, b) {
    return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  }

  function has(tag) { return read().list.some(function (t) { return same(t, tag); }); }

  function add(tag) {
    var name = String(tag == null ? "" : tag).trim().slice(0, MAX_LEN);
    if (!name) return { ok: false, error: "Enter a tag name." };
    if (has(name)) return { ok: false, error: "“" + name + "” is already on the list." };
    var s = read();
    s.list.push(name);
    write(s);
    return { ok: true };
  }

  /**
   * Rename, carrying every article with it. A rename that left articles
   * pointing at the old word would quietly break the one promise a fixed list
   * makes — that a tag means one thing.
   */
  function rename(from, to) {
    var name = String(to == null ? "" : to).trim().slice(0, MAX_LEN);
    if (!name) return { ok: false, error: "Enter a tag name." };
    if (!has(from)) return { ok: false, error: "That tag isn't on the list." };
    if (has(name) && !same(from, name)) return { ok: false, error: "“" + name + "” is already on the list." };

    var s = read();
    s.list = s.list.map(function (t) { return same(t, from) ? name : t; });
    write(s);
    retagArticles(from, name);
    return { ok: true };
  }

  /** Remove, and take it off the articles too, so nothing points at a tag that is gone. */
  function remove(tag) {
    var s = read();
    s.list = s.list.filter(function (t) { return !same(t, tag); });
    write(s);
    retagArticles(tag, null);
    return { ok: true };
  }

  function retagArticles(from, to) {
    if (!window.WLArticles || !WLArticles.getAll) return;
    var all = WLArticles.getAll();
    Object.keys(all).forEach(function (id) {
      var a = all[id];
      if (!Array.isArray(a.tags) || !a.tags.some(function (t) { return same(t, from); })) return;
      var next = to
        ? a.tags.map(function (t) { return same(t, from) ? to : t; })
        : a.tags.filter(function (t) { return !same(t, from); });
      var copy = {};
      Object.keys(a).forEach(function (k) { if (k !== "id") copy[k] = a[k]; });
      if (next.length) copy.tags = next; else delete copy.tags;
      WLArticles.save(id, copy);
    });
  }

  /**
   * Keep only what is on the list, in the list's own spelling. Anything else —
   * an off-list tag, a stale one, a different capitalisation — is dropped.
   */
  function clean(tags) {
    if (!Array.isArray(tags)) return [];
    var known = read().list;
    var out = [];
    tags.forEach(function (t) {
      var match = known.find(function (k) { return same(k, t); });
      if (match && out.indexOf(match) === -1) out.push(match);
    });
    return out;
  }

  /** What a reader should see on an article: nothing at all when tags are off. */
  function visibleFor(article) {
    if (!isEnabled()) return [];
    return clean((article && article.tags) || []);
  }

  function reset() {
    localStorage.removeItem(LS);
    document.dispatchEvent(new CustomEvent("wl-tags-change"));
  }

  return {
    isEnabled: isEnabled, setEnabled: setEnabled,
    list: list, add: add, rename: rename, remove: remove, has: has,
    clean: clean, visibleFor: visibleFor, reset: reset,
  };
})();
