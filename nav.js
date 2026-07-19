// Builds the section nav on every page from WLSections, so adding, renaming,
// removing, or reordering a section in the editor updates the nav site-wide.
// The nav is: Home · [editor-managed sections] · Centerspread · Video · Search.
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
        // A section still on its original static page (e.g. news.html).
        active = !s.page.startsWith("section.html") && file === s.page;
      }
      items.push({ label: s.name, href: s.page, section: s.name, active });
    });

    items.push({ label: "Centerspread", href: "centerspread.html", section: null, active: file === "centerspread.html" });
    items.push({ label: "Video", href: "videos.html", section: null, active: file === "videos.html" || file === "video.html" });

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
