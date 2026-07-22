// Editor-chosen order of stories on the homepage. A saved array of article ids
// determines which story fills each slot (hero, left rail, right rail, then
// "more"); anything not listed falls in afterwards, newest first. No saved
// order means the homepage runs newest-first automatically.
window.WLHomeOrder = (function () {
  const LS = "wl_home_order";
  function get() {
    try { const v = JSON.parse(localStorage.getItem(LS)); return Array.isArray(v) ? v : null; }
    catch { return null; }
  }
  function set(ids) {
    localStorage.setItem(LS, JSON.stringify(ids));
    document.dispatchEvent(new CustomEvent("wl-home-order-change"));
  }
  function clear() {
    localStorage.removeItem(LS);
    document.dispatchEvent(new CustomEvent("wl-home-order-change"));
  }
  return { get, set, clear };
})();
