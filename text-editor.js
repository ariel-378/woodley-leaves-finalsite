// Inline editor for static editorial text (section kickers, decks, datelines).
// Any element tagged with `data-wl-text="<key>"` becomes editable when signed
// in as an editor: click it, type, and it saves on blur. Overrides persist in
// localStorage and apply to every reader on this browser.
// Non-editors see the element as plain text — no styling changes.
window.WLText = (function () {
  const LS = "wl_text_custom";

  function read() {
    try { return JSON.parse(localStorage.getItem(LS) || "{}"); }
    catch { return {}; }
  }
  function write(obj) {
    localStorage.setItem(LS, JSON.stringify(obj));
    document.dispatchEvent(new CustomEvent("wl-text-change"));
  }

  function get(key) { return read()[key]; }
  function set(key, value) { const d = read(); d[key] = value; write(d); }
  function remove(key) { const d = read(); if (key in d) { delete d[key]; write(d); } }
  function reset() { localStorage.removeItem(LS); document.dispatchEvent(new CustomEvent("wl-text-change")); }

  // Stamp each tagged element's default text (once) so we can restore on
  // clear. Then overlay any saved override.
  function apply() {
    const data = read();
    document.querySelectorAll("[data-wl-text]").forEach(el => {
      const key = el.dataset.wlText;
      if (!el.dataset.wlTextDefault) {
        el.dataset.wlTextDefault = el.textContent;
      }
      const override = data[key];
      if (override != null) el.textContent = override;
      else el.textContent = el.dataset.wlTextDefault;
    });
  }

  function onFocus(e) {
    // Select-all on focus for easy replace.
    const el = e.currentTarget;
    requestAnimationFrame(() => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
  }
  function onBlur(e) {
    const el = e.currentTarget;
    const newVal = el.textContent.replace(/\s+/g, " ").trim();
    const def = (el.dataset.wlTextDefault || "").trim();
    if (newVal === "" || newVal === def) {
      remove(el.dataset.wlText);
      el.textContent = def;
    } else {
      set(el.dataset.wlText, newVal);
      el.textContent = newVal;
    }
  }
  function onKey(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      const el = e.currentTarget;
      const saved = get(el.dataset.wlText);
      el.textContent = saved != null ? saved : (el.dataset.wlTextDefault || "");
      el.blur();
    }
  }

  function setupEditor() {
    const isEditor = window.WLAuth && WLAuth.isEditor();
    document.querySelectorAll("[data-wl-text]").forEach(el => {
      if (isEditor) {
        el.setAttribute("contenteditable", "plaintext-only");
        el.setAttribute("spellcheck", "true");
        el.setAttribute("title", "Click to edit — press Enter to save, Esc to cancel");
        el.classList.add("wl-text-editable");
        if (!el._wlTextBound) {
          el.addEventListener("focus", onFocus);
          el.addEventListener("blur", onBlur);
          el.addEventListener("keydown", onKey);
          el._wlTextBound = true;
        }
      } else {
        el.removeAttribute("contenteditable");
        el.removeAttribute("spellcheck");
        el.removeAttribute("title");
        el.classList.remove("wl-text-editable");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => { apply(); setupEditor(); });
  document.addEventListener("wl-auth-change", setupEditor);
  document.addEventListener("wl-text-change", apply);

  return { get, set, remove, reset, apply };
})();
