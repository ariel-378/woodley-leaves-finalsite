// Playing the mini crossword.
//
// The grid opens with the top-left square already selected, so the keyboard has
// somewhere to go. But `onCellClick` treats a click on the already-selected
// square as "toggle direction" — which meant the first click a reader ever made
// flipped them into Down. You clicked 1 Across, typed the answer, and watched
// the letters march down the first column instead.
//
// Nothing caught it because nothing had ever played the crossword: every other
// suite renders the centerspread and checks it doesn't throw.
import { loadPage, Check } from "../harness.mjs";

// Each block closes its window when done: the crossword starts a clock the
// moment you type, and a live setInterval keeps `npm test` from ever exiting.
const opened = [];
const setup = async () => {
  const ctx = await loadPage("centerspread.html", { editor: false });
  opened.push(ctx);
  const grid = ctx.document.getElementById("grid");
  return {
    ctx, grid,
    cell: (r, c) => grid.querySelector(`.cw-cell[data-row="${r}"][data-col="${c}"]`),
    /** The letter in a cell, without the little clue number. */
    letter(r, c) {
      const el = grid.querySelector(`.cw-cell[data-row="${r}"][data-col="${c}"]`);
      if (!el) return "";
      const num = el.querySelector(".num");
      return (el.textContent || "").slice(num ? (num.textContent || "").length : 0).trim();
    },
    row: n => [0, 1, 2, 3, 4].map(c => {
      const el = grid.querySelector(`.cw-cell[data-row="${n}"][data-col="${c}"]`);
      const num = el && el.querySelector(".num");
      return el ? ((el.textContent || "").slice(num ? (num.textContent || "").length : 0).trim() || "_") : "#";
    }).join(""),
    col: n => [0, 1, 2, 3, 4].map(r => {
      const el = grid.querySelector(`.cw-cell[data-row="${r}"][data-col="${n}"]`);
      const num = el && el.querySelector(".num");
      return el ? ((el.textContent || "").slice(num ? (num.textContent || "").length : 0).trim() || "_") : "#";
    }).join(""),
    type: text => [...text].forEach(k =>
      grid.dispatchEvent(new ctx.window.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }))),
    press: k =>
      grid.dispatchEvent(new ctx.window.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })),
    clue: () => (ctx.document.getElementById("current-clue-text") || {}).textContent || "",
    selected: () => {
      const s = grid.querySelector(".cw-cell.selected");
      return s ? s.dataset.row + "," + s.dataset.col : "none";
    },
  };
};

export async function run() {
  const check = new Check();

  // ===== The first click reads across, the way every crossword does =====
  {
    const p = await setup();
    check.equal("the grid renders 25 squares", p.grid.children.length, 25);

    p.ctx.click(p.cell(0, 0));
    check.ok("clicking the first square gives an Across clue, not Down",
      /Across/.test(p.clue()), p.clue());

    p.type("BASIC");
    check.ok("and the answer fills the top row, left to right",
      !/^._{4}$/.test(p.row(0)) && p.row(0).indexOf("_") !== 1,
      `row 0 is "${p.row(0)}", column 0 is "${p.col(0)}"`);
    check.equal("the letters land across", p.row(0), "BASIC");
    check.clean("no errors playing", p.ctx);
  }

  // ===== Clicking the same square again still toggles =====
  //  The fix must not cost the ordinary behaviour: a second click on the
  //  square you are already on switches you between Across and Down.
  {
    const p = await setup();
    p.ctx.click(p.cell(0, 0));
    const first = p.clue();
    p.ctx.click(p.cell(0, 0));
    const second = p.clue();
    check.ok("a second click on the same square switches direction",
      /Across/.test(first) && /Down/.test(second), `${first} → ${second}`);

    p.type("B");
    p.press("ArrowDown");
    check.ok("and typing then runs down the column", p.col(0)[0] === "B", p.col(0));
  }

  // ===== A Down clue really does fill downwards =====
  {
    const p = await setup();
    const downClue = p.ctx.$$("#down-clues li")[0];
    p.ctx.click(downClue);
    check.ok("clicking a Down clue selects it", /Down/.test(p.clue()), p.clue());

    p.type("BASIC");
    check.equal("and its answer fills the column", p.col(0), "BASIC");
  }

  // ===== Moving around =====
  //  An arrow across the grain turns you rather than moving you — press it
  //  again to move. That is what the NYT mini does, and what a solver's hands
  //  expect; these pin it so it isn't "simplified" away later.
  {
    const p = await setup();
    p.ctx.click(p.cell(0, 0));
    check.ok("clicking starts you Across", /Across/.test(p.clue()), p.clue());

    p.press("ArrowRight");
    check.equal("ArrowRight moves along the word", p.selected(), "0,1");

    p.press("ArrowDown");
    check.ok("the first ArrowDown turns you, rather than moving",
      /Down/.test(p.clue()) && p.selected() === "0,1", `${p.clue()} @ ${p.selected()}`);
    p.press("ArrowDown");
    check.equal("the second ArrowDown moves", p.selected(), "1,1");

    p.press("ArrowUp");
    check.equal("ArrowUp moves back up the same word", p.selected(), "0,1");

    p.press("ArrowLeft");
    check.ok("ArrowLeft turns you back across", /Across/.test(p.clue()), p.clue());
    p.press("ArrowLeft");
    check.equal("and then moves", p.selected(), "0,0");
  }

  // ===== One keypress puts in one letter =====
  //  The grid and the document both listened for keydown and both called the
  //  same handler, so a bubbled event was handled twice: typing one letter put
  //  two in the grid, and one arrow key jumped two squares.
  {
    const p = await setup();
    p.ctx.click(p.cell(0, 0));
    p.press("Q");
    check.equal("typing one letter fills exactly one square", p.row(0), "Q____");
    check.equal("and leaves the cursor one square along", p.selected(), "0,1");
  }

  // ===== Typing works when focus has wandered off the grid =====
  //  Clicking a clue in the list leaves focus on that <li>, not on the grid.
  //  The document-level listener is what keeps typing working there — so the
  //  guard against double-handling has to spare it. This is the path the fix
  //  could most easily have broken.
  {
    const p = await setup();
    const clue = p.ctx.$$("#across-clues li")[0];
    p.ctx.click(clue);                       // focus is on the clue, not the grid
    p.ctx.document.body.dispatchEvent(
      new p.ctx.window.KeyboardEvent("keydown", { key: "Z", bubbles: true, cancelable: true }));

    check.ok("typing after clicking a clue still fills the grid",
      /Z/.test(p.row(0)), `row 0 is "${p.row(0)}"`);
    check.equal("exactly once", (p.row(0).match(/Z/g) || []).length, 1);
  }

  // ===== Backspace clears =====
  {
    const p = await setup();
    p.ctx.click(p.cell(0, 0));
    p.type("BA");
    check.ok("two letters go in", p.row(0).startsWith("BA"), p.row(0));
    p.press("Backspace");
    p.press("Backspace");
    check.ok("backspace clears them again", !/[A-Z]/.test(p.row(0)), p.row(0));
  }

  // ===== The buttons do something =====
  {
    const p = await setup();
    p.ctx.click(p.cell(0, 0));
    p.type("ZZZZZ");
    p.ctx.click(p.ctx.$("#btn-reset"));
    check.ok("Reset empties the grid", !/[A-Z]/.test(p.row(0)), p.row(0));

    p.ctx.click(p.ctx.$("#btn-reveal-all"));
    check.ok("Reveal puzzle fills every square",
      !p.row(0).includes("_") && !p.row(4).includes("_"), `${p.row(0)} / ${p.row(4)}`);
    check.clean("no errors using the controls", p.ctx);
  }

  opened.forEach(c => c.close());
  return check;
}
