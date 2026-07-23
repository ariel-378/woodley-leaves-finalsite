// The content bundle: the single-file publish/transfer format.
//
// Every editor edit lives in a `wl_*` localStorage key in one browser. The
// bundle gathers them into one JSON object that can be committed (to publish)
// or handed to another editor (to transfer). These tests hold the format to
// three promises: it captures content, it ignores per-device/session keys, and
// loading a bundle reproduces the state exactly.

import { loadPage, Check } from "../harness.mjs";

export async function run() {
  const check = new Check();

  // ===== A snapshot captures content but not per-device keys =====
  {
    const ctx = await loadPage("editor-content.html");
    const { window } = ctx;

    window.WLBrand.save({ name: "Bundle Test Paper" });          // → wl_brand
    window.localStorage.setItem("wl_article_views", JSON.stringify({ a: 3 })); // per-device
    window.localStorage.setItem("wl_preview_role", "editor");    // session

    const snap = window.WLBundle.snapshot();
    check.equal("bundle is tagged with the format", snap.format, "woodley-content-bundle");
    check.ok("captures a content key (brand)", !!snap.data.wl_brand,
      "the brand edit was not in the bundle");
    check.ok("brand value survives the round-trip readable",
      snap.data.wl_brand && snap.data.wl_brand.name === "Bundle Test Paper");
    check.ok("ignores per-device analytics (wl_article_views)",
      !("wl_article_views" in snap.data), "a per-device key leaked into the bundle");
    check.ok("ignores the session preview role",
      !("wl_preview_role" in snap.data));
    check.ok("serialises to valid JSON", (() => {
      try { JSON.parse(window.WLBundle.toJSON()); return true; } catch { return false; }
    })());
    check.clean("no errors taking a snapshot", ctx);
  }

  // ===== Loading a bundle reproduces the state exactly =====
  {
    const ctx = await loadPage("editor-content.html");
    const { window } = ctx;

    window.WLBrand.save({ name: "Original Paper" });
    window.localStorage.setItem("wl_article_views", JSON.stringify({ keep: 1 }));
    const saved = window.WLBundle.snapshot();

    // Wipe edits back to shipped defaults.
    window.WLBundle.clearAll();
    check.ok("clearAll removes content edits", window.WLBrand.get().name !== "Original Paper",
      "the brand override survived clearAll");
    check.equal("clearAll leaves per-device keys alone",
      window.localStorage.getItem("wl_article_views"), JSON.stringify({ keep: 1 }));

    // Restore from the bundle.
    const res = window.WLBundle.load(saved);
    check.ok("load reports success", res.ok);
    check.equal("state is reproduced exactly", window.WLBrand.get().name, "Original Paper");
    check.clean("no errors on load", ctx);
  }

  // ===== A load is a replacement, not a merge =====
  {
    const ctx = await loadPage("editor-content.html");
    const { window } = ctx;

    window.WLBrand.save({ name: "Stale Local Edit" });   // a draft that should be dropped
    const emptyBundle = { format: "woodley-content-bundle", version: 1, data: {} };
    window.WLBundle.load(emptyBundle);
    check.ok("loading an empty bundle clears prior local edits",
      window.WLBrand.get().name !== "Stale Local Edit",
      "a local edit lingered after loading a bundle that didn't contain it");
    check.clean("no errors replacing state", ctx);
  }

  // ===== A load refuses junk and never writes session keys =====
  {
    const ctx = await loadPage("editor-content.html");
    const { window } = ctx;

    check.ok("rejects a non-bundle object", window.WLBundle.load({ foo: 1 }).ok === false);
    check.ok("rejects null", window.WLBundle.load(null).ok === false);

    // A malicious/oddly-shaped bundle can't overwrite a session key. (The
    // harness pre-seeds wl_preview_role for editor pages, so assert the bundle's
    // value was NOT applied rather than that the key is absent.)
    window.WLBundle.load({
      format: "woodley-content-bundle", version: 1,
      data: { wl_preview_role: "SHOULD_NOT_APPLY", wl_brand: { name: "Ok" } },
    });
    check.ok("a bundle cannot overwrite a session key",
      window.localStorage.getItem("wl_preview_role") !== "SHOULD_NOT_APPLY",
      "load wrote an excluded session key");
    check.equal("but does apply the real content key", window.WLBrand.get().name, "Ok");
    check.clean("no errors handling junk", ctx);
  }

  // ===== The publish panel is present and wired =====
  {
    const ctx = await loadPage("editor-content.html");
    const { document } = ctx;
    check.ok("the Publish & transfer panel exists", !!document.getElementById("wl-publish-panel"));
    check.ok("a download button is present", !!document.getElementById("wl-publish-download"));
    check.ok("a load-from-file input is present", !!document.getElementById("wl-publish-file"));
    check.clean("editor page renders clean with the panel", ctx);
  }

  return check;
}
