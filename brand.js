// ============================================================================
//  BRAND — applies the paper's branding to every page: theme colors, favicon,
//  masthead name, dateline, the masthead flourish, page titles, and the footer.
//
//  Values come from WLBrand.get() — the config.js defaults merged with anything
//  a school saved in the Design dashboard (editor-brand.html). Load in <head>
//  after config.js and brand-store.js, so colors apply before first paint and
//  before text-editor.js stamps its defaults.
//
//  To change the defaults in code, edit config.js — not this file.
// ============================================================================
(function () {
  var root = document.documentElement;

  function config() {
    return window.WLBrand ? window.WLBrand.get() : (window.WL_CONFIG || {});
  }

  var cfg = config();

  var COLOR_KEYS = ["ink", "muted", "rule", "paper", "cream", "accent"];
  var FONT_KEYS = ["display", "serif", "sans", "name"];

  // 1) Colors — immediately, before first paint (documentElement exists in <head>).
  function setColors() {
    var c = cfg.colors || {};
    COLOR_KEYS.forEach(function (k) {
      if (c[k]) root.style.setProperty("--" + k, c[k]);
    });
  }
  setColors();

  // Fonts — the picker sets --font-display / -serif / -sans; unset keys keep the
  // stylesheet's :root defaults, so an override is only ever what changed.
  function setFonts() {
    var f = cfg.fonts || {};
    FONT_KEYS.forEach(function (k) {
      if (f[k]) root.style.setProperty("--font-" + k, f[k]);
    });
  }
  setFonts();

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function autoInitials() {
    return (cfg.name || "")
      .replace(/^The\s+/i, "")
      .split(/\s+/).map(function (w) { return w[0] || ""; }).join("")
      .slice(0, 2).toUpperCase() || "N";
  }

  function faviconHref() {
    var f = cfg.favicon;
    if (!f) return null;
    if (typeof f === "string") return f;                       // a file path
    var initials = f.initials || autoInitials();
    var bg = f.bg || (cfg.colors && cfg.colors.accent) || "#2e7d32";
    var fg = f.fg || "#ffffff";
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<rect width="64" height="64" fill="' + esc(bg) + '"/>' +
      '<text x="32" y="45" text-anchor="middle" font-family="Georgia, serif" font-size="34" ' +
      'font-weight="700" letter-spacing="-1" fill="' + esc(fg) + '">' + esc(initials) + '</text></svg>';
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }

  function faviconType(href) {
    var data = /^data:(image\/[a-z0-9.+-]+)/i.exec(href);   // an uploaded file
    if (data) return data[1].toLowerCase();
    var ext = /\.([a-z0-9]+)$/i.exec(href);                 // a path in the repo
    if (!ext) return "image/svg+xml";
    var e = ext[1].toLowerCase();
    if (e === "svg") return "image/svg+xml";
    if (e === "jpg" || e === "jpeg") return "image/jpeg";
    if (e === "ico") return "image/x-icon";
    return "image/" + e;
  }

  function setFavicon() {
    var href = faviconHref();
    if (!href) return;
    var link = document.querySelector('link[rel="icon"]');
    if (!link) { link = document.createElement("link"); link.setAttribute("rel", "icon"); document.head.appendChild(link); }
    link.setAttribute("type", faviconType(href));
    link.setAttribute("href", href);
  }

  var IMAGE_FILE = /\.(svg|png|jpe?g|webp|avif)$/i;

  // Accepts the { file, width, mirror, opacity } object, or a bare string that
  // is a file path, an emoji, or inline SVG markup.
  function ornamentSettings() {
    var o = cfg.ornament;
    if (o == null) return null;
    if (typeof o === "string") o = { file: o };
    if (typeof o !== "object") return null;
    return {
      file: typeof o.file === "string" ? o.file.trim() : "",
      width: Number(o.width) > 0 ? Number(o.width) : 72,
      mirror: o.mirror !== false,
      opacity: Number(o.opacity) >= 0 ? Number(o.opacity) : 0.55,
    };
  }

  function setOrnament() {
    var s = ornamentSettings();
    if (!s) return;
    var slots = document.querySelectorAll(".masthead-ornament");
    if (!slots.length) return;

    // No file (or explicitly cleared) → hide both slots.
    if (!s.file) {
      slots.forEach(function (o) { o.style.display = "none"; });
      return;
    }

    root.style.setProperty("--ornament-width", s.width + "px");
    root.style.setProperty("--ornament-opacity", String(s.opacity));

    // An uploaded flourish is a data: URL — no extension to match on.
    var isMarkup = /^\s*</.test(s.file);
    var isImage = !isMarkup && (IMAGE_FILE.test(s.file) || /^data:image\//i.test(s.file));

    slots.forEach(function (o) {
      o.style.display = "";
      o.classList.toggle("no-mirror", !s.mirror);

      if (isImage) {
        var img = o.querySelector("img") || o.appendChild(document.createElement("img"));
        img.setAttribute("alt", "");
        if (img.getAttribute("src") !== s.file) img.setAttribute("src", s.file);
        // The school's art has its own proportions — let width drive height
        // rather than the markup's baked-in 60×30 attributes.
        img.removeAttribute("width");
        img.removeAttribute("height");
        return;
      }

      if (isMarkup) { o.innerHTML = s.file; return; }
      o.textContent = s.file;            // an emoji or plain-text flourish
    });
  }

  // The title to substitute the paper name into, kept so re-applying after a
  // Design save renames from the original rather than from the previously-
  // substituted name.
  //
  // This script runs while the head is parsing, so the snapshot below is the
  // page's static <title>. But article/writer/tag/team/video/section pages set
  // a title of their own from an inline script, and those run before the
  // DOMContentLoaded that triggers apply() — re-applying the head snapshot then
  // threw the real one away, leaving every story tab reading just the paper
  // name. So `titleWritten` records what this script last set: if the title no
  // longer matches, a page set its own and that becomes the new base.
  var titleBase = document.title;
  var titleWritten = titleBase;

  // The strings to substitute the configured name and school into.
  //
  // Pages ship carrying the template's placeholders, but `npm run brand` writes
  // the real name into each <head> so link previews and crawlers — which never
  // run this script — read the right paper. A stamped page records what it was
  // stamped with on <html data-wl-name/-school>, and that becomes the string to
  // replace when an editor renames the paper from the Design tab.
  //
  // Both are swapped: the stamped value for a stamped <head>, the placeholder
  // for the inline body scripts, which are deliberately left unstamped.
  var PLACEHOLDER_NAME = "The Student Times";
  var PLACEHOLDER_SCHOOL = "Your School";
  var docEl = document.documentElement;
  var BASE_NAME = (docEl && docEl.getAttribute("data-wl-name")) || PLACEHOLDER_NAME;
  var BASE_SCHOOL = (docEl && docEl.getAttribute("data-wl-school")) || PLACEHOLDER_SCHOOL;

  function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  // A function replacement keeps "$&"/"$1" intact in a paper name literal.
  function swapOne(text, froms, to) {
    if (!to) return text;
    var out = text;
    froms.forEach(function (from) {
      if (!from) return;
      out = out.replace(new RegExp(escapeRe(from), "g"), function () { return to; });
    });
    return out;
  }

  function swapBrand(text) {
    var out = swapOne(text, [BASE_NAME, PLACEHOLDER_NAME], cfg.name);
    return swapOne(out, [BASE_SCHOOL, PLACEHOLDER_SCHOOL], cfg.school);
  }

  function setTitle() {
    if (!cfg.name) return;
    if (document.title !== titleWritten) titleBase = document.title;
    if (!titleBase) return;
    titleWritten = swapBrand(titleBase);
    document.title = titleWritten;
  }

  // Meta tags carry placeholder names in their content; snapshot the originals
  // so re-applying (after a Design save) substitutes from the template text,
  // not from an already-branded value.
  var META_SELECTOR = 'meta[name="description"], meta[name="twitter:title"], ' +
    'meta[name="twitter:description"], meta[property="og:title"], ' +
    'meta[property="og:description"], meta[property="og:site_name"]';
  var metaBase = null;
  function snapshotMeta() {
    metaBase = [];
    document.querySelectorAll(META_SELECTOR).forEach(function (m) {
      metaBase.push({ el: m, content: m.getAttribute("content") || "" });
    });
  }

  function rebrandMeta() {
    if (!metaBase) snapshotMeta();
    metaBase.forEach(function (rec) {
      rec.el.setAttribute("content", swapBrand(rec.content));
    });
  }

  // Opt-in body text: any element tagged data-wl-brand carries a placeholder
  // name in its own text (e.g. a puzzle byline that reads "By The Student Times
  // Puzzle Team"). Snapshot the originals so re-applying substitutes from the
  // template text, then swap the same tokens the meta tags use. This is how
  // JS-static strings the masthead/footer pass never touches get the real name.
  var textBase = null;
  function snapshotText() {
    textBase = [];
    document.querySelectorAll("[data-wl-brand]").forEach(function (elm) {
      textBase.push({ el: elm, text: elm.textContent });
    });
  }
  function rebrandText() {
    if (!textBase) snapshotText();
    textBase.forEach(function (rec) {
      rec.el.textContent = swapBrand(rec.text);
    });
  }

  function apply() {
    setFavicon();

    // Masthead name (the <h1> usually wraps an <a href="index.html">).
    if (cfg.name) {
      document.querySelectorAll(".masthead h1").forEach(function (h) {
        var a = h.querySelector("a");
        if (a) a.textContent = cfg.name; else h.textContent = cfg.name;
      });
    }
    setTitle();

    // Share/SEO metadata. Pages ship with placeholder names ("The Student
    // Times", "Your School"); swap those for the real paper so og:/twitter tags
    // and the description are correct when a story is shared. Article pages set
    // their own og: tags later (their inline script runs after this), so this
    // is just the sensible default for every page.
    rebrandMeta();

    // Body-text strings tagged data-wl-brand (e.g. the puzzle byline).
    rebrandText();

    // Dateline: SCHOOL · TAGLINE (uniform across pages).
    var parts = [cfg.school, cfg.tagline].filter(Boolean).map(function (x) { return String(x).toUpperCase(); });
    if (parts.length) {
      var dl = parts.join("  ·  ");
      document.querySelectorAll(".dateline").forEach(function (d) {
        // Datelines tagged data-wl-text are owned by text-editor.js, which
        // re-stamps its own default over anything we write here. Hand it the
        // branded text as that default rather than fight it — an editor's
        // explicit inline edit still wins over the config.
        if (d.hasAttribute("data-wl-text")) {
          d.dataset.wlTextDefault = dl;
          var override = window.WLText ? WLText.get(d.dataset.wlText) : null;
          if (override == null) d.textContent = dl;
          return;
        }
        d.textContent = dl;
      });
    }

    // The flourish beside the masthead. A school swaps in its own art by
    // dropping a file in media/ and naming it in cfg.ornament.file — the art
    // keeps its own colors and must never be tinted by the accent.
    setOrnament();

    // Footer (copyright + contacts).
    var foot = document.querySelector("footer");
    if (foot) {
      var year = new Date().getFullYear();
      var contacts = (cfg.contacts || []).map(function (x) {
        return esc(x.title) + ': <a href="mailto:' + esc(x.email) + '">' + esc(x.email) + "</a>";
      }).join(" &nbsp;·&nbsp; ");
      foot.innerHTML =
        "© " + year + " " + esc(cfg.name || "") + " · " + esc(cfg.school || "") + " " + esc(cfg.footerNote || "") +
        ' · <a href="staff.html">Staff</a>' +
        (contacts ? "<br>" + contacts : "");
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
  else apply();

  // Re-render when the Design dashboard saves, so the editor sees the change
  // immediately — including on a page open in another tab (storage event).
  function refresh() { cfg = config(); setColors(); setFonts(); apply(); }
  document.addEventListener("wl-brand-change", refresh);
  window.addEventListener("storage", function (e) {
    if (e.key === "wl_brand") refresh();
  });
})();
