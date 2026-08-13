// Click-through sweep: press every control on every editor page and require
// that nothing throws.
//
// This is the suite that caught the bracket editor reading `.matches` of
// undefined. Handlers that only break on an unusual path stay invisible until
// something presses them, so this presses everything.

import { pages, loadPage, Check } from "../harness.mjs";

// Expected navigation, not a fault: these reload or redirect by design.
const NAVIGATES = /Not implemented: navigation|Not implemented: window\.scroll/;
// jsdom has no blob URL support; the brand exporter's download is fine in a browser.
const JSDOM_GAP = /createObjectURL|revokeObjectURL/;

const SKIP = new Set(["editor.html", "editor-puzzles.html", "editor-writers.html"]);

// The Schedule tab lists what is waiting to publish, so with an empty browser
// it correctly shows an empty state and has nothing to press. Give it one
// scheduled item and its controls appear — which is the state worth sweeping.
function seedFor(page) {
  if (page !== "editor-schedule.html") return {};
  const soon = new Date(Date.now() + 36 * 3600 * 1000);
  const p = n => String(n).padStart(2, "0");
  const at = `${soon.getFullYear()}-${p(soon.getMonth() + 1)}-${p(soon.getDate())}T${p(soon.getHours())}:${p(soon.getMinutes())}`;
  return {
    wl_articles_custom: JSON.stringify({
      "sweep-scheduled": {
        title: "Scheduled for the sweep", section: "News", byline: "By A Reporter",
        date: "September 4, 2026", body: ["Waiting."], publishAt: at,
      },
    }),
  };
}

function realErrors(errors) {
  return errors.filter(e => !NAVIGATES.test(e) && !JSDOM_GAP.test(e));
}

export async function run() {
  const check = new Check();
  const targets = pages().filter(p => p.startsWith("editor") && !SKIP.has(p));

  for (const page of targets) {
    const ctx = await loadPage(page, { editor: true, storage: seedFor(page) });
    const { document, window, click } = ctx;
    const pressed = new Set();

    // Three passes, because acting on a control often re-renders and reveals more.
    for (let pass = 0; pass < 3; pass++) {
      const controls = [...document.querySelectorAll(
        "button, [data-c], [data-a], [data-act], [data-sk], [data-acm], input[type=checkbox]")];
      for (const el of controls) {
        const id = [el.id, el.className, (el.textContent || "").slice(0, 20),
                    JSON.stringify(el.dataset || {})].join("|");
        if (pressed.has(id)) continue;
        pressed.add(id);
        try {
          if (el.type === "checkbox") {
            el.checked = !el.checked;
            el.dispatchEvent(new window.Event("change", { bubbles: true }));
          } else {
            click(el);
          }
        } catch (err) {
          ctx.errors.push(`click(${el.id || (el.textContent || "").trim().slice(0, 24)}): ${err.message}`);
        }
      }
    }

    const problems = realErrors(ctx.errors);
    check.ok(`${page}: ${pressed.size} controls pressed, none threw`, problems.length === 0,
      problems.slice(0, 3).join(" | "));
    check.ok(`${page} has controls to press`, pressed.size > 0, "no controls found — is the page gated?");
  }

  return check;
}
