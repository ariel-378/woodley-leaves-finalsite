// Static checks over the site's JavaScript.
//
// Catches the shape of bug where a constant is referenced under a name that was
// never declared — it parses fine and only throws when that branch runs. A
// typo'd LS_FEATURED in articles-store.js broke "reset all changes" this way.

import fs from "fs";
import path from "path";
import { SITE, Check } from "../harness.mjs";

const BUILTINS = new Set([
  "JSON", "Math", "Date", "Object", "Array", "String", "Number", "Boolean", "RegExp",
  "Set", "Map", "WeakMap", "Promise", "Error", "TypeError", "RangeError", "URL",
  "URLSearchParams", "FileReader", "ResizeObserver", "IntersectionObserver", "MutationObserver",
  "CustomEvent", "Event", "MouseEvent", "KeyboardEvent", "Blob", "Image", "Intl",
  "NaN", "Infinity", "DOMParser", "AbortController", "TextEncoder", "TextDecoder",
]);

/**
 * Blank out comments, string/template literals and regex literals so only code
 * remains.
 *
 * Regex literals matter: a character class like /[&<>"']/g contains quote
 * characters, and a scanner that does not recognise regexes reads that quote as
 * the start of a string and mis-parses everything after it.
 */
function codeOnly(src) {
  let out = "";
  let i = 0;
  // A '/' starts a regex (rather than division) when the last meaningful
  // character is one that cannot end an expression.
  const startsRegex = () => {
    for (let j = out.length - 1; j >= 0; j--) {
      const ch = out[j];
      if (/\s/.test(ch)) continue;
      return "(,=:[!&|?{};+-*%^~<>".includes(ch);
    }
    return true;
  };

  while (i < src.length) {
    const c = src[i], next = src[i + 1];

    if (c === "/" && next === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && next === "*") { i += 2; while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++; i += 2; continue; }

    if (c === "/" && startsRegex()) {
      i++;
      let inClass = false;
      while (i < src.length) {
        if (src[i] === "\\") { i += 2; continue; }
        if (src[i] === "[") inClass = true;
        else if (src[i] === "]") inClass = false;
        else if (src[i] === "/" && !inClass) break;
        else if (src[i] === "\n") break;   // unterminated: not a regex after all
        i++;
      }
      i++;
      while (i < src.length && /[gimsuy]/.test(src[i])) i++;   // flags
      out += "0";
      continue;
    }

    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      i++;
      while (i < src.length && src[i] !== quote) { if (src[i] === "\\") i++; i++; }
      i++;
      out += '""';
      continue;
    }

    out += c;
    i++;
  }
  return out;
}

export async function run() {
  const check = new Check();
  const files = fs.readdirSync(SITE).filter(f => f.endsWith(".js")).sort();

  check.ok("site has JavaScript to check", files.length > 0);

  for (const file of files) {
    const src = fs.readFileSync(path.join(SITE, file), "utf8");
    const code = codeOnly(src);

    const declared = new Set();
    for (const m of code.matchAll(/\b(?:const|let|var)\s+([A-Z][A-Z0-9_]{2,})\b/g)) declared.add(m[1]);
    for (const m of code.matchAll(/\bfunction\s+([A-Z][A-Z0-9_]{2,})\b/g)) declared.add(m[1]);

    // Drop property positions (obj.FOO) and object keys (FOO:) — not free variables.
    const free = code
      .replace(/\.\s*[A-Z][A-Z0-9_]{2,}\b/g, "")
      .replace(/\b[A-Z][A-Z0-9_]{2,}\s*:/g, "");

    const unknown = new Set();
    for (const m of free.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)) {
      const name = m[1];
      if (declared.has(name) || BUILTINS.has(name) || name.startsWith("WL")) continue;
      unknown.add(name);
    }

    check.ok(`${file}: no undeclared constants`, unknown.size === 0, [...unknown].join(", "));
  }

  // Debug statements should not ship.
  for (const file of files) {
    const code = codeOnly(fs.readFileSync(path.join(SITE, file), "utf8"));
    const hits = [...code.matchAll(/\bconsole\.(log|debug)\s*\(/g)].length;
    check.ok(`${file}: no console.log left behind`, hits === 0, `${hits} call(s)`);
  }

  return check;
}
