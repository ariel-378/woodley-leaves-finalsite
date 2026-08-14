// Generic in-place layout editor with row + column grid building.
// Any element tagged `data-move-key` inside a container tagged
// `data-move-group` becomes draggable. Rows hold one or more columns, and each
// column can stack multiple blocks vertically. Drop targets:
//   - LEFT / RIGHT edge of a block  -> create a new column in that row
//   - TOP  / BOTTOM edge of a block  -> stack above/below within the column
//   - Horizontal gap between rows    -> start a new row
// Layouts persist in localStorage per page + group.
(function () {
  const PAGE_KEY = (document.body && document.body.dataset.layoutPage) ||
    (location.pathname.split("/").pop().replace(/\.html$/, "") || "page");

  const LAYOUT_KEY = g => `wl_layout_${PAGE_KEY}_${g}`;
  const LEGACY_ORDER_KEY = g => `wl_order_${PAGE_KEY}_${g}`;

  // Internal format: rows -> columns -> keys  (string[][][])
  function normalizeToColRows(parsed) {
    if (!Array.isArray(parsed)) return null;
    if (parsed.length === 0) return [];
    // Already row-of-columns-of-keys: [[[k]]]
    if (Array.isArray(parsed[0]) && Array.isArray(parsed[0][0])) {
      return parsed
        .map(row => row.filter(col => Array.isArray(col) && col.length > 0))
        .filter(row => row.length > 0);
    }
    // Flat row-of-keys (legacy): [[k1, k2]]  -> wrap each key in its own column
    if (Array.isArray(parsed[0]) && typeof parsed[0][0] === "string") {
      return parsed.map(row => row.map(k => [k]));
    }
    return null;
  }

  function loadRows(groupKey) {
    try {
      const raw = localStorage.getItem(LAYOUT_KEY(groupKey));
      if (raw) {
        const parsed = JSON.parse(raw);
        const normalized = normalizeToColRows(parsed);
        if (normalized) return normalized;
      }
      // Upgrade legacy flat-order format
      const legacy = localStorage.getItem(LEGACY_ORDER_KEY(groupKey));
      if (legacy) {
        const arr = JSON.parse(legacy);
        if (Array.isArray(arr)) return arr.map(k => [[k]]);
      }
    } catch {}
    return null;
  }

  function saveGroup(group) {
    const groupKey = group.dataset.moveGroup;
    if (!groupKey) return;
    const rows = [];
    group.querySelectorAll(":scope > .wl-row").forEach(rowEl => {
      const cols = [];
      rowEl.querySelectorAll(":scope > .wl-col").forEach(colEl => {
        const keys = [...colEl.children]
          .filter(c => c.dataset && c.dataset.moveKey)
          .map(c => c.dataset.moveKey);
        if (keys.length > 0) cols.push(keys);
      });
      if (cols.length > 0) rows.push(cols);
    });
    try { localStorage.setItem(LAYOUT_KEY(groupKey), JSON.stringify(rows)); } catch {}
  }

  // Read the initial row layout from the DOM as the page's default.
  // Supports three authoring styles in the source HTML:
  //   <group><key/><key/></group>                              (each key in own row)
  //   <group><row><key/><key/></row></group>                   (each key in own column)
  //   <group><row><col><key/><key/></col><col><key/></col></row></group>
  const initialLayouts = new Map();
  function initialRows(group) {
    const groupKey = group.dataset.moveGroup;
    if (initialLayouts.has(groupKey)) return initialLayouts.get(groupKey);
    const rows = [];
    const preWrapped = group.querySelectorAll(":scope > .wl-row");
    if (preWrapped.length > 0) {
      preWrapped.forEach(r => {
        const cols = [];
        const colEls = r.querySelectorAll(":scope > .wl-col");
        if (colEls.length > 0) {
          colEls.forEach(c => {
            const keys = [...c.children]
              .filter(ch => ch.dataset && ch.dataset.moveKey)
              .map(ch => ch.dataset.moveKey);
            if (keys.length > 0) cols.push(keys);
          });
        } else {
          [...r.children].forEach(c => {
            if (c.dataset && c.dataset.moveKey) cols.push([c.dataset.moveKey]);
          });
        }
        if (cols.length > 0) rows.push(cols);
      });
    } else {
      [...group.children].forEach(el => {
        if (el.dataset && el.dataset.moveKey) rows.push([[el.dataset.moveKey]]);
      });
    }
    initialLayouts.set(groupKey, rows);
    return rows;
  }

  // Rebuild a group from its (saved or default) layout, creating .wl-row and
  // .wl-col wrappers and placing each [data-move-key] element inside its cell.
  function applyGroup(group) {
    const groupKey = group.dataset.moveGroup;
    if (!groupKey) return;

    const defaultRows = initialRows(group);

    // Collect every movable element regardless of current nesting depth.
    const byKey = new Map();
    group.querySelectorAll(":scope > [data-move-key], :scope > .wl-row > [data-move-key], :scope > .wl-row > .wl-col > [data-move-key]").forEach(el => {
      if (el.dataset.moveKey) byKey.set(el.dataset.moveKey, el);
    });
    if (byKey.size === 0) return;

    let rows = loadRows(groupKey) || defaultRows;

    // Append any newly-added blocks (not in saved layout) as single-cell rows.
    const placed = new Set();
    rows.forEach(row => row.forEach(col => col.forEach(k => placed.add(k))));
    byKey.forEach((_, k) => { if (!placed.has(k)) rows.push([[k]]); });

    // Drop keys that no longer exist in the DOM; prune empty cols/rows.
    rows = rows
      .map(row => row.map(col => col.filter(k => byKey.has(k))).filter(col => col.length > 0))
      .filter(row => row.length > 0);

    // Tear down existing wrappers and detach movable elements.
    group.querySelectorAll(":scope > .wl-row, :scope > .wl-row-gap").forEach(r => r.remove());
    byKey.forEach(el => { if (el.parentNode) el.parentNode.removeChild(el); });

    // Rebuild row / col / element structure.
    rows.forEach(row => {
      const rowEl = document.createElement("div");
      rowEl.className = "wl-row" + (row.length === 1 ? " wl-row-single" : " wl-row-multi");
      row.forEach(col => {
        const colEl = document.createElement("div");
        colEl.className = "wl-col" + (col.length > 1 ? " wl-col-stacked" : "");
        col.forEach(key => {
          const el = byKey.get(key);
          if (el) colEl.appendChild(el);
        });
        if (colEl.querySelector(":scope > .article-list")) colEl.classList.add("wl-col-wide");
        if (isAdOnlyColumn(colEl)) colEl.classList.add("wl-col-ad");
        rowEl.appendChild(colEl);
      });
      group.appendChild(rowEl);
    });
  }

  function applyAll() {
    document.querySelectorAll("[data-move-group]").forEach(applyGroup);
  }

  // A column is "ad-only" if every block inside is a .sidebar-ads/.ad-block.
  // These get a narrow sidebar max-width in CSS; other columns flex normally.
  function isAdOnlyColumn(colEl) {
    const kids = [...colEl.children].filter(c => c.dataset && c.dataset.moveKey);
    if (kids.length === 0) return false;
    return kids.every(c => c.classList.contains("sidebar-ads") || c.classList.contains("ad-block"));
  }

  // ===== Row-gap drop zones (create a new row between existing rows) =====
  function refreshRowGaps(group) {
    group.querySelectorAll(":scope > .wl-row-gap").forEach(g => g.remove());
    const rows = [...group.querySelectorAll(":scope > .wl-row")];
    // Add a gap before the first row and after every row.
    const first = document.createElement("div");
    first.className = "wl-row-gap";
    first.dataset.gapIndex = "0";
    group.insertBefore(first, rows[0] || null);
    rows.forEach((r, i) => {
      const gap = document.createElement("div");
      gap.className = "wl-row-gap";
      gap.dataset.gapIndex = String(i + 1);
      r.parentNode.insertBefore(gap, r.nextSibling);
    });
    group.querySelectorAll(":scope > .wl-row-gap").forEach(g => {
      if (!g._wlGapBound) {
        g.addEventListener("dragover", onGapOver);
        g.addEventListener("dragleave", onGapLeave);
        g.addEventListener("drop", onGapDrop);
        g._wlGapBound = true;
      }
    });
  }
  function refreshAllRowGaps() {
    document.querySelectorAll("[data-move-group]").forEach(refreshRowGaps);
  }

  // ===== Controls overlay + drag-and-drop =====
  let draggingEl = null;
  let indicator = null;

  function ensureIndicator() {
    if (indicator) return;
    indicator = document.createElement("div");
    indicator.className = "wl-drop-indicator";
    document.body.appendChild(indicator);
  }
  function hideIndicator() {
    if (indicator) indicator.style.display = "none";
  }
  function showIndicator(el, edge) {
    ensureIndicator();
    const rect = el.getBoundingClientRect();
    const style = indicator.style;
    style.display = "block";
    if (edge === "left") {
      style.left = (rect.left - 3) + "px";
      style.top = rect.top + "px";
      style.width = "4px";
      style.height = rect.height + "px";
    } else if (edge === "right") {
      style.left = (rect.right - 1) + "px";
      style.top = rect.top + "px";
      style.width = "4px";
      style.height = rect.height + "px";
    } else if (edge === "top") {
      style.left = rect.left + "px";
      style.top = (rect.top - 3) + "px";
      style.width = rect.width + "px";
      style.height = "4px";
    } else {
      style.left = rect.left + "px";
      style.top = (rect.bottom - 1) + "px";
      style.width = rect.width + "px";
      style.height = "4px";
    }
  }

  function getEdge(e, el) {
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dL = x / rect.width;
    const dR = 1 - dL;
    const dT = y / rect.height;
    const dB = 1 - dT;
    const min = Math.min(dL, dR, dT, dB);
    if (min === dL) return "left";
    if (min === dR) return "right";
    if (min === dT) return "top";
    return "bottom";
  }

  function addControlsTo(el) {
    if (el.querySelector(":scope > .wl-move-controls")) return;
    const controls = document.createElement("div");
    controls.className = "wl-move-controls";
    const label = el.dataset.moveLabel || el.dataset.moveKey || "block";
    // Dragging is a pointer gesture with no keyboard equivalent, so the same
    // reordering is offered as buttons. Without these, an editor who cannot use
    // a mouse could not rearrange the page at all.
    controls.innerHTML = `
      <span class="wl-move-label">${label}</span>
      <button type="button" class="wl-mc-btn" data-move-dir="up" aria-label="Move ${label} earlier">↑</button>
      <button type="button" class="wl-mc-btn" data-move-dir="down" aria-label="Move ${label} later">↓</button>
      <span class="wl-mc-handle" aria-hidden="true" title="Drag to reorder">⋮⋮</span>
    `;
    controls.querySelectorAll("[data-move-dir]").forEach(b => {
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        moveByKeyboard(el, b.dataset.moveDir);
      });
    });
    el.appendChild(controls);
  }

  // Move a block one position earlier or later in the group's reading order,
  // then reuse the drag path's own cleanup so the result is saved identically.
  function moveByKeyboard(el, dir) {
    const group = el.closest("[data-move-group]");
    if (!group) return;
    const blocks = [...group.querySelectorAll("[data-move-key]")];
    const i = blocks.indexOf(el);
    const j = dir === "up" ? i - 1 : i + 1;
    if (i === -1 || j < 0 || j >= blocks.length) return;

    const neighbour = blocks[j];
    const sourceCol = el.parentNode;
    const sourceRow = sourceCol && sourceCol.parentNode;

    sourceCol.removeChild(el);
    if (dir === "up") neighbour.parentNode.insertBefore(el, neighbour);
    else neighbour.parentNode.insertBefore(el, neighbour.nextSibling);

    finalizeDrop(group, sourceCol, sourceRow);
    // Keep focus on the button the editor just pressed, so repeated presses work.
    const again = el.querySelector(`[data-move-dir="${dir}"]`);
    if (again) again.focus();
  }

  function setupControls() {
    document.querySelectorAll("[data-move-group] [data-move-key]").forEach(el => {
      addControlsTo(el);
      el.setAttribute("draggable", "true");
      el.classList.add("wl-movable");
      if (!el._wlBound) {
        el.addEventListener("dragstart", onDragStart);
        el.addEventListener("dragover", onDragOver);
        el.addEventListener("dragleave", onDragLeave);
        el.addEventListener("drop", onDrop);
        el.addEventListener("dragend", onDragEnd);
        el._wlBound = true;
      }
    });
    refreshAllRowGaps();
  }

  function teardownControls() {
    document.querySelectorAll("[data-move-key]").forEach(el => {
      el.removeAttribute("draggable");
      el.classList.remove("wl-movable", "wl-dragging");
    });
    document.querySelectorAll(".wl-row-gap").forEach(g => g.remove());
    hideIndicator();
  }

  function onDragStart(e) {
    draggingEl = e.currentTarget;
    draggingEl.classList.add("wl-dragging");
    try {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", draggingEl.dataset.moveKey);
    } catch {}
  }
  function onDragOver(e) {
    if (!draggingEl) return;
    const target = e.currentTarget;
    if (target === draggingEl) return;
    const targetCol = target.parentNode;
    const targetRow = targetCol && targetCol.parentNode;
    const sourceCol = draggingEl.parentNode;
    const sourceRow = sourceCol && sourceCol.parentNode;
    if (!targetRow || !targetRow.classList.contains("wl-row")) return;
    const group = targetRow.parentNode;
    if (!sourceRow || sourceRow.parentNode !== group) return; // same group only
    e.preventDefault();
    try { e.dataTransfer.dropEffect = "move"; } catch {}
    const edge = getEdge(e, target);
    showIndicator(target, edge);
  }
  function onDragLeave() { /* handled by onDragEnd */ }
  function onDrop(e) {
    if (!draggingEl) return;
    e.preventDefault();
    const target = e.currentTarget;
    if (target === draggingEl) { cleanup(); return; }
    const targetCol = target.parentNode;
    const targetRow = targetCol && targetCol.parentNode;
    const sourceCol = draggingEl.parentNode;
    const sourceRow = sourceCol && sourceCol.parentNode;
    if (!targetRow || !targetRow.classList.contains("wl-row")) { cleanup(); return; }
    const group = targetRow.parentNode;
    if (!group || !group.dataset.moveGroup) { cleanup(); return; }
    if (!sourceRow || sourceRow.parentNode !== group) { cleanup(); return; }

    const edge = getEdge(e, target);
    sourceCol.removeChild(draggingEl);

    if (edge === "left") {
      const newCol = document.createElement("div");
      newCol.className = "wl-col";
      newCol.appendChild(draggingEl);
      targetRow.insertBefore(newCol, targetCol);
    } else if (edge === "right") {
      const newCol = document.createElement("div");
      newCol.className = "wl-col";
      newCol.appendChild(draggingEl);
      targetRow.insertBefore(newCol, targetCol.nextSibling);
    } else if (edge === "top") {
      targetCol.insertBefore(draggingEl, target);
    } else { // bottom
      targetCol.insertBefore(draggingEl, target.nextSibling);
    }

    finalizeDrop(group, sourceCol, sourceRow);
  }
  function onDragEnd() { cleanup(); }

  // ===== New-row drop on row-gap =====
  function onGapOver(e) {
    if (!draggingEl) return;
    const gap = e.currentTarget;
    const group = gap.parentNode;
    const sourceCol = draggingEl.parentNode;
    const sourceRow = sourceCol && sourceCol.parentNode;
    if (!sourceRow || sourceRow.parentNode !== group) return;
    e.preventDefault();
    try { e.dataTransfer.dropEffect = "move"; } catch {}
    gap.classList.add("wl-row-gap-active");
    // Show indicator as a horizontal bar across the gap
    ensureIndicator();
    const rect = gap.getBoundingClientRect();
    indicator.style.display = "block";
    indicator.style.left = rect.left + "px";
    indicator.style.top = (rect.top + rect.height / 2 - 2) + "px";
    indicator.style.width = rect.width + "px";
    indicator.style.height = "4px";
  }
  function onGapLeave(e) {
    e.currentTarget.classList.remove("wl-row-gap-active");
  }
  function onGapDrop(e) {
    if (!draggingEl) return;
    e.preventDefault();
    const gap = e.currentTarget;
    const group = gap.parentNode;
    const sourceCol = draggingEl.parentNode;
    const sourceRow = sourceCol && sourceCol.parentNode;
    if (!sourceRow || sourceRow.parentNode !== group) { cleanup(); return; }

    sourceCol.removeChild(draggingEl);
    const newRow = document.createElement("div");
    newRow.className = "wl-row wl-row-single";
    const newCol = document.createElement("div");
    newCol.className = "wl-col";
    newCol.appendChild(draggingEl);
    newRow.appendChild(newCol);
    group.insertBefore(newRow, gap.nextSibling);

    finalizeDrop(group, sourceCol, sourceRow);
  }

  function finalizeDrop(group, sourceCol, sourceRow) {
    // Prune empty source column
    if (sourceCol && sourceCol.children.length === 0 && sourceCol.parentNode) {
      sourceCol.parentNode.removeChild(sourceCol);
    }
    // Prune empty source row
    if (sourceRow && sourceRow.children.length === 0 && sourceRow.parentNode) {
      sourceRow.parentNode.removeChild(sourceRow);
    }
    // Refresh classes everywhere in the group
    group.querySelectorAll(":scope > .wl-row").forEach(r => {
      const cols = r.querySelectorAll(":scope > .wl-col");
      r.classList.toggle("wl-row-single", cols.length === 1);
      r.classList.toggle("wl-row-multi",  cols.length !== 1);
      cols.forEach(c => {
        c.classList.toggle("wl-col-stacked", c.children.length > 1);
        c.classList.toggle("wl-col-wide", !!c.querySelector(":scope > .article-list"));
        c.classList.toggle("wl-col-ad", isAdOnlyColumn(c));
      });
    });
    saveGroup(group);
    refreshRowGaps(group);
    cleanup();
  }

  function cleanup() {
    if (draggingEl) draggingEl.classList.remove("wl-dragging");
    draggingEl = null;
    document.querySelectorAll(".wl-row-gap-active").forEach(g => g.classList.remove("wl-row-gap-active"));
    hideIndicator();
  }

  // ===== Reset button =====
  function makeResetButton() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "wl-layout-reset";
    btn.id = "wl-layout-reset";
    btn.textContent = "Reset";
    btn.addEventListener("click", () => {
      if (!confirm("Reset this page's layout to defaults?")) return;
      document.querySelectorAll("[data-move-group]").forEach(g => {
        try {
          localStorage.removeItem(LAYOUT_KEY(g.dataset.moveGroup));
          localStorage.removeItem(LEGACY_ORDER_KEY(g.dataset.moveGroup));
        } catch {}
      });
      applyAll();
      setupControls();
    });
    return btn;
  }

  // ===== Toggle button (editors only) =====
  function setupToggle() {
    const isEditor = window.WLAuth && WLAuth.isEditor();
    let btn = document.getElementById("wl-layout-toggle");
    let resetBtn = document.getElementById("wl-layout-reset");
    // One block is not an arrangement. Section pages have only their article
  // list now that ads live on the front page alone, so offering to rearrange
  // them would open an editor with nothing to drag.
  const hasMovable = document.querySelectorAll("[data-move-key]").length > 1;

    if (!isEditor || !hasMovable) {
      if (btn) btn.remove();
      if (resetBtn) resetBtn.remove();
      document.body.classList.remove("wl-layout-edit");
      teardownControls();
      return;
    }
    if (btn) return;

    btn = document.createElement("button");
    btn.id = "wl-layout-toggle";
    btn.className = "wl-layout-toggle";
    btn.type = "button";
    btn.textContent = "Edit layout";
    btn.addEventListener("click", () => {
      const on = document.body.classList.toggle("wl-layout-edit");
      btn.textContent = on ? "Done editing" : "Edit layout";
      if (on) setupControls();
      else teardownControls();
      let r = document.getElementById("wl-layout-reset");
      if (on && !r) document.body.appendChild(makeResetButton());
      else if (!on && r) r.remove();
    });
    document.body.appendChild(btn);
  }

  applyAll();

  document.addEventListener("DOMContentLoaded", () => {
    applyAll();
    setupToggle();
  });
  document.addEventListener("wl-auth-change", setupToggle);
})();
