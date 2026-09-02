// The Subscribe button in the utility bar, end to end.
//
// The form posts an address to a Google Apps Script, which appends it to a
// Sheet. The rule the whole thing is built around: never tell a reader they
// signed up when nothing was recorded. So these drive the real modal and check
// what the reader is told in each case — configured, unconfigured, and failing.
import { loadPage, inlineStyles, Check } from "../harness.mjs";
import { readerReceiving } from "./publish.test.mjs";
import jsdomPkg from "jsdom";
import { readFileSync } from "node:fs";

/** Open a page with a pretend endpoint and a stubbed fetch. */
async function withEndpoint(reply, { endpoint = "https://script.google.com/macros/s/TEST/exec" } = {}) {
  const calls = [];
  const ctx = await loadPage("index.html", {
    editor: false,
    beforeParse(w) {
      w.__calls = calls;
      w.fetch = (url, opts) => {
        calls.push({ url, body: JSON.parse(opts.body) });
        return Promise.resolve(reply);
      };
    },
  });
  // config.js ships no endpoint; a school pastes one in. Set it the same way.
  ctx.window.WL_CONFIG.submissions = { endpoint, fallbackEmail: "editor@example.org" };
  return { ctx, calls };
}

const okReply = { ok: true, json: () => Promise.resolve({ result: "ok" }) };

const openModal = ctx => {
  const link = [...ctx.window.document.querySelectorAll(".topbar a")]
    .find(a => a.textContent.trim() === "Subscribe");
  if (link) link.click();
  return link;
};

const $ = (ctx, id) => ctx.window.document.getElementById(id);
const tick = () => new Promise(r => setTimeout(r, 0));

export async function run() {
  const check = new Check();

  // ===== The button exists and opens the form =====
  {
    const { ctx } = await withEndpoint(okReply);
    const link = openModal(ctx);
    check.ok("every page has a Subscribe link in the utility bar", !!link);
    check.ok("clicking it opens the signup", !!$(ctx, "sub-email"));
    check.clean("no errors opening the signup", ctx);
  }

  // ===== It asks for an email address and nothing else =====
  //  A student paper holding other students' phone numbers is a bigger promise
  //  than a newsletter needs, and it drags in rules about texting minors. The
  //  field that isn't collected can't leak, so these pin its absence rather
  //  than trusting that nobody adds it back.
  {
    const { ctx, calls } = await withEndpoint(okReply);
    openModal(ctx);
    check.ok("there is no phone field on the form", !$(ctx, "sub-phone"));
    check.ok("and nothing in the form mentions a phone number",
      !/phone/i.test(ctx.window.document.getElementById("wl-modal-content").textContent),
      ctx.window.document.getElementById("wl-modal-content").textContent);

    $(ctx, "sub-email").value = "reader@example.org";
    $(ctx, "sub-go").click();
    await tick();
    check.ok("and no phone key is ever posted",
      calls[0] && !("phone" in calls[0].body), JSON.stringify(calls[0] && calls[0].body));
  }

  // The Apps Script is the only real gatekeeper — the browser's checks just save
  // a round trip — so its refusal is pinned here too, read from the file that
  // gets pasted into the Sheet.
  {
    const src = readFileSync(new URL("../../setup/google-sheet-endpoint.gs", import.meta.url), "utf8");
    check.ok("the endpoint script records no Phone column", !/'Phone'/.test(src));
    check.ok("and refuses a payload carrying a phone number",
      /data\.phone.*not collected/s.test(src) || /if \(data\.phone\)/.test(src));
  }

  // ===== A good address is sent to the endpoint =====
  {
    const { ctx, calls } = await withEndpoint(okReply);
    openModal(ctx);
    $(ctx, "sub-email").value = "reader@example.org";
    $(ctx, "sub-go").click();
    await tick();

    check.equal("the address is posted once", calls.length, 1);
    check.ok("to the configured endpoint",
      calls[0] && calls[0].url.includes("/macros/s/TEST/exec"), calls[0] && calls[0].url);
    check.equal("tagged as a newsletter signup", calls[0] && calls[0].body.kind, "subscribe");
    check.equal("carrying the address", calls[0] && calls[0].body.email, "reader@example.org");
    check.ok("and the reader is told it worked",
      /on the list/i.test(ctx.window.document.getElementById("wl-modal-content").textContent));
    check.clean("no errors sending", ctx);
  }

  // ===== A bad address never reaches the endpoint =====
  {
    const { ctx, calls } = await withEndpoint(okReply);
    openModal(ctx);
    $(ctx, "sub-email").value = "not-an-address";
    $(ctx, "sub-go").click();
    await tick();
    check.equal("a malformed address is not sent", calls.length, 0);
    check.ok("and the reader is told why", /doesn't look right/i.test($(ctx, "sub-err").textContent));

    $(ctx, "sub-email").value = "";
    $(ctx, "sub-go").click();
    await tick();
    check.equal("an empty form is not sent", calls.length, 0);
    check.ok("and the reader is asked for an address",
      /enter your email/i.test($(ctx, "sub-err").textContent), $(ctx, "sub-err").textContent);
  }

  // ===== Nothing configured: say so, never claim success =====
  {
    const { ctx, calls } = await withEndpoint(okReply, { endpoint: "" });
    openModal(ctx);
    $(ctx, "sub-email").value = "reader@example.org";
    $(ctx, "sub-go").click();
    await tick();

    check.equal("with no endpoint, nothing is posted", calls.length, 0);
    const err = $(ctx, "sub-err").textContent;
    check.ok("the reader is told signups aren't set up", /aren't set up/i.test(err), err);
    check.ok("and is offered email instead",
      !!$(ctx, "sub-err").querySelector('a[href^="mailto:"]'));
    check.ok("no success message is shown",
      !/on the list/i.test(ctx.window.document.getElementById("wl-modal-content").textContent),
      "the form claimed a signup that never happened");
  }

  // ===== The send failing is reported, not swallowed =====
  {
    const { ctx } = await withEndpoint({ ok: false, status: 500, json: () => Promise.resolve({}) });
    openModal(ctx);
    $(ctx, "sub-email").value = "reader@example.org";
    $(ctx, "sub-go").click();
    await tick();

    check.ok("a failed send is reported",
      /couldn't send/i.test($(ctx, "sub-err").textContent));
    check.ok("with a way to send it by email anyway",
      !!$(ctx, "sub-err").querySelector('a[href^="mailto:"]'));
    check.ok("and still no success message",
      !/on the list/i.test(ctx.window.document.getElementById("wl-modal-content").textContent));
  }

  // ===== A bot filling the honeypot is dropped before the network =====
  {
    const { ctx, calls } = await withEndpoint(okReply);
    openModal(ctx);
    $(ctx, "sub-email").value = "bot@example.org";
    $(ctx, "sub-hp").value = "I am a bot";
    $(ctx, "sub-go").click();
    await tick();
    check.equal("honeypot submissions never reach the endpoint", calls.length, 0);
  }

  // ===== Switching the button off takes it off the page =====
  //  A school that isn't collecting addresses must not be left with a button
  //  that opens a form. Removed, not hidden — a display:none link is still
  //  focusable and still announced.
  {
    const ctx = await loadPage("index.html", {
      editor: false,
      storage: { wl_brand: JSON.stringify({ submissions: { enabled: false } }) },
    });
    const link = [...ctx.window.document.querySelectorAll(".topbar a")]
      .find(a => a.textContent.trim() === "Subscribe");
    check.ok("with the button switched off, no Subscribe link is rendered", !link);
    check.clean("no errors with signups switched off", ctx);
  }

  {
    const ctx = await loadPage("index.html", { editor: false });
    check.ok("switched on, the link is back",
      !![...ctx.window.document.querySelectorAll(".topbar a")]
        .find(a => a.textContent.trim() === "Subscribe"));

    // A config.js written before this setting existed has no `enabled` key at
    // all. That must read as on, not as off.
    ctx.window.WL_CONFIG.submissions = { endpoint: "" };
    check.ok("a config with no `enabled` key still shows the button",
      ctx.window.WLSubmit.isEnabled());
  }

  // ===== The Design tab manages all of it =====
  const brandTab = (storage = {}) => loadPage("editor-brand.html", {
    beforeParse(w) { w.fetch = () => Promise.resolve(okReply); },
    storage,
  });

  {
    const ctx = await brandTab();
    check.ok("the Design tab has a newsletter panel", !!$(ctx, "sub-status"));
    check.ok("with a switch for the Subscribe button", !!$(ctx, "f-sub-enabled"));
    check.ok("a box for the endpoint", !!$(ctx, "f-sub-endpoint"));
    check.ok("a box for the fallback address", !!$(ctx, "f-sub-fallback"));
    check.ok("and a box for the subscriber Sheet", !!$(ctx, "f-sub-sheet"));
    check.clean("the newsletter panel renders without errors", ctx);
  }

  // Typing an endpoint and saving must survive as an override AND reach the
  // downloaded config.js — that file is the only thing readers ever get.
  {
    const ctx = await brandTab();
    ctx.type($(ctx, "f-sub-endpoint"), "https://script.google.com/macros/s/SAVED/exec");
    ctx.type($(ctx, "f-sub-fallback"), "editor@example.org");
    ctx.type($(ctx, "f-sub-sheet"), "https://docs.google.com/spreadsheets/d/ABC/edit");
    ctx.click($(ctx, "save-all"));

    const saved = ctx.window.WLBrand.overrides().submissions;
    check.equal("the endpoint is saved", saved && saved.endpoint,
      "https://script.google.com/macros/s/SAVED/exec");
    check.equal("so is the fallback address", saved && saved.fallbackEmail, "editor@example.org");
    check.equal("and the Sheet link", saved && saved.sheetUrl,
      "https://docs.google.com/spreadsheets/d/ABC/edit");
    check.ok("and all of it lands in the downloaded config.js",
      ctx.window.WLBrand.exportConfigSource().includes("/macros/s/SAVED/exec"));
    check.clean("no errors saving the newsletter settings", ctx);
  }

  // The panel must describe what READERS get, which comes from the deployed
  // config.js — never from what the editor just typed into this browser.
  {
    const ctx = await brandTab();
    const status = () => $(ctx, "sub-status").textContent;

    check.ok("with nothing set up, the panel says readers aren't being signed up",
      /aren't set up/i.test(status()), status());
    check.ok("and there is no stale drift warning before anything is typed",
      !/isn't live yet/i.test(status()), status());

    ctx.type($(ctx, "f-sub-endpoint"), "https://script.google.com/macros/s/TYPED/exec");
    check.ok("typing an endpoint does NOT claim signups are working",
      !/going to your Sheet/i.test(status()), status());
    check.ok("it warns the Sheet details aren't live for readers yet",
      /aren't live yet/i.test(status()), status());
    check.ok("and points at Download config as the way to make it live",
      /Download config/i.test(status()), status());
  }

  // ===== An editor turning it off actually reaches readers =====
  //  This is the whole point of the switch, and it is the one thing the other
  //  tests cannot show: they seed wl_brand into a reader's own browser, which
  //  proves the reader code works, not that publishing carries the setting.
  //  Adding wl_brand to content-bundle.js's exclude list would break this and
  //  nothing else would notice.
  {
    const ed = await brandTab();
    ed.window.WLBrand.save({ submissions: { enabled: false } });

    const published = ed.window.WLBundle.toPublishedJS();
    check.ok("the published file carries the switch", /"enabled":\s*false/.test(published),
      "wl_brand did not survive into the published bundle");

    const r = await readerReceiving(published);
    const link = [...r.window.document.querySelectorAll(".topbar a")]
      .find(a => a.textContent.trim() === "Subscribe");
    check.ok("a reader who has never opened the site gets no Subscribe button", !link,
      "the editor switched the newsletter off and readers still saw the button");
  }

  // ===== The switch and the Sheet details travel differently =====
  //  The endpoint is read from config.js on purpose, so changing it needs a
  //  deploy. The switch lives in wl_brand and goes out with everything else the
  //  paper publishes. Telling an editor to go and find a developer for a change
  //  that has already happened is as wrong as the reverse.
  {
    const ctx = await brandTab();
    const status = () => $(ctx, "sub-status").textContent;

    ctx.click($(ctx, "f-sub-enabled"));       // turn the newsletter off
    check.ok("switching the newsletter off says so", /switched off/i.test(status()), status());
    check.ok("and does NOT send the editor off to download a config file",
      !/Download config/i.test(status()), status());
    check.ok("nor claim it isn't live", !/aren't live yet/i.test(status()), status());

    ctx.type($(ctx, "f-sub-endpoint"), "https://script.google.com/macros/s/TYPED/exec");
    check.ok("changing the Sheet details as well still asks for a deploy",
      /Download config/i.test(status()), status());
    check.ok("and the switch is still reported separately",
      /switched off/i.test(status()), status());
    check.clean("no errors rendering the split status", ctx);
  }

  {
    // A deployed config.js WITH an endpoint should report the opposite. The
    // form is set to match it field for field, so there is no drift left.
    const ctx = await brandTab();
    const LIVE = "https://script.google.com/macros/s/LIVE/exec";
    ctx.window.WL_CONFIG.submissions = { enabled: true, endpoint: LIVE, fallbackEmail: "", sheetUrl: "" };
    ctx.type($(ctx, "f-sub-fallback"), "");
    ctx.type($(ctx, "f-sub-sheet"), "");
    ctx.type($(ctx, "f-sub-endpoint"), LIVE);

    check.ok("once the endpoint ships, readers are reported as signed up",
      /going to your Sheet/i.test($(ctx, "sub-status").textContent));
    check.ok("and with nothing left to deploy, the drift warning clears",
      !/isn't live yet/i.test($(ctx, "sub-status").textContent),
      $(ctx, "sub-status").textContent);
  }

  {
    const ctx = await brandTab();
    ctx.window.WL_CONFIG.submissions = { enabled: false, endpoint: "", fallbackEmail: "", sheetUrl: "" };
    $(ctx, "f-sub-enabled").checked = false;
    ctx.pick($(ctx, "f-sub-enabled"), "");     // re-render the status
    check.ok("with the button switched off, the panel says there is no button",
      /no Subscribe button/i.test($(ctx, "sub-status").textContent),
      $(ctx, "sub-status").textContent);
  }

  // ===== The Sheet link only ever opens an https URL =====
  {
    const ctx = await brandTab();
    const link = $(ctx, "sub-open-sheet");
    check.ok("with no Sheet recorded, there is nothing to click", link.hidden);

    ctx.type($(ctx, "f-sub-sheet"), "javascript:alert(1)");
    check.ok("a javascript: URL is never turned into a link",
      link.hidden && !link.getAttribute("href"), link.getAttribute("href") || "");

    ctx.type($(ctx, "f-sub-sheet"), "https://docs.google.com/spreadsheets/d/ABC/edit");
    check.ok("a real Sheet link is offered",
      !link.hidden && link.getAttribute("href") === "https://docs.google.com/spreadsheets/d/ABC/edit");
  }

  // ===== "Send a test" checks the URL just typed, and tells the truth =====
  {
    const calls = [];
    const ctx = await loadPage("editor-brand.html", {
      beforeParse(w) {
        w.fetch = (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); return Promise.resolve(okReply); };
      },
    });
    ctx.type($(ctx, "f-sub-endpoint"), "https://script.google.com/macros/s/TYPED/exec");
    ctx.type($(ctx, "f-sub-fallback"), "editor@example.org");
    ctx.click($(ctx, "sub-test"));
    await tick();

    check.equal("a test posts once", calls.length, 1);
    check.ok("to the URL in the box, not the one readers are on",
      calls[0] && calls[0].url.includes("/macros/s/TYPED/exec"), calls[0] && calls[0].url);
    check.equal("using the fallback address", calls[0] && calls[0].body.email, "editor@example.org");
    check.ok("and the result is reported", /should appear in the Subscribers tab/i.test($(ctx, "sub-status").textContent));
  }

  {
    const ctx = await loadPage("editor-brand.html", {
      beforeParse(w) { w.fetch = () => Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({}) }); },
    });
    ctx.type($(ctx, "f-sub-endpoint"), "https://script.google.com/macros/s/BAD/exec");
    ctx.type($(ctx, "f-sub-fallback"), "editor@example.org");
    ctx.click($(ctx, "sub-test"));
    await tick();

    const status = $(ctx, "sub-status").textContent;
    check.ok("a failing test is reported as failing", /didn't go through/i.test(status), status);
    check.ok("and never as a success", !/should appear in the Subscribers tab/i.test(status), status);
  }

  {
    const calls = [];
    const ctx = await loadPage("editor-brand.html", {
      beforeParse(w) { w.fetch = (url, opts) => { calls.push(url); return Promise.resolve(okReply); }; },
    });
    ctx.click($(ctx, "sub-test"));
    await tick();
    check.equal("a test with no URL entered sends nothing", calls.length, 0);
    check.ok("and says what's missing",
      /Paste your web-app URL/i.test($(ctx, "sub-status").textContent));
  }

  // ===== The switch sits next to its own label =====
  //  responsive.css sets `.ed-form input { width: 100% }` so text boxes fill
  //  their row. It loads AFTER each page's inline <style>, so at equal
  //  specificity it also beat `.checkbox-row input { width: auto }` — which
  //  stretched every tickbox across the panel and shoved its label to the far
  //  right. Resolving the real cascade is the only way to catch that.
  {
    const { window } = new jsdomPkg.JSDOM(inlineStyles("editor-brand.html"), { runScripts: "outside-only" });
    const widthOf = id => window.getComputedStyle(window.document.getElementById(id)).width;

    check.equal("the Subscribe switch keeps its own width", widthOf("f-sub-enabled"), "auto");
    check.equal("so does every other tickbox on the page", widthOf("f-orn-mirror"), "auto");
    check.equal("while text boxes still fill their row", widthOf("f-sub-endpoint"), "100%");
    check.equal("including the ones that were already there", widthOf("f-name"), "100%");
  }

  // ===== The setup instructions are on the page, folded away =====
  {
    const ctx = await brandTab();
    const guide = ctx.$(".sub-guide");
    check.ok("the panel carries the how-to", !!guide);
    check.ok("closed until asked for", guide && !guide.open);
    check.ok("with a summary that says what it is",
      /how to make the sheet/i.test(guide.querySelector("summary").textContent));

    const body = guide.textContent;
    check.ok("it covers making the Sheet", /sheets\.new/i.test(body));
    check.ok("adding the script", /Extensions → Apps Script/i.test(body));
    check.ok("deploying it with the access setting that matters",
      /Who has access: Anyone/i.test(body));
    check.ok("and says the config still has to be deployed",
      /Nothing reaches readers until that file is deployed/i.test(body));
    check.ok("it warns about using the paper's account, not a personal one",
      /not your own/i.test(body));
    check.ok("and about asking an adviser first", /adviser/i.test(body));
  }

  // ===== A bad endpoint can't be saved =====
  {
    const ctx = await brandTab();
    ctx.type($(ctx, "f-sub-endpoint"), "http://example.org/collect");   // plain http
    ctx.click($(ctx, "save-all"));
    check.ok("an http endpoint is refused — addresses travel over it",
      !(ctx.window.WLBrand.overrides().submissions || {}).endpoint);
    check.ok("with a reason", /https/i.test($(ctx, "save-msg").textContent),
      $(ctx, "save-msg").textContent);
  }

  return check;
}
