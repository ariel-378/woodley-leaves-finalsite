// Turn a checkout into the shared demo.
//
// One thing the deployed preview must not carry: shared-editing credentials.
// config.js holds the Worker URL and its editor key. The browser fetches
// config.js, so hosting the site hands that key to every visitor — and anyone
// who then switched on editor preview could push into the shared store, which
// commits itself back to the repository.
//
// It is stripped here rather than in the repository's own config, so local
// editors keep shared editing and git keeps the real values.
//
// The demo password is NOT handled here. It is edge middleware
// (middleware.js), which gates the site before a single file is served and
// changes nothing about the pages themselves.
//
// It edits in place, which is only safe on a throwaway build checkout — so it
// refuses to run anywhere else unless forced.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

const forced = process.argv.includes("--force");
const onCI = !!(process.env.VERCEL || process.env.CI);
if (!forced && !onCI) {
  console.error(
    "Refusing to run: this rewrites config.js and every page in place.\n" +
    "Outside a build that means damaging your working copy. Pass --force if you mean it."
  );
  process.exit(1);
}

// ── 1. Strip shared editing ────────────────────────────────────────────────
function stripSync() {
  const file = path.join(ROOT, "config.js");
  const before = fs.readFileSync(file, "utf8");
  const after = before
    .replace(/(\bsync:\s*\{[\s\S]*?\bendpoint:\s*)"[^"]*"/, '$1""')
    .replace(/(\bsync:\s*\{[\s\S]*?\bkey:\s*)"[^"]*"/, '$1""');
  fs.writeFileSync(file, after, "utf8");

  const block = after.match(/\bsync:\s*\{[\s\S]*?\}/);
  if (block && /key:\s*"[^"]+"/.test(block[0])) {
    console.error("FAILED: a sync key survived the strip. Refusing to build.");
    process.exit(1);
  }
  console.log("  shared editing stripped (sync.endpoint and sync.key cleared)");
}

// ── 2. Switch the tag system on for the preview ────────────────────────────
// Tags ship OFF: a paper that does not want them should not have to remove
// them. But a demo that shows the feature switched off does not show the
// feature, and the emailed pitch points at it directly. An editor would turn
// this on from the dashboard; here the deployed copy is seeded with it already
// on, exactly as if one had.
//
// This is demo scaffolding like everything else in this file. It writes a
// published-content.js, which is the same mechanism a real editor publishes
// with, so nothing bespoke is running on the preview.
function enableTags() {
  const articles = path.join(ROOT, "articles.js");
  const window_ = {};
  new Function("window", fs.readFileSync(articles, "utf8"))(window_);
  const all = window_.WL_ARTICLES || {};
  const tags = [...new Set(Object.values(all).flatMap(a => a.tags || []))].sort();

  const payload = { wl_tags: JSON.stringify({ enabled: true, list: tags }) };

  // Must be a real bundle: applyPublished() rejects anything whose `format`
  // it does not recognise, and does so silently — the first attempt at this
  // wrote a file that looked right, was served, and was ignored.
  const FORMAT = (fs.readFileSync(path.join(ROOT, "content-bundle.js"), "utf8")
    .match(/var FORMAT\s*=\s*"([^"]+)"/) || [])[1];
  if (!FORMAT) {
    console.error("FAILED: could not read the bundle format from content-bundle.js.");
    process.exit(1);
  }
  const js =
    "// ============================================================================\n" +
    "//  PUBLISHED CONTENT — generated for the demo build. Not committed.\n" +
    "//  Turns the tag system on so the preview shows it. See setup/build-demo.mjs.\n" +
    "// ============================================================================\n" +
    "window.WL_PUBLISHED = " +
      JSON.stringify({ format: FORMAT, version: 1, data: payload }, null, 2) + ";\n";
  fs.writeFileSync(path.join(ROOT, "published-content.js"), js, "utf8");
  console.log(`  tag system switched on for the preview (${tags.length} tags)`);
}

console.log("Building the demo copy:");
stripSync();
enableTags();   // DEMO ONLY
