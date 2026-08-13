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

  return { isLive: isLive, isScheduled: isScheduled, format: format, live: live, at: at };
})();
