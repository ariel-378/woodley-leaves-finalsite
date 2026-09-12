// Turn a checkout into the shared demo.
//
// Two things the deployed preview needs that the repository must not carry:
//
//   1. No shared-editing credentials. config.js holds the Worker URL and its
//      editor key. The browser fetches config.js, so hosting the site hands
//      that key to every visitor — and anyone who then switched on editor
//      preview could push into the shared store, which commits itself back to
//      the repository.
//
//   2. A password in front of it, because Vercel's own protection is a paid
//      feature. See the long warning at the top of setup/demo-gate.js: it is
//      a courtesy lock, not authentication, and it is DEMO ONLY.
//
// Both are applied here rather than in the repository's own files, so:
//   · the pages in git stay exactly what Finalsite would integrate
//   · the test suite never sees a password prompt
//   · removing the demo gate is deleting a file, not editing 28 pages
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

// ── 2. Inject the demo gate ────────────────────────────────────────────────
// DEMO ONLY. Delete this function and the call below when Finalsite takes over
// identity; nothing else in the codebase refers to the gate.
function injectGate() {
  const password = process.env.WL_DEMO_PASSWORD || "woodley";
  if (!process.env.WL_DEMO_PASSWORD) {
    console.log('  note: WL_DEMO_PASSWORD is not set, using the default ("woodley").');
    console.log("        Set it in the host's environment variables to change it.");
  }

  const gate = fs.readFileSync(path.join(HERE, "demo-gate.js"), "utf8")
    .replace("__WL_DEMO_PASSWORD__", password.replace(/["\\]/g, "\\$&"));
  fs.writeFileSync(path.join(ROOT, "demo-gate.js"), gate, "utf8");

  // Every page, including the generated story pages one directory down.
  const pages = [
    ...fs.readdirSync(ROOT).filter(f => f.endsWith(".html")).map(f => [path.join(ROOT, f), "demo-gate.js"]),
  ];
  const stories = path.join(ROOT, "stories");
  if (fs.existsSync(stories)) {
    for (const f of fs.readdirSync(stories).filter(f => f.endsWith(".html"))) {
      pages.push([path.join(stories, f), "../demo-gate.js"]);
    }
  }

  let done = 0;
  for (const [file, src] of pages) {
    const html = fs.readFileSync(file, "utf8");
    if (html.includes("demo-gate.js")) continue;
    // First thing in <head>, so the page is hidden before anything paints.
    const tag = `<script src="${src}"></script>\n`;
    const at = html.indexOf("<head>");
    if (at === -1) continue;
    fs.writeFileSync(file, html.slice(0, at + 6) + "\n" + tag + html.slice(at + 6), "utf8");
    done++;
  }
  console.log(`  demo gate injected into ${done} page(s)`);

  const missed = pages.filter(([f]) => !fs.readFileSync(f, "utf8").includes("demo-gate.js"));
  if (missed.length) {
    console.error(`FAILED: ${missed.length} page(s) would have shipped ungated. Refusing to build.`);
    missed.slice(0, 5).forEach(([f]) => console.error("  " + path.relative(ROOT, f)));
    process.exit(1);
  }
}

console.log("Building the demo copy:");
stripSync();
injectGate();      // DEMO ONLY — remove with setup/demo-gate.js
