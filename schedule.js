// ============================================================================
//  SCHEDULE — when a piece of content becomes visible to readers.
//
//  Any item may carry `publishAt`, the value of a <input type="datetime-local">
//  such as "2026-09-04T07:30". No value, or one already past, means live. A
//  value still to come means the item is finished and waiting: it shows in the
//  dashboard, marked, and appears nowhere a reader can see until its moment
//  arrives.
//
//  Articles have worked this way for a long time. Poems, art, videos, custom
//  features and games did not — they went live the instant they were saved,
//  which meant an edition could not be built ahead of time. This is the one
//  implementation all of them share, so the rule cannot drift between them.
//
//  TWO THINGS WORTH KNOWING
//
//  • A datetime-local value carries no timezone, so it is read in the reader's
//    local time, not the newsroom's. For one school that is exactly right. A
//    paper with readers in another timezone would see it flip at their own
//    local 7:30, not yours.
//
//  • This hides content; it does not embargo it. On a static site the text of a
//    scheduled item still ships inside published-content.js, so anyone who
//    opens the page source can read it early. Fine for planning next Friday's
//    poem. Not enough for a story that must not leak — hold that one back and
//    publish it on the day.
// ============================================================================
window.WLSchedule = (function () {
  /** ms since epoch for a publishAt value, or null when there isn't a usable one. */
  function at(item) {
    var raw = item && item.publishAt;
    if (typeof raw !== "string" || !raw.trim()) return null;
    var t = Date.parse(raw);
    // A date nobody can parse must not hide someone's work forever — treat a
    // typo as "no schedule" rather than "never".
    return isNaN(t) ? null : t;
  }

  /** Is this visible to readers right now? */
  function isLive(item) {
    var t = at(item);
    return t === null || t <= Date.now();
  }

  /** Is this finished and waiting for a future moment? */
  function isScheduled(item) {
    var t = at(item);
    return t !== null && t > Date.now();
  }

  /** "Sep 4, 7:30 AM" — for the dashboard badge. */
  function format(publishAt) {
    var d = new Date(publishAt);
    return isNaN(d.getTime()) ? String(publishAt)
      : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  /** Everything a reader should see, in the order given. */
  function live(items) {
    return (items || []).filter(isLive);
  }

  // ── What the paper has waiting ────────────────────────────────────────────
  //  A publish time on its own answers "is this out yet". It does not answer
  //  the question an editor planning an edition actually has: what goes out
  //  this week, in what order. That needs every store read at once.
  //
  //  Each store is optional. On a reader's page none of this runs; on a
  //  dashboard the stores are all present. A store that isn't loaded is simply
  //  skipped rather than throwing.
  function sectionOf(item, type, fallback) {
    if (item && typeof item.section === "string" && item.section.trim()) return item.section.trim();
    if (window.WLSections && WLSections.firstWithType) {
      return WLSections.firstWithType(type) || fallback || "";
    }
    return fallback || "";
  }

  var PIECE_KIND = { poem: "Poem", image: "Art", prose: "Prose" };
  var PIECE_TYPE = { poem: "Poems", image: "Art/photos", prose: "Reveal-answer games" };

  /**
   * Everything still to come, soonest first. Each entry is
   * { id, title, kind, section, publishAt, at }.
   */
  function collect() {
    var out = [];

    function push(item, id, kind, section) {
      if (!isScheduled(item)) return;
      out.push({
        id: id,
        title: (item.title || id || "Untitled").toString(),
        kind: kind,
        section: section || "",
        publishAt: item.publishAt,
        at: at(item),
      });
    }

    if (window.WLArticles && WLArticles.getAll) {
      var arts = WLArticles.getAll();
      Object.keys(arts).forEach(function (id) {
        push(arts[id], id, "Article", arts[id].section || "");
      });
    }

    if (window.WLCenterspread && WLCenterspread.list) {
      WLCenterspread.list().forEach(function (pc) {
        var kind = PIECE_KIND[pc.type] || "Piece";
        push(pc, pc.id, kind, sectionOf(pc, PIECE_TYPE[pc.type] || "Poems"));
      });
    }

    if (window.WLVideos && WLVideos.getAll) {
      var vids = WLVideos.getAll();
      Object.keys(vids).forEach(function (id) {
        push(vids[id], id, "Video", sectionOf(vids[id], "Videos"));
      });
    }

    if (window.WLFeatures && WLFeatures.getAll) {
      WLFeatures.getAll().forEach(function (f) {
        push(f, f.id, "Feature", sectionOf(f, "Custom feature"));
      });
    }

    if (window.WLGamesStore && WLGamesStore.getAll) {
      WLGamesStore.getAll().forEach(function (g) {
        push(g, g.id, "Game", sectionOf(g, "Puzzle games"));
      });
    }

    return out.sort(function (a, b) { return a.at - b.at; });
  }

  /**
   * Drop an item's publish time so it goes live now. The mirror of collect():
   * the same five stores, addressed the same way, so the two cannot fall out of
   * step about what kinds exist.
   *
   * Returns true when something was actually changed.
   */
  function publishNow(kind, id) {
    function clear(obj) {
      var copy = {};
      Object.keys(obj || {}).forEach(function (k) { if (k !== "publishAt") copy[k] = obj[k]; });
      return copy;
    }

    if (kind === "Article" && window.WLArticles) {
      var a = WLArticles.getById(id);
      if (!a) return false;
      WLArticles.save(id, clear(a));
      return true;
    }
    if (window.WLCenterspread && (kind === "Poem" || kind === "Art" || kind === "Prose" || kind === "Piece")) {
      var pc = WLCenterspread.getById ? WLCenterspread.getById(id)
             : WLCenterspread.list().find(function (x) { return x.id === id; });
      if (!pc) return false;
      WLCenterspread.save(id, clear(pc));
      return true;
    }
    if (kind === "Video" && window.WLVideos) {
      var v = WLVideos.getAll()[id];
      if (!v) return false;
      WLVideos.save(id, clear(v));
      return true;
    }
    if (kind === "Feature" && window.WLFeatures) {
      var f = WLFeatures.get(id);
      if (!f) return false;
      WLFeatures.save(clear(f));
      return true;
    }
    if (kind === "Game" && window.WLGamesStore) {
      var g = WLGamesStore.get(id);
      if (!g) return false;
      WLGamesStore.save(clear(g));
      return true;
    }
    return false;
  }

  return {
    isLive: isLive, isScheduled: isScheduled, format: format, live: live, at: at,
    collect: collect, publishNow: publishNow,
  };
})();
