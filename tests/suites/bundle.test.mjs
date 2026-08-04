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
    check.equal("bundle is tagged with the format", snap.format, "newspaper-content-bundle");
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
    const emptyBundle = { format: "newspaper-content-bundle", version: 1, data: {} };
    window.WLBundle.load(emptyBundle);
    check.ok("loading an empty bundle clears prior local edits",
      window.WLBrand.get().name !== "Stale Local Edit",
      "a local edit lingered after loading a bundle that didn't contain it");
    check.clean("no errors replacing state", ctx);
  }

  // ===== Bundles written under the old format name still import =====
  // The identifier used to be "woodley-content-bundle". Anything an editor
  // exported before the rename must keep loading, or a saved publish file
  // becomes unopenable.
  {
    const ctx = await loadPage("editor-content.html");
    const { window } = ctx;

    const legacy = {
      format: "woodley-content-bundle", version: 1,
      data: { wl_brand: { name: "Legacy Bundle Paper" } },
    };
    const res = window.WLBundle.load(legacy);
    check.ok("accepts a bundle tagged with the legacy format", res.ok === true,
      "a bundle exported before the format rename was rejected");
    check.equal("and applies its content", window.WLBrand.get().name, "Legacy Bundle Paper");
    check.equal("but new exports carry the current format",
      window.WLBundle.snapshot().format, "newspaper-content-bundle");
    check.clean("no errors loading a legacy bundle", ctx);
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
      format: "newspaper-content-bundle", version: 1,
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
    check.ok("a publish button is present", !!document.getElementById("wl-publish-publish"));
    check.ok("a download button is present", !!document.getElementById("wl-publish-download"));
    check.ok("a load-from-file input is present", !!document.getElementById("wl-publish-file"));
    check.clean("editor page renders clean with the panel", ctx);
  }

  // ===== A published bundle seeds readers, once per version =====
  {
    const ctx = await loadPage("editor-content.html");
    const { window } = ctx;
    // Simulate a committed published-content.js having run.
    window.WL_PUBLISHED = {
      format: "newspaper-content-bundle", version: 1,
      data: { wl_brand: { name: "Published Paper" } },
    };
    check.ok("applies a new published version", window.WLBundle.applyPublished() === true);
    check.equal("readers see the published content", window.WLBrand.get().name, "Published Paper");
    check.ok("does not re-apply the same version", window.WLBundle.applyPublished() === false,
      "the same published version was applied twice");

    // A draft made after publishing survives a reload while the version is unchanged.
    window.WLBrand.save({ name: "Local Draft" });
    window.WLBundle.applyPublished();
    check.equal("a local draft survives an unchanged published version",
      window.WLBrand.get().name, "Local Draft");

    // A brand-new published version wins over the draft.
    window.WL_PUBLISHED = {
      format: "newspaper-content-bundle", version: 1,
      data: { wl_brand: { name: "Newer Published" } },
    };
    check.ok("a newer published version re-applies", window.WLBundle.applyPublished() === true);
    check.equal("and wins over the local draft", window.WLBrand.get().name, "Newer Published");
    check.clean("no errors applying published content", ctx);
  }

  // ===== The publish artifact is valid, self-contained JS =====
  {
    const ctx = await loadPage("editor-content.html");
    const { window } = ctx;
    window.WLBrand.save({ name: "Export Me" });
    const js = window.WLBundle.toPublishedJS();
    check.ok("the publish file assigns WL_PUBLISHED", /window\.WL_PUBLISHED\s*=/.test(js));
    // Run it into a fresh object to confirm it parses and carries the edit.
    const sandbox = {};
    new Function("window", js)(sandbox);
    check.equal("the exported bundle carries the edit",
      sandbox.WL_PUBLISHED.data.wl_brand.name, "Export Me");
    check.equal("and is tagged as a bundle", sandbox.WL_PUBLISHED.format, "newspaper-content-bundle");
    check.clean("no errors exporting the publish file", ctx);
  }

  return check;
}
