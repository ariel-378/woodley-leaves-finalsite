// Security invariants.
//
// Editors can paste their own HTML/CSS/JS into a section or a game. That code
// must never be able to reach the page that hosts it — no cookies, no
// localStorage, no DOM. These tests pin that guarantee, and the escaping of
// reader-visible text, so neither can regress unnoticed.

import fs from "fs";
import path from "path";
import { SITE, loadPage, Check } from "../harness.mjs";

export async function run() {
  const check = new Check();

  // ===== Every sandbox attribute withholds same-origin access =====
  // "allow-scripts allow-same-origin" together would defeat the sandbox
  // entirely: the frame could reach out and rewrite its parent.
  {
    const files = fs.readdirSync(SITE).filter(f => /\.(js|html)$/.test(f));
    let sandboxes = 0;
    for (const file of files) {
      const src = fs.readFileSync(path.join(SITE, file), "utf8");
      for (const m of src.matchAll(/sandbox["'\s,]+([a-z\- ]*)/g)) {
        const value = m[1];
        if (!value.includes("allow-")) continue;   // prose, not an attribute value
        sandboxes++;
        check.ok(`${file}: sandbox does not grant same-origin`,
          !value.includes("allow-same-origin"), `got "${value.trim()}"`);
      }
    }
    check.ok("sandboxed frames exist to check", sandboxes >= 2, `found ${sandboxes}`);
  }

  // ===== Custom section code really is framed, not inlined =====
  {
    const ctx = await loadPage("editor-content.html");
    const { window } = ctx;
    const hostile = `<script>parent.document.body.innerHTML = "pwned";<\/script>`;
    window.WLSections.setContentTypes("Features", ["Custom"]);
    window.WLSections.setCustomCode("Features", hostile);

    const storage = {};
    for (const k of Object.keys(window.localStorage)) storage[k] = window.localStorage.getItem(k);

    const reader = await loadPage("features.html", { editor: false, storage });
    const frame = reader.$(".sec-custom-frame, iframe[srcdoc]");
    check.ok("custom code renders inside an iframe", !!frame);
    if (frame) {
      const sandbox = frame.getAttribute("sandbox") || "";
      check.ok("that iframe is sandboxed", sandbox.includes("allow-scripts"), `sandbox="${sandbox}"`);
      check.ok("and is not same-origin", !sandbox.includes("allow-same-origin"), `sandbox="${sandbox}"`);
    }
    check.ok("the host page was not rewritten by the pasted code",
      !reader.document.body.textContent.includes("pwned"));
    check.ok("no raw <script> from the paste landed in the host page",
      ![...reader.document.querySelectorAll("script")].some(s => s.textContent.includes("parent.document")));
  }

  // ===== Article text is escaped, not executed =====
  {
    const ctx = await loadPage("editor-content.html");
    const { window } = ctx;
    const payload = `<img src=x onerror="window.__xss=1">`;
    window.WLArticles.save("xss-probe", {
      title: `Headline ${payload}`, deck: `Deck ${payload}`, section: "News",
      byline: "Tester", date: "April 20, 2026", body: ["Body."],
    });

    const storage = {};
    for (const k of Object.keys(window.localStorage)) storage[k] = window.localStorage.getItem(k);

    const reader = await loadPage("news.html", { editor: false, storage });
    check.ok("injected markup did not execute", reader.window.__xss === undefined);
    check.ok("the headline is shown as text",
      reader.document.body.textContent.includes("<img src=x"),
      "expected the tag to appear literally, meaning it was escaped");
    check.clean("section page renders clean with hostile input", reader);
  }

  return check;
}
