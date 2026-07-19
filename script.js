// The paper's identity for the bits of chrome this file draws (splash screen,
// dateline). Read from the brand store so the Design tab's live changes apply;
// falls back to config.js, then to generic defaults if neither is present.
function wlBrand() {
  if (window.WLBrand) return window.WLBrand.get();
  return window.WL_CONFIG || {};
}

// Skip-to-main-content link (auto-injected on every page)
(function () {
  if (!document.body) return;
  if (document.querySelector(".skip-link")) return;
  const link = document.createElement("a");
  link.className = "skip-link";
  link.href = "#main-content";
  link.textContent = "Skip to main content";
  document.body.insertBefore(link, document.body.firstChild);
  const main = document.querySelector("main");
  if (main && !main.id) main.id = "main-content";
})();

// Splash screen — shown once per browser session. Skipped for users who
// prefer reduced motion.
(function () {
  if (sessionStorage.getItem("wl_splash_seen")) return;
  sessionStorage.setItem("wl_splash_seen", "1");
  if (!document.body) return;

  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) return;

  const splash = document.createElement("div");
  splash.className = "wl-splash";
  splash.setAttribute("aria-hidden", "true");

  // The watermark word fades in on top. Below it, the paper's name types out
  // letter by letter — each character is its own span with a staggered
  // animation-delay. Once both are on screen, the whole stack scales up
  // (toward the viewer) and fades to transparent. Both come from config.js
  // (splashMark, name), so the demo and template share this exact code.
  const brand = wlBrand();
  const title = brand.name || "The Student Times";
  const mark = brand.splashMark || "PRESS";
  const TYPE_START = 1.0;   // seconds before the first letter appears
  const TYPE_STEP  = 0.07;  // seconds between each letter
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const letters = [...title].map((ch, i) => {
    const delay = (TYPE_START + i * TYPE_STEP).toFixed(3);
    if (ch === " ") return `<span class="wl-splash-space" style="animation-delay:${delay}s;">&nbsp;</span>`;
    return `<span class="wl-splash-letter" style="animation-delay:${delay}s;">${esc(ch)}</span>`;
  }).join("");

  splash.innerHTML = `
    <div class="wl-splash-stack">
      <div class="wl-splash-mark">${esc(mark)}</div>
      <div class="wl-splash-sub" aria-label="${esc(title)}">${letters}</div>
    </div>
  `;
  document.body.appendChild(splash);

  // The last letter lands at TYPE_START + (n-1)*TYPE_STEP + 0.25s of animation.
  // Derive the hold from the title length so a longer paper name isn't cut off
  // mid-type, then fade out ~0.35s after it settles.
  const lastLetter = (TYPE_START + Math.max(0, title.length - 1) * TYPE_STEP + 0.25) * 1000;
  const fadeAt = lastLetter + 350;
  setTimeout(() => splash.classList.add("fade-out"), fadeAt);
  setTimeout(() => { if (splash.parentNode) splash.remove(); }, fadeAt + 800);
})();

// Dynamic dateline: today's date in the masthead. brand.js/text-editor.js own
// datelines tagged data-wl-text; this only fills a plain .dateline that nothing
// else has set, and it takes the school name from config rather than hardcoding.
document.addEventListener("DOMContentLoaded", () => {
  const dateEl = document.querySelector(".dateline:not([data-wl-text])");
  if (dateEl) {
    const now = new Date();
    const formatted = now.toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    }).toUpperCase();
    const school = (wlBrand().school || "Your School").toUpperCase();
    dateEl.innerHTML = `${formatted} &nbsp;·&nbsp; ${school}`;
  }
});

// Breaking news popup — shows once per session; keyboard accessible
document.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("breaking-popup");
  const banner = document.getElementById("breaking-banner");
  const closeBtn = document.getElementById("popup-close");

  if (!overlay) return;

  let lastFocused = null;

  const open = () => {
    lastFocused = document.activeElement;
    overlay.classList.add("visible");
    // Move focus to the close button so screen readers announce the dialog
    setTimeout(() => closeBtn?.focus(), 10);
  };

  const close = () => {
    overlay.classList.remove("visible");
    sessionStorage.setItem("breakingSeen", "1");
    // Return focus to whatever triggered the dialog
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  };

  const alreadySeen = sessionStorage.getItem("breakingSeen");
  if (!alreadySeen) setTimeout(open, 600);

  closeBtn?.addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  banner?.addEventListener("click", open);
  banner?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("visible")) close();
  });
});
