import { loadPage } from "./tests/harness.mjs";
const ctx = await loadPage("centerspread.html", { editor: false });
const g = ctx.$("#grid");
console.log("#grid children:", g.children.length);
console.log("first cell:", g.children[0]?.outerHTML.slice(0,160));
console.log("has inputs:", g.querySelectorAll("input").length);
// Try to type into it the way a reader would
const first = g.children[0];
console.log("--- simulating a click + keypress on the first cell");
ctx.click(first);
console.log("current clue after click:", ctx.$("#current-clue-text")?.textContent);
const ev = new ctx.window.KeyboardEvent("keydown", { key: "B", bubbles: true });
(ctx.document.activeElement || g).dispatchEvent(ev);
console.log("cell text after typing B:", g.children[0]?.textContent);
console.log("errors:", ctx.errors.length ? ctx.errors.slice(0,3) : "none");
