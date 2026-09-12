// ============================================================================
//  DEMO ONLY — DELETE THIS DURING FINALSITE INTEGRATION
// ============================================================================
//
//  This is a password prompt in front of a static demo. It exists for one
//  reason: the paper is hosted on a link shared with a handful of people
//  before the school has decided anything, and it should not be readable by
//  whoever happens to find the URL.
//
//  IT IS NOT AUTHENTICATION, and nothing should ever be built on top of it:
//
//    · The password is in this file, which the browser downloads. Anyone who
//      opens the network tab can read it.
//    · The page's HTML is already on the wire before this runs. It hides what
//      has been sent; it does not prevent it being sent.
//    · There are no accounts, so it cannot tell one person from another and
//      cannot express "students and faculty only".
//
//  It stops a stranger who stumbles on the link. That is the entire claim.
//
//  THE REAL THING, once Finalsite hosts this: the site never authenticates
//  anyone. Finalsite decides who may read the paper with a page-audience
//  setting, and tells the page who is looking by setting window.WL_CONTEXT
//  before the scripts run. See FINALSITE.md.
//
//  TO REMOVE: delete setup/demo-gate.js and the injectGate() call in
//  setup/build-demo.mjs. Nothing else references it — it is injected into the
//  deployed copy at build time and appears nowhere in the repository's pages.
//
//  This file is never loaded when WL_CONTEXT is present, so a hosted
//  integration is unaffected even if someone forgets to delete it.
// ============================================================================
(function () {
  var PASSWORD = "__WL_DEMO_PASSWORD__";   // replaced at build time
  var KEY = "wl_demo_unlocked";

  // A host is providing identity, so this has no business running.
  if (window.WL_CONTEXT) return;

  try { if (sessionStorage.getItem(KEY) === "1") return; } catch (e) { /* private mode */ }

  // Hide the page while the prompt is up. The markup has already arrived —
  // this is about not showing the paper, not about withholding it.
  var hide = document.createElement("style");
  hide.textContent = "body > *:not(#wl-demo-gate) { display: none !important; }";
  (document.head || document.documentElement).appendChild(hide);

  function build() {
    var wrap = document.createElement("div");
    wrap.id = "wl-demo-gate";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-labelledby", "wl-demo-title");
    wrap.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;" +
      "justify-content:center;padding:24px;background:#f7f1e8;" +
      "font-family:Georgia,'Times New Roman',serif;";
    wrap.innerHTML =
      '<div style="max-width:420px;width:100%;text-align:center;">' +
        '<div id="wl-demo-title" style="font-size:30px;line-height:1.2;margin-bottom:6px;">' +
          (document.documentElement.getAttribute("data-wl-name") || "The Woodley Leaves") +
        '</div>' +
        '<p style="font:14px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;color:#56504a;margin:0 0 20px;">' +
          'This preview is being shared privately while the school decides whether to host it. ' +
          'Enter the password you were given.' +
        '</p>' +
        '<form id="wl-demo-form" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +
          '<label for="wl-demo-pw" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);">Password</label>' +
          '<input id="wl-demo-pw" type="password" autocomplete="current-password" autofocus ' +
            'style="flex:1 1 200px;min-width:0;padding:11px 13px;border:1px solid #e0d6c4;border-radius:8px;' +
            'font:15px system-ui,sans-serif;background:#fff;">' +
          '<button type="submit" style="padding:11px 20px;border:0;border-radius:8px;background:#2d2a26;' +
            'color:#fff;font:15px system-ui,sans-serif;cursor:pointer;">Continue</button>' +
        '</form>' +
        '<p id="wl-demo-err" role="alert" hidden ' +
          'style="font:13px system-ui,sans-serif;color:#b8002a;margin:14px 0 0;">' +
          'That password did not match. Ask whoever sent you the link.</p>' +
      '</div>';
    document.body.appendChild(wrap);

    wrap.querySelector("#wl-demo-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var typed = wrap.querySelector("#wl-demo-pw").value.trim();
      if (typed !== PASSWORD) {
        wrap.querySelector("#wl-demo-err").hidden = false;
        wrap.querySelector("#wl-demo-pw").select();
        return;
      }
      try { sessionStorage.setItem(KEY, "1"); } catch (e2) { /* private mode: this tab only */ }
      hide.remove();
      wrap.remove();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
