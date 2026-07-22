// Keyboard behaviour for the editor pages' own modals.
//
// The shared components (article-editor.js, sports-editor.js,
// puzzle-editor.js) each trap Tab inside their own modal. The modals written
// directly into the editor pages did not, so tabbing past the last field
// escaped to the page behind the overlay and left the focus ring on something
// the user could not see — the situation WCAG 2.4.11 exists to prevent.
//
// Include this on any page with .ed-modal-overlay markup. It watches for
// modals becoming visible, so it works with markup added after load.

(function () {
  "use strict";

  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), ' +
                    'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  let lastFocused = null;

  function visibleModal() {
    return document.querySelector(".ed-modal-overlay.visible");
  }

  function focusablesIn(modal) {
    return [...modal.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null || el === document.activeElement);
  }

  // Trap Tab, and close on Escape, for whichever modal is currently open.
  document.addEventListener("keydown", function (e) {
    const modal = visibleModal();
    if (!modal) return;

    if (e.key === "Escape") {
      const closer = modal.querySelector(".ed-modal-close, [data-cancel]");
      if (closer) closer.click();
      return;
    }
    if (e.key !== "Tab") return;

    const items = focusablesIn(modal);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];

    // Focus outside the open modal (or on the page behind it) is pulled back in.
    if (!modal.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
      return;
    }
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }, true);

  // Move focus into a modal when it opens, and back to the trigger when it closes.
  const seen = new WeakSet();
  const observer = new MutationObserver(function (records) {
    for (const record of records) {
      const el = record.target;
      if (!el.classList || !el.classList.contains("ed-modal-overlay")) continue;

      if (el.classList.contains("visible") && !seen.has(el)) {
        seen.add(el);
        if (!el.contains(document.activeElement)) lastFocused = document.activeElement;
        const items = focusablesIn(el);
        // Prefer the first real field over the close button.
        const target = items.find(i => !i.classList.contains("ed-modal-close")) || items[0];
        if (target) setTimeout(() => target.focus(), 0);
      } else if (!el.classList.contains("visible") && seen.has(el)) {
        seen.delete(el);
        if (lastFocused && lastFocused.focus) lastFocused.focus();
        lastFocused = null;
      }
    }
  });

  document.addEventListener("DOMContentLoaded", function () {
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  });
})();
