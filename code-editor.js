// Shared editor for the two kinds of editor-written code.
//
//   WLCodeEditor.open({ kind: "game",    id, onSave })   -> WLGamesStore
//   WLCodeEditor.open({ kind: "feature", id, onSave })   -> WLFeatures
//
// Both are a title plus a self-contained HTML document, so they share one form.
// What differs is only where the result goes and where readers see it:
//
//   game     lives with the puzzles on the Centerspread
//   feature  lives on whichever section declares "Custom feature" — a comic
//            strip, a photo essay, an embedded map, a poll
//
// Pass no id to create rather than edit. Code always runs in a sandboxed
// iframe with no same-origin access, both in the preview here and on the
// published page.

window.WLCodeEditor = (function () {
  "use strict";

  const KINDS = {
    game: {
      noun: "game",
      title: "game",
      store: () => window.WLGamesStore,
      where: "It appears on the Centerspread, under the puzzles.",
      example: [
        "<!doctype html>",
        "<html>",
        "  <head>",
        "    <style>",
        "      body { font-family: Georgia, serif; text-align: center; padding: 24px; }",
        "      button { font-size: 18px; padding: 10px 18px; cursor: pointer; }",
        "      #score { font-size: 40px; font-weight: bold; margin: 16px 0; }",
        "    </style>",
        "  </head>",
        "  <body>",
        "    <p>Click the button as many times as you can.</p>",
        "    <div id=\"score\">0</div>",
        "    <button id=\"go\">Click me</button>",
        "    <script>",
        "      let n = 0;",
        "      const score = document.getElementById('score');",
        "      document.getElementById('go').addEventListener('click', () => {",
        "        n++;",
        "        score.textContent = n;",
        "      });",
        "    <\/script>",
        "  </body>",
        "</html>",
      ].join("\n"),
    },
    feature: {
      noun: "feature",
      title: "custom feature",
      store: () => window.WLFeatures,
      where: "It appears on every section that lists “Custom feature” as one of its content types.",
      example: [
        "<!doctype html>",
        "<html>",
        "  <head>",
        "    <style>",
        "      body { font-family: Georgia, serif; margin: 0; padding: 16px; }",
        "      .strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }",
        "      .panel { border: 1px solid #ddd; padding: 12px; min-height: 140px; }",
        "      .panel p { font-size: 14px; line-height: 1.4; }",
        "      @media (max-width: 600px) { .strip { grid-template-columns: 1fr; } }",
        "    </style>",
        "  </head>",
        "  <body>",
        "    <!-- A three-panel comic. Swap the text for <img> tags to use drawings. -->",
        "    <div class=\"strip\">",
        "      <div class=\"panel\"><p>Panel one.</p></div>",
        "      <div class=\"panel\"><p>Panel two.</p></div>",
        "      <div class=\"panel\"><p>Panel three.</p></div>",
        "    </div>",
        "  </body>",
        "</html>",
      ].join("\n"),
    },
  };

  const MARKUP = `
  <div class="ed-modal-overlay" id="code-modal" role="dialog" aria-modal="true" aria-labelledby="code-modal-title">
    <div class="ed-modal" role="document">
      <button class="ed-modal-close" aria-label="Close">&times;</button>
      <h2 id="code-modal-title">Add a game</h2>
      <p class="ed-tip" id="code-where"></p>
      <div class="ed-form">
        <label>Title
          <input type="text" id="code-title" maxlength="120">
        </label>
        <div class="ed-form-row">
          <label>Kicker (optional)
            <input type="text" id="code-kicker" maxlength="60">
          </label>
          <label>Height on the page (pixels)
            <input type="text" id="code-height" maxlength="5" placeholder="500">
          </label>
          <label>Publish date &amp; time <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--muted);">(leave blank to publish now; set a future time to schedule)</span>
            <input type="datetime-local" id="code-publish">
          </label>
        </div>
        <label>Short description (optional)
          <input type="text" id="code-desc" maxlength="200">
        </label>
        <label>Code
          <textarea id="code-code" rows="18" spellcheck="false"></textarea>
        </label>
        <p class="cc-hint">One self-contained HTML document: markup, <code>&lt;style&gt;</code> and
          <code>&lt;script&gt;</code> together. It runs in a sandbox, so it cannot affect the rest of
          the site — and equally cannot read anything from it.</p>
        <div style="margin:6px 0 12px;">
          <button type="button" class="btn-ghost" id="code-preview-btn">Preview</button>
          <span style="font-size:12px;color:var(--muted);margin-left:8px;">Runs the code below. Nothing is saved yet.</span>
        </div>
        <div id="code-preview-wrap" style="display:none;margin-bottom:12px;"></div>
        <div class="ed-error" id="code-error" role="alert"></div>
        <div class="ed-form-actions">
          <button class="btn-ghost" data-cancel type="button">Cancel</button>
          <button class="btn-primary" id="code-save" type="button">Save</button>
        </div>
      </div>
    </div>
  </div>`;

  let built = false;
  let modal, kind, editingId, onSaveCallback, lastFocused;

  const $ = id => document.getElementById(id);

  function slugify(s) {
    return String(s).toLowerCase().trim()
      .replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 60);
  }

  function build() {
    if (built) return;
    const host = document.createElement("div");
    host.innerHTML = MARKUP;
    modal = host.firstElementChild;
    document.body.appendChild(modal);

    modal.querySelectorAll(".ed-modal-close, [data-cancel]").forEach(b =>
      b.addEventListener("click", close));
    modal.addEventListener("click", e => { if (e.target === modal) close(); });
    $("code-preview-btn").addEventListener("click", preview);
    $("code-save").addEventListener("click", save);
    built = true;
  }

  function preview() {
    const wrap = $("code-preview-wrap");
    wrap.innerHTML = "";
    const frame = document.createElement("iframe");
    // Same sandbox as the published page: scripts may run, but the frame gets
    // no same-origin access, so it cannot reach the dashboard around it.
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("title", "Preview");
    frame.style.width = "100%";
    frame.style.height = (parseInt($("code-height").value, 10) || 500) + "px";
    frame.style.border = "1px solid var(--rule)";
    frame.srcdoc = $("code-code").value;
    wrap.appendChild(frame);
    wrap.style.display = "block";
  }

  let owningSection = null;

  function open(opts) {
    opts = opts || {};
    kind = KINDS[opts.kind] ? opts.kind : "feature";
    const spec = KINDS[kind];
    lastFocused = document.activeElement;
    build();

    onSaveCallback = typeof opts.onSave === "function" ? opts.onSave : null;
    editingId = opts.id || null;
    // Which section this belongs to. A new one belongs where it was added from;
    // an edited one keeps whoever already owns it.
    owningSection = opts.section || null;

    const existing = editingId ? spec.store().get(editingId) : null;
    $("code-modal-title").textContent = existing ? `Edit ${spec.title}` : `Add a ${spec.title}`;
    $("code-where").textContent = spec.where;
    $("code-title").value = existing ? (existing.title || "") : "";
    $("code-publish").value = existing ? (existing.publishAt || "") : "";
    $("code-kicker").value = existing ? (existing.kicker || "") : "";
    $("code-desc").value = existing ? (existing.description || "") : "";
    $("code-height").value = existing ? (existing.height || 500) : 500;
    $("code-code").value = existing ? (existing.code || "") : spec.example;
    $("code-error").textContent = "";
    $("code-preview-wrap").style.display = "none";
    $("code-preview-wrap").innerHTML = "";

    modal.classList.add("visible");
    setTimeout(() => $("code-title").focus(), 50);
  }

  function close() {
    if (!modal) return;
    modal.classList.remove("visible");
    // Stop any preview still running behind the closed modal.
    $("code-preview-wrap").innerHTML = "";
    if (lastFocused && lastFocused.focus) lastFocused.focus();
    lastFocused = null;
  }

  function save() {
    const spec = KINDS[kind];
    const err = $("code-error");
    err.textContent = "";

    const title = $("code-title").value.trim();
    if (!title) { err.textContent = `Give the ${spec.noun} a title.`; return; }

    const code = $("code-code").value.trim();
    if (!code) { err.textContent = "Add the code."; return; }

    const store = spec.store();
    let id = editingId;
    if (!id) {
      const taken = store.getAll().map(x => x.id);
      const base = slugify(title) || spec.noun;
      id = base;
      for (let n = 2; taken.indexOf(id) !== -1; n++) id = base + "-" + n;
    }

    const record = { id: id, title: title, code: code };
    const existingRecord = editingId ? store.get(editingId) : null;
    const owner = (existingRecord && existingRecord.section) || owningSection;
    if (owner) record.section = owner;

    const pubAt = $("code-publish").value.trim();
    if (pubAt) record.publishAt = pubAt;
    const kicker = $("code-kicker").value.trim();
    const desc = $("code-desc").value.trim();
    const height = parseInt($("code-height").value, 10);
    if (kicker) record.kicker = kicker;
    if (desc) record.description = desc;
    record.height = height > 0 ? height : 500;

    if (store.save(record) === false) {
      err.textContent = "Could not save. Your browser storage may be full.";
      return;
    }
    close();
    if (onSaveCallback) onSaveCallback(id);
  }

  return { open: open, close: close };
})();
