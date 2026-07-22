// Test runner. `npm test`, or `node tests/run.mjs [name ...]` to run a subset.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SUITES = path.join(HERE, "suites");

const only = process.argv.slice(2);
const files = fs.readdirSync(SUITES)
  .filter(f => f.endsWith(".test.mjs"))
  .filter(f => !only.length || only.some(n => f.includes(n)))
  .sort();

if (!files.length) {
  console.error(only.length ? `No suite matches: ${only.join(", ")}` : "No suites found.");
  process.exit(1);
}

let totalChecks = 0;
const failed = [];
const started = Date.now();

for (const file of files) {
  const name = file.replace(".test.mjs", "");
  process.stdout.write(`  ${name} … `);
  try {
    const mod = await import(path.join(SUITES, file));
    const check = await mod.run();
    totalChecks += check.count;
    if (check.failures.length) {
      console.log(`FAIL (${check.failures.length}/${check.count})`);
      check.failures.forEach(f => console.log(`      ✗ ${f}`));
      failed.push(name);
    } else {
      console.log(`ok (${check.count})`);
    }
  } catch (err) {
    console.log("ERROR");
    console.log(`      ${err.stack.split("\n").slice(0, 4).join("\n      ")}`);
    failed.push(name);
  }
}

const secs = ((Date.now() - started) / 1000).toFixed(1);
console.log("");
if (failed.length) {
  console.log(`${failed.length} suite(s) failed: ${failed.join(", ")}  (${totalChecks} checks, ${secs}s)`);
  process.exit(1);
}
console.log(`All ${files.length} suites passed — ${totalChecks} checks in ${secs}s`);
