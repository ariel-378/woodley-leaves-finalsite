// ============================================================================
//  SUBMISSIONS — sends newsletter signups to a Google Sheet via a Google Apps
//  Script web app.
//
//  WHY THIS EXISTS: the paper is a static site with no server. Without this,
//  the signup form would write to the reader's own browser and no editor would
//  ever see it — an address that looked collected and went nowhere.
//
//  SET IT UP: see setup/README.md, then paste your web-app URL into
//  config.js → submissions.endpoint.
//
//  DESIGN RULES (please keep these):
//   • Never report success we didn't get. If the send fails, say so and offer
//     the reader a mailto: fallback so their address isn't lost. Silently
//     swallowing a signup is the bug this file was written to kill.
//   • The endpoint URL is public — it ships in page source. Anyone can POST to
//     it. The Apps Script does the real validation; the checks here are only
//     to save readers a round trip.
// ============================================================================
window.WLSubmit = (function () {
  var COOLDOWN_MS = 15000;         // one signup per 15s, per browser
  var LS_LAST = "wl_submit_last";
  var MAX = { email: 254, phone: 40 };

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
  // "not set up yet". http is refused because the form carries a personal
  // address — localhost excepted, so setup can be tested before deploying.
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
                   "(https://script.google.com/macros/s/.../exec). Signups may fail. See setup/README.md.");
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

  function mailtoFor(data) {
    var to = contactEmail();
    if (!to) return null;
    var lines = [];
    if (data.email) lines.push("Email: " + data.email);
    if (data.phone) lines.push("Phone: " + data.phone);
    return "mailto:" + encodeURIComponent(to) +
      "?subject=" + encodeURIComponent("Newsletter signup") +
      "&body=" + encodeURIComponent(lines.join("\n"));
  }

  function tooSoon() {
    try {
      var all = JSON.parse(localStorage.getItem(LS_LAST) || "{}");
      return all.subscribe && (Date.now() - all.subscribe) < COOLDOWN_MS;
    } catch (e) { return false; }
  }

  function stamp() {
    try {
      var all = JSON.parse(localStorage.getItem(LS_LAST) || "{}");
      all.subscribe = Date.now();
      localStorage.setItem(LS_LAST, JSON.stringify(all));
    } catch (e) { /* storage blocked — the cooldown is a nicety, not a gate */ }
  }

  function clip(v, n) { return String(v == null ? "" : v).slice(0, n); }

  function fail(data, reason) {
    return { ok: false, reason: reason, mailto: mailtoFor(data), email: contactEmail() };
  }

  // send({ email, phone }) → Promise<{ok, reason?, mailto?, email?}>
  function send(data, opts) {
    data = data || {};
    opts = opts || {};

    if (opts.honeypot) return Promise.resolve({ ok: true, dropped: true });  // a bot filled the trap
    if (!isConfigured()) return Promise.resolve(fail(data, "not-configured"));
    if (tooSoon()) return Promise.resolve(fail(data, "too-soon"));

    var body = JSON.stringify({
      kind: "subscribe",
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
      if (!res.ok) return fail(data, "http-" + res.status);
      return res.json().then(function (out) {
        if (out && out.result === "ok") { stamp(); return { ok: true }; }
        return fail(data, (out && out.error) || "rejected");
      }, function () {
        return fail(data, "bad-response");
      });
    }, function () {
      // Network error, or a Content-Security-Policy on the host page blocking
      // script.google.com. Both look the same from here.
      return fail(data, "network");
    });
  }

  // A human-readable explanation, for showing under the form.
  function explain(res) {
    if (!res || res.ok) return "";
    if (res.reason === "not-configured") {
      return res.email
        ? "Signups aren't set up yet. You can email us instead:"
        : "Signups aren't set up yet. Please contact the paper directly.";
    }
    if (res.reason === "too-soon") return "That was just sent — give it a moment before sending another.";
    return res.email
      ? "We couldn't send that just now. Your address isn't lost — you can email it instead:"
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
