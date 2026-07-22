// Shared puzzle editor.
//
// Owns the four daily-puzzle forms (Spelling Bee, Mini Crossword,
// Connections, Word Search) so the Centerspread editor and the Content tab
// drive the same builders. Markup is injected on first use.
//
//   WLPuzzleEditor.openBee(index, { onSave })
//   WLPuzzleEditor.openCrossword(index, { onSave })
//   WLPuzzleEditor.openConnections(index, { onSave })
//   WLPuzzleEditor.openWordsearch(index, { onSave })
//
// Pass no index to add a new puzzle rather than edit one. A newly added
// puzzle becomes the active one. onSave runs after a save.

window.WLPuzzleEditor = (function () {
  "use strict";

  const MARKUP = `
  <div class="ed-modal-overlay" id="bee-modal" role="dialog" aria-modal="true" aria-labelledby="bee-modal-title">
    <div class="ed-modal">
      <button class="ed-modal-close">×</button>
      <h2 id="bee-modal-title">Add a Spelling Bee puzzle</h2>
      <div class="ed-form">
        <div class="bee-letters">
          <label>Center letter <input type="text" id="bee-center" class="letter-cell" maxlength="1" autocomplete="off"></label>
          <label>Outer 6 letters (e.g., AERLIN) <input type="text" id="bee-outer" class="letter-cell" maxlength="6" autocomplete="off"></label>
        </div>
        <label>Valid words (one per line; must contain the center letter, ≥4 letters, only the 7 letters)
          <textarea id="bee-words" rows="14" placeholder="ANTE&#10;LATE&#10;TRAIL&#10;..."></textarea>
        </label>
        <div class="ed-error" id="bee-error"></div>
        <div class="ed-form-actions">
          <button class="btn-ghost" data-cancel>Cancel</button>
          <button class="btn-primary" id="bee-save">Save</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Crossword modal -->
  <div class="ed-modal-overlay" id="cw-modal" role="dialog" aria-modal="true" aria-labelledby="cw-modal-title">
    <div class="ed-modal">
      <button class="ed-modal-close">×</button>
      <h2 id="cw-modal-title">Add a Mini Crossword</h2>
      <div class="ed-form">
        <p class="ed-tip">Enter five rows of five letters each. Columns will form the down-clue answers, so make sure they spell real words too.</p>
        <div class="grid-rows">
          <label>Row 1 <input type="text" class="letter-cell cw-row" maxlength="5" autocomplete="off" data-row="0"></label>
          <label>Row 2 <input type="text" class="letter-cell cw-row" maxlength="5" autocomplete="off" data-row="1"></label>
          <label>Row 3 <input type="text" class="letter-cell cw-row" maxlength="5" autocomplete="off" data-row="2"></label>
          <label>Row 4 <input type="text" class="letter-cell cw-row" maxlength="5" autocomplete="off" data-row="3"></label>
          <label>Row 5 <input type="text" class="letter-cell cw-row" maxlength="5" autocomplete="off" data-row="4"></label>
        </div>

        <div class="clue-section">
          <h4>Across clues</h4>
          <div class="clue-row"><label>1 Across</label><input type="text" id="cw-a-1"></div>
          <div class="clue-row"><label>6 Across</label><input type="text" id="cw-a-6"></div>
          <div class="clue-row"><label>7 Across</label><input type="text" id="cw-a-7"></div>
          <div class="clue-row"><label>8 Across</label><input type="text" id="cw-a-8"></div>
          <div class="clue-row"><label>9 Across</label><input type="text" id="cw-a-9"></div>
        </div>
        <div class="clue-section">
          <h4>Down clues</h4>
          <div class="clue-row"><label>1 Down</label><input type="text" id="cw-d-1"></div>
          <div class="clue-row"><label>2 Down</label><input type="text" id="cw-d-2"></div>
          <div class="clue-row"><label>3 Down</label><input type="text" id="cw-d-3"></div>
          <div class="clue-row"><label>4 Down</label><input type="text" id="cw-d-4"></div>
          <div class="clue-row"><label>5 Down</label><input type="text" id="cw-d-5"></div>
        </div>

        <div class="ed-error" id="cw-error"></div>
        <div class="ed-form-actions">
          <button class="btn-ghost" data-cancel>Cancel</button>
          <button class="btn-primary" id="cw-save">Save</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Connections modal -->
  <div class="ed-modal-overlay" id="cn-modal" role="dialog" aria-modal="true" aria-labelledby="cn-modal-title">
    <div class="ed-modal">
      <button class="ed-modal-close">×</button>
      <h2 id="cn-modal-title">Add a Connections puzzle</h2>
      <div class="ed-form">
        <p class="ed-tip">Four groups of four words. Each group gets a category name and a difficulty (yellow = easiest, purple = hardest). Words will be shuffled before the reader sees them.</p>
        <div class="cn-group-edit" data-color="yellow" data-difficulty="yellow">
          <h4 style="margin:14px 0 8px;"><span style="display:inline-block;width:14px;height:14px;background:#f9df6d;margin-right:6px;vertical-align:middle;"></span>Yellow (easiest)</h4>
          <label>Category <input type="text" data-cn-cat="yellow" placeholder="e.g., Parts of a frog"></label>
          <label>Four words, separated by commas <input type="text" data-cn-words="yellow" placeholder="LEG, EYE, TONGUE, TOE"></label>
        </div>
        <div class="cn-group-edit" data-color="green" data-difficulty="green">
          <h4 style="margin:14px 0 8px;"><span style="display:inline-block;width:14px;height:14px;background:#a0c35a;margin-right:6px;vertical-align:middle;"></span>Green</h4>
          <label>Category <input type="text" data-cn-cat="green"></label>
          <label>Four words <input type="text" data-cn-words="green"></label>
        </div>
        <div class="cn-group-edit" data-color="blue" data-difficulty="blue">
          <h4 style="margin:14px 0 8px;"><span style="display:inline-block;width:14px;height:14px;background:#b0c4ef;margin-right:6px;vertical-align:middle;"></span>Blue</h4>
          <label>Category <input type="text" data-cn-cat="blue"></label>
          <label>Four words <input type="text" data-cn-words="blue"></label>
        </div>
        <div class="cn-group-edit" data-color="purple" data-difficulty="purple">
          <h4 style="margin:14px 0 8px;"><span style="display:inline-block;width:14px;height:14px;background:#ba81c5;margin-right:6px;vertical-align:middle;"></span>Purple (hardest)</h4>
          <label>Category <input type="text" data-cn-cat="purple"></label>
          <label>Four words <input type="text" data-cn-words="purple"></label>
        </div>
        <div class="ed-error" id="cn-error"></div>
        <div class="ed-form-actions">
          <button class="btn-ghost" data-cancel>Cancel</button>
          <button class="btn-primary" id="cn-save">Save</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Word Search modal -->
  <div class="ed-modal-overlay" id="ws-modal" role="dialog" aria-modal="true" aria-labelledby="ws-modal-title">
    <div class="ed-modal">
      <button class="ed-modal-close">×</button>
      <h2 id="ws-modal-title">Add a Word Search puzzle</h2>
      <div class="ed-form">
        <p class="ed-tip">One word or phrase per line (or separate them with commas). Shown to the player exactly as typed. Only the letters go in the grid (spaces and punctuation are ignored). Keep each to 16 letters or fewer so it fits.</p>
        <label>Words
          <textarea id="ws-words" rows="14" placeholder="Cherry Blossoms&#10;April Fools Day&#10;Bees&#10;Sunshine&#10;..."></textarea>
        </label>
        <div class="ed-error" id="ws-error"></div>
        <div class="ed-form-actions">
          <button class="btn-ghost" data-cancel>Cancel</button>
          <button class="btn-primary" id="ws-save">Save</button>
        </div>
      </div>
    </div>
  </div>`;

  // Also defined in the Centerspread editor's own list rendering; kept here so
  // the component stands alone in any host.
  const CN_COLORS = ["yellow", "green", "blue", "purple"];
  const wsGridForm = (w) => String(w).toUpperCase().replace(/[^A-Z0-9]/g, "");

  let built = false;
  let onSaveCallback = null;
  const api = {};

  function notifyHost() { if (onSaveCallback) onSaveCallback(); }

  function build() {
    if (built) return;
    const host = document.createElement("div");
    host.innerHTML = MARKUP;
    const mine = Array.from(host.children);
    mine.forEach(el => document.body.appendChild(el));

    // Close only this component's modals, never a host's.
    function closeModals() { mine.forEach(m => m.classList.remove("visible")); }

    mine.forEach(m => {
      m.querySelectorAll(".ed-modal-close, [data-cancel]").forEach(b => b.addEventListener("click", closeModals));
      m.addEventListener("click", e => { if (e.target === m) closeModals(); });
      m.addEventListener("keydown", (e) => {
        if (e.key === "Escape") { closeModals(); return; }
        if (e.key !== "Tab") return;
        if (!m.classList.contains("visible")) return;
        const f = m.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (f.length === 0) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      });
    });

    let beeEditingIndex = null;
    function openBeeModal(i) {
      beeEditingIndex = (typeof i === "number") ? i : null;
      document.getElementById("bee-modal-title").textContent = beeEditingIndex === null ? "Add a Spelling Bee puzzle" : "Edit Spelling Bee puzzle";
      if (beeEditingIndex !== null) {
        const p = WLPuzzles.getBeePool()[beeEditingIndex];
        document.getElementById("bee-center").value = p.center || "";
        document.getElementById("bee-outer").value = (p.outer || []).join("");
        document.getElementById("bee-words").value = (p.words || []).join("\n");
      } else {
        document.getElementById("bee-center").value = "";
        document.getElementById("bee-outer").value = "";
        document.getElementById("bee-words").value = "";
      }
      document.getElementById("bee-error").textContent = "";
      document.getElementById("bee-modal").classList.add("visible");
      setTimeout(() => document.getElementById("bee-center").focus(), 50);
    }
    document.getElementById("bee-save").addEventListener("click", () => {
      const center = (document.getElementById("bee-center").value || "").trim().toUpperCase();
      const outer = (document.getElementById("bee-outer").value || "").trim().toUpperCase().split("").filter(Boolean);
      const wordsRaw = document.getElementById("bee-words").value || "";
      const words = wordsRaw.split(/\r?\n/).map(w => w.trim().toUpperCase()).filter(Boolean);
      const err = document.getElementById("bee-error");
      err.textContent = "";
      if (!/^[A-Z]$/.test(center)) { err.textContent = "Center must be a single letter."; return; }
      if (outer.length !== 6 || !outer.every(l => /^[A-Z]$/.test(l))) { err.textContent = "Outer must be 6 letters."; return; }
      if (new Set([center, ...outer]).size !== 7) { err.textContent = "All 7 letters must be different."; return; }
      if (words.length === 0) { err.textContent = "Add at least one valid word."; return; }
      // Validate words against constraints
      const allowed = new Set([center, ...outer]);
      const bad = words.find(w => w.length < 4 || !w.includes(center) || [...w].some(c => !allowed.has(c)));
      if (bad) { err.textContent = `"${bad}" is invalid. Words must be ≥4 letters, contain the center, and only use the 7 letters.`; return; }

      const entry = { center, outer, words };
      if (beeEditingIndex === null) { WLPuzzles.addBee(entry); if (WLPuzzles.setActive) WLPuzzles.setActive("bee", WLPuzzles.getBeePool().length - 1); }
      else WLPuzzles.setBeeAt(beeEditingIndex, entry);
      closeModals();
      notifyHost();
    });
    let cwEditingIndex = null;
    function openCwModal(i) {
      cwEditingIndex = (typeof i === "number") ? i : null;
      document.getElementById("cw-modal-title").textContent = cwEditingIndex === null ? "Add a Mini Crossword" : "Edit Mini Crossword";
      const rowInputs = document.querySelectorAll(".cw-row");
      if (cwEditingIndex !== null) {
        const p = WLPuzzles.getCrosswordPool()[cwEditingIndex];
        p.rows.forEach((r, ri) => { rowInputs[ri].value = r; });
        ["1","6","7","8","9"].forEach(n => document.getElementById(`cw-a-${n}`).value = (p.across && p.across[n]) || "");
        ["1","2","3","4","5"].forEach(n => document.getElementById(`cw-d-${n}`).value = (p.down && p.down[n]) || "");
      } else {
        rowInputs.forEach(el => el.value = "");
        ["1","6","7","8","9"].forEach(n => document.getElementById(`cw-a-${n}`).value = "");
        ["1","2","3","4","5"].forEach(n => document.getElementById(`cw-d-${n}`).value = "");
      }
      document.getElementById("cw-error").textContent = "";
      document.getElementById("cw-modal").classList.add("visible");
      setTimeout(() => rowInputs[0].focus(), 50);
    }
    document.getElementById("cw-save").addEventListener("click", () => {
      const rows = [];
      document.querySelectorAll(".cw-row").forEach(el => rows.push((el.value || "").trim().toUpperCase()));
      const err = document.getElementById("cw-error");
      err.textContent = "";
      if (!rows.every(r => /^[A-Z]{5}$/.test(r))) { err.textContent = "Each row must be exactly 5 letters."; return; }
      const across = {};
      const down = {};
      ["1","6","7","8","9"].forEach(n => {
        const v = document.getElementById(`cw-a-${n}`).value.trim();
        if (v) across[n] = v;
      });
      ["1","2","3","4","5"].forEach(n => {
        const v = document.getElementById(`cw-d-${n}`).value.trim();
        if (v) down[n] = v;
      });
      if (Object.keys(across).length !== 5 || Object.keys(down).length !== 5) {
        err.textContent = "Fill in all 5 across and 5 down clues.";
        return;
      }

      const entry = { rows, across, down };
      if (cwEditingIndex === null) { WLPuzzles.addCrossword(entry); if (WLPuzzles.setActive) WLPuzzles.setActive("crossword", WLPuzzles.getCrosswordPool().length - 1); }
      else WLPuzzles.setCrosswordAt(cwEditingIndex, entry);
      closeModals();
      notifyHost();
    });
    let cnEditingIndex = null;
    function openConnectionsModal(i) {
      cnEditingIndex = (typeof i === "number") ? i : null;
      const entry = cnEditingIndex !== null ? WLPuzzles.getConnectionsPool()[cnEditingIndex] : null;
      document.getElementById("cn-modal-title").textContent = cnEditingIndex === null ? "Add a Connections puzzle" : "Edit Connections puzzle";
      document.getElementById("cn-error").textContent = "";
      CN_COLORS.forEach(color => {
        const group = entry ? entry.groups.find(g => g.difficulty === color) : null;
        document.querySelector(`[data-cn-cat="${color}"]`).value   = group ? (group.category || "") : "";
        document.querySelector(`[data-cn-words="${color}"]`).value = group ? (group.words || []).join(", ") : "";
      });
      document.getElementById("cn-modal").classList.add("visible");
      setTimeout(() => document.querySelector('[data-cn-cat="yellow"]').focus(), 50);
    }
    document.getElementById("cn-save").addEventListener("click", () => {
      const err = document.getElementById("cn-error");
      err.textContent = "";
      const groups = [];
      const seen = new Set();
      for (const color of CN_COLORS) {
        const cat   = document.querySelector(`[data-cn-cat="${color}"]`).value.trim();
        const words = document.querySelector(`[data-cn-words="${color}"]`).value
          .split(",").map(w => w.trim().toUpperCase()).filter(Boolean);
        if (!cat) { err.textContent = `Category is required for the ${color} group.`; return; }
        if (words.length !== 4) { err.textContent = `${color} group needs exactly 4 words.`; return; }
        for (const w of words) {
          if (seen.has(w)) { err.textContent = `"${w}" appears in more than one group.`; return; }
          seen.add(w);
        }
        groups.push({ difficulty: color, category: cat, words });
      }
      const entry = { groups };
      if (cnEditingIndex === null) { WLPuzzles.addConnections(entry); if (WLPuzzles.setActive) WLPuzzles.setActive("connections", WLPuzzles.getConnectionsPool().length - 1); }
      else WLPuzzles.setConnectionsAt(cnEditingIndex, entry);
      closeModals();
      notifyHost();
    });
    let wsEditingIndex = null;
    function openWordsearchModal(i) {
      wsEditingIndex = (typeof i === "number") ? i : null;
      const entry = wsEditingIndex !== null ? WLPuzzles.getWordsearchPool()[wsEditingIndex] : null;
      document.getElementById("ws-modal-title").textContent = wsEditingIndex === null ? "Add a Word Search puzzle" : "Edit Word Search puzzle";
      document.getElementById("ws-error").textContent = "";
      document.getElementById("ws-words").value = entry ? (entry.words || []).join("\n") : "";
      document.getElementById("ws-modal").classList.add("visible");
      setTimeout(() => document.getElementById("ws-words").focus(), 50);
    }
    document.getElementById("ws-save").addEventListener("click", () => {
      const err = document.getElementById("ws-error"); err.textContent = "";
      const words = document.getElementById("ws-words").value.split(/[\n,]+/).map(w => w.trim()).filter(Boolean);
      const valid = words.filter(w => wsGridForm(w).length >= 2);
      if (valid.length < 3) { err.textContent = "Enter at least 3 words \u2014 one per line, or separated by commas."; return; }
      const tooLong = valid.find(w => wsGridForm(w).length > 16);
      if (tooLong) { err.textContent = `"${tooLong}" is too long. Keep words to 16 letters or fewer.`; return; }
      const entry = { words: valid };
      if (wsEditingIndex === null) { WLPuzzles.addWordsearch(entry); if (WLPuzzles.setActive) WLPuzzles.setActive("wordsearch", WLPuzzles.getWordsearchPool().length - 1); }
      else WLPuzzles.setWordsearchAt(wsEditingIndex, entry);
      closeModals();
      notifyHost();
    });

    api.bee = openBeeModal;
    api.crossword = openCwModal;
    api.connections = openConnectionsModal;
    api.wordsearch = openWordsearchModal;
    built = true;
  }

  function entry(kind) {
    return function (index, opts) {
      if (index && typeof index === "object") { opts = index; index = undefined; }
      build();
      onSaveCallback = (opts && typeof opts.onSave === "function") ? opts.onSave : null;
      return api[kind](index);
    };
  }

  return {
    openBee: entry("bee"),
    openCrossword: entry("crossword"),
    openConnections: entry("connections"),
    openWordsearch: entry("wordsearch")
  };
})();
