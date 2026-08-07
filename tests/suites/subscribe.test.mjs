// The Subscribe button in the utility bar, end to end.
//
// The form posts an address to a Google Apps Script, which appends it to a
// Sheet. The rule the whole thing is built around: never tell a reader they
// signed up when nothing was recorded. So these drive the real modal and check
// what the reader is told in each case — configured, unconfigured, and failing.
import { loadPage, Check } from "../harness.mjs";

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
    check.ok("it asks for an address", !!$(ctx, "sub-email") && !!$(ctx, "sub-phone"));
    check.clean("no errors opening the signup", ctx);
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
    $(ctx, "sub-phone").value = "";
    $(ctx, "sub-go").click();
    await tick();
    check.equal("an empty form is not sent", calls.length, 0);
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

  return check;
}
