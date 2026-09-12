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

console.log("Building the demo copy:");
stripSync();
