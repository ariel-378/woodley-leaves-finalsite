// ============================================================================
//  DEMO ONLY — DELETE THIS FILE DURING FINALSITE INTEGRATION
// ============================================================================
//
//  A password in front of the shared preview. The paper is being shown by link
//  to a few people before the school has decided anything, and the host's
//  built-in protection is a paid feature.
//
//  This runs at the edge, before any file is served. A visitor without the
//  cookie never receives the paper's HTML at all — so unlike a script inside
//  the page, there is nothing to read in "view source" and nothing to skip.
//
//  It still is not the real thing, and nothing should be built on it: there is
//  one shared password and no accounts, so it cannot tell one reader from
//  another and cannot express "students and faculty only".
//
//  THE REAL MECHANISM, once Finalsite hosts this: the site never authenticates
//  anyone. Finalsite decides who may read the paper with a page-audience
//  setting, and tells the page who is looking by setting window.WL_CONTEXT
//  before the scripts run. See FINALSITE.md.
//
//  TO REMOVE: delete this file. That is the whole removal. It is deliberately
//  not wired into any page — every .html in this repository is exactly what
//  Finalsite would integrate, with no gate in it, which is also why the test
//  suite never meets a password prompt.
// ============================================================================

export const config = {
  // Everything except Vercel's own internals.
  matcher: "/((?!_next|_vercel).*)",
};

const COOKIE = "wl_demo";

export default async function middleware(request) {
  const password = process.env.WL_DEMO_PASSWORD || "woodley";
  const url = new URL(request.url);

  // Already let in.
  const cookie = request.headers.get("cookie") || "";
  if (cookie.split(/;\s*/).some((c) => c === `${COOKIE}=${encodeURIComponent(password)}`)) {
    return; // continue to the static file
  }

  // A submitted password.
  if (request.method === "POST") {
    const form = await request.formData();
    if (String(form.get("password") || "").trim() === password) {
      return new Response(null, {
        status: 303,
        headers: {
          Location: url.pathname + url.search,
          // Session cookie: closing the browser ends it. No expiry, so a
          // borrowed laptop does not stay unlocked indefinitely.
          "Set-Cookie": `${COOKIE}=${encodeURIComponent(password)}; Path=/; HttpOnly; Secure; SameSite=Lax`,
        },
      });
    }
    return gate(url, true);
  }

  return gate(url, false);
}

function gate(url, failed) {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>The Woodley Leaves</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#f7f1e8;color:#2d2a26;font-family:Georgia,'Times New Roman',serif;">
<main style="max-width:420px;width:100%;text-align:center;">
  <h1 style="font-size:30px;line-height:1.2;margin:0 0 6px;font-weight:400;">The Woodley Leaves</h1>
  <p style="font:14px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;color:#56504a;margin:0 0 20px;">
    This preview is being shared privately while the school decides whether to host it.
    Enter the password you were given.</p>
  <form method="POST" action="${escapeAttr(url.pathname + url.search)}" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
    <label for="pw" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);">Password</label>
    <input id="pw" name="password" type="password" autocomplete="current-password" autofocus
      style="flex:1 1 200px;min-width:0;padding:11px 13px;border:1px solid #e0d6c4;border-radius:8px;font:15px system-ui,sans-serif;background:#fff;color:#2d2a26;">
    <button type="submit" style="padding:11px 20px;border:0;border-radius:8px;background:#2d2a26;color:#fff;font:15px system-ui,sans-serif;cursor:pointer;">Continue</button>
  </form>
  ${failed ? `<p role="alert" style="font:13px system-ui,sans-serif;color:#b8002a;margin:14px 0 0;">That password did not match. Ask whoever sent you the link.</p>` : ""}
</main></body></html>`;

  return new Response(html, {
    status: failed ? 401 : 401,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

function escapeAttr(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
