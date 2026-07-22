// Builds the section nav on every page from WLSections, so adding, renaming,
// removing, or reordering a section in the editor updates the nav site-wide.
// The nav is: Home · [editor-managed sections, including the built-in
// Centerspread and Video pages] · Search.
window.WLNav = (function () {
  let activeSection = null; // article pages set this via setActive()

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function currentFile() {
    return (location.pathname.split("/").pop() || "index.html") || "index.html";
  }

  function build() {
    const inner = document.querySelector(".sectionnav-inner");
    if (!inner || !window.WLSections) return;

    const file = currentFile();
    const qsName = new URLSearchParams(location.search).get("name");

    const items = [{
      label: "Home", href: "index.html", section: null,
      active: file === "index.html" && !activeSection,
    }];

    WLSections.navSections().forEach(s => {
      let active;
      if (activeSection) {
        active = s.name === activeSection;
      } else if (file === "section.html") {
        active = qsName === s.name;
      } else {
        // A section on its original static page (e.g. news.html), or a built-in
        // page's alternate file (e.g. video.html for Video).
        active = (!s.page.startsWith("section.html") && file === s.page) ||
                 (Array.isArray(s.alt) && s.alt.includes(file));
      }
      items.push({ label: s.name, href: s.page, section: s.name, active });
    });

    let html = items.map(it =>
      `<a href="${esc(it.href)}"` +
      (it.section ? ` data-section="${esc(it.section)}"` : "") +
      (it.active ? ` class="active"` : "") +
      `>${esc(it.label)}</a>`
    ).join("\n");

    html += `\n<a href="search.html" class="search-link${file === "search.html" ? " active" : ""}" aria-label="Search">🔍</a>`;

    inner.innerHTML = html;
  }

  // Called by article pages, which know their section only after loading data.
  function setActive(section) {
    activeSection = section;
    build();
  }

  document.addEventListener("DOMContentLoaded", build);
  document.addEventListener("wl-sections-change", build);

  return { build, setActive };
})();
