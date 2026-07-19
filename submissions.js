// ============================================================================
//  SUBMISSIONS — sends reader forms (newsletter signups, staff signups, story
//  pitches) to a Google Sheet via a Google Apps Script web app.
//
//  WHY THIS EXISTS: the paper is a static site with no server. Without this,
//  every form wrote to the reader's own browser and no editor ever saw it —
//  a student's pitch looked submitted and went nowhere.
//
//  SET IT UP: see setup/README.md, then paste your web-app URL into
//  config.js → submissions.endpoint.
//
//  DESIGN RULES (please keep these):
//   • Never report success we didn't get. If the send fails, say so and offer
//     the reader a mailto: fallback so their words aren't lost. Silently
//     swallowing a pitch is the bug this file was written to kill.
//   • The endpoint URL is public — it ships in page source. Anyone can POST to
//     it. The Apps Script does the real validation; the checks here are only
//     to save readers a round trip.
// ============================================================================
window.WLSubmit = (function () {
  var COOLDOWN_MS = 15000;         // one submission per form per 15s, per browser
  var LS_LAST = "wl_submit_last";
  var MAX = { pitch: 5000, name: 120, email: 254, phone: 40 };

  // The endpoint is read from config.js DIRECTLY, never through WLBrand: brand
  // overrides are per-browser (see brand-store.js), and where the paper's mail
  // goes must be the same for every reader. Contacts do come from WLBrand, so
  // the email fallback follows whatever the Design tab shows.
  function config() {
    var base = window.WL_CONFIG || {};
    var brand = window.WLBrand ? window.WLBrand.get() : base;
    return { cfg: brand, sub: base.submissions || {} };
  }

  function endpoint() { return String(config().sub.endpoint || "").trim(); }

  var APPS_SCRIPT = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec/;

  // "Configured" means someone put a usable https URL here. It deliberately
  // does NOT require the Apps Script shape: a mistyped URL should fail on send
  // and offer the reader the email fallback, rather than be misreported as
  // "not set up yet". http is refused because these forms carry personal
  // information — localhost excepted, so setup can be tested before deploying.
  function isConfigured() {
    var e = endpoint();
    if (!e) return false;
    return /^https:\/\/.+/i.test(e) || /^http:\/\/(localhost|127\.0\.0\.1)([:\/]|$)/i.test(e);
  }

  // A nudge at setup time, not a gate.
  function warnIfOdd() {
    var e = endpoint();
    if (e && isConfigured() && !APPS_SCRIPT.test(e) && !/^http:\/\/(localhost|127\.0\.0\.1)/i.test(e)) {
      console.warn("[WLSubmit] submissions.endpoint doesn't look like a Google Apps Script web-app URL " +
                   "(https://script.google.com/macros/s/.../exec). Submissions may fail. See setup/README.md.");
    }
  }
  warnIfOdd();

  // Where to send readers when the Sheet isn't reachable.
  function contactEmail() {
    var c = config();
    if (c.sub.fallbackEmail) return String(c.sub.fallbackEmail).trim();
    var contacts = c.cfg.contacts || [];
    return contacts.length && contacts[0].email ? String(contacts[0].email).trim() : "";
  }

  var SUBJECTS = {
    subscribe: "Newsletter signup",
    writers: "I'd like to write for the paper",
    tip: "Story pitch",
  };

  function mailtoFor(kind, data) {
    var to = contactEmail();
    if (!to) return null;
    var lines = [];
    if (data.pitch) lines.push(data.pitch, "");
    if (data.name) lines.push("Name: " + data.name);
    if (data.email) lines.push("Email: " + data.email);
    if (data.phone) lines.push("Phone: " + data.phone);
    return "mailto:" + encodeURIComponent(to) +
      "?subject=" + encodeURIComponent(SUBJECTS[kind] || "Message") +
      "&body=" + encodeURIComponent(lines.join("\n"));
  }

  function tooSoon(kind) {
    try {
      var all = JSON.parse(localStorage.getItem(LS_LAST) || "{}");
      return all[kind] && (Date.now() - all[kind]) < COOLDOWN_MS;
    } catch (e) { return false; }
  }

  function stamp(kind) {
    try {
      var all = JSON.parse(localStorage.getItem(LS_LAST) || "{}");
      all[kind] = Date.now();
      localStorage.setItem(LS_LAST, JSON.stringify(all));
    } catch (e) { /* storage blocked — the cooldown is a nicety, not a gate */ }
  }

  function clip(v, n) { return String(v == null ? "" : v).slice(0, n); }

  function fail(kind, data, reason) {
    return { ok: false, reason: reason, mailto: mailtoFor(kind, data), email: contactEmail() };
  }

  // send("tip", { pitch, name, email }) → Promise<{ok, reason?, mailto?, email?}>
  function send(kind, data, opts) {
    data = data || {};
    opts = opts || {};

    if (opts.honeypot) return Promise.resolve({ ok: true, dropped: true });  // a bot filled the trap
    if (!isConfigured()) return Promise.resolve(fail(kind, data, "not-configured"));
    if (tooSoon(kind)) return Promise.resolve(fail(kind, data, "too-soon"));

    var body = JSON.stringify({
      kind: kind,
      pitch: clip(data.pitch, MAX.pitch),
      name: clip(data.name, MAX.name),
      email: clip(data.email, MAX.email),
      phone: clip(data.phone, MAX.phone),
    });

    // text/plain keeps this a "simple" CORS request. An Apps Script web app
    // does not answer preflight (OPTIONS), so application/json would fail.
    return fetch(endpoint(), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: body,
      redirect: "follow",     // Apps Script 302s to googleusercontent.com
    }).then(function (res) {
      if (!res.ok) return fail(kind, data, "http-" + res.status);
      return res.json().then(function (out) {
        if (out && out.result === "ok") { stamp(kind); return { ok: true }; }
        return fail(kind, data, (out && out.error) || "rejected");
      }, function () {
        return fail(kind, data, "bad-response");
      });
    }, function () {
      // Network error, or a Content-Security-Policy on the host page blocking
      // script.google.com. Both look the same from here.
      return fail(kind, data, "network");
    });
  }

  // A human-readable explanation, for showing under a form.
  function explain(res) {
    if (!res || res.ok) return "";
    if (res.reason === "not-configured") {
      return res.email
        ? "Online submissions aren't set up yet. You can email us instead:"
        : "Online submissions aren't set up yet. Please contact the paper directly.";
    }
    if (res.reason === "too-soon") return "That was just sent — give it a moment before sending another.";
    return res.email
      ? "We couldn't send that just now. Your words aren't lost — you can email them instead:"
      : "We couldn't send that just now. Please try again later.";
  }

  return {
    send: send,
    explain: explain,
    isConfigured: isConfigured,
    contactEmail: contactEmail,
    mailtoFor: mailtoFor,
  };
})();
