// Strip shared editing out of a deployed copy.
//
// config.js carries the Cloudflare Worker's URL and its editor key. Both are
// fine in a private repo and fine on a laptop. Neither is fine on a public URL:
// the browser fetches config.js, so hosting the site hands the key to everyone
// who visits — and anyone who then switches on editor preview could push
// content into the shared store, which commits itself to the repository.
//
// So the deployed demo gets a copy with sync blanked. The repository keeps its
// real config, and editors working locally keep shared editing. Vercel runs
// this as its build step; nothing else does.
//
// It edits the file in place, which is only safe because it runs on a throwaway
// checkout inside the build. Running it on a working copy would wipe the real
// values, so it refuses unless it is told to.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = path.join(HERE, "..", "config.js");

const forced = process.argv.includes("--force");
const onCI = !!(process.env.VERCEL || process.env.CI);

if (!forced && !onCI) {
  console.error(
    "Refusing to run: this blanks the Worker key in config.js, and outside a\n" +
    "build that means deleting it from your working copy.\n" +
    "Pass --force if that is genuinely what you want."
  );
  process.exit(1);
}

const before = fs.readFileSync(CONFIG, "utf8");
const after = before
  .replace(/(\bsync:\s*\{[\s\S]*?\bendpoint:\s*)"[^"]*"/, '$1""')
  .replace(/(\bsync:\s*\{[\s\S]*?\bkey:\s*)"[^"]*"/, '$1""');

if (after === before) {
  console.log("Demo config: sync was already empty, nothing to strip.");
} else {
  fs.writeFileSync(CONFIG, after, "utf8");
  console.log("Demo config: shared editing stripped (sync.endpoint and sync.key cleared).");
}

// Never let a build ship the key by accident — if the replace stopped matching
// because config.js was reshaped, that must fail the deploy, not pass quietly.
const left = after.match(/\bsync:\s*\{[\s\S]*?\}/);
if (left && /key:\s*"[^"]+"/.test(left[0])) {
  console.error("FAILED: a sync key is still present after stripping. Refusing to build.");
  process.exit(1);
}
