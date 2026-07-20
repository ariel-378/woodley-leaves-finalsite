// ============================================================================
//  ►►► BRAND CONFIG — this is the ONLY file that differs from the template. ◄◄◄
//
//  The Woodley Leaves is the Maret School demo of the newspaper template. The
//  code (every .js and .html file) is identical to newspaper-template/; this
//  file plus the content files (articles.js, teams.js, staff, etc.) are what
//  make it Maret's paper. Everything below is applied across every page by
//  brand.js: the masthead name, school, colors, leaf, favicon, and footer.
// ============================================================================
window.WL_CONFIG = {
  // ── Names ────────────────────────────────────────────────────────────────
  name: "The Woodley Leaves",     // the masthead headline (and browser tab)
  school: "Maret School",         // shown in the dateline under the masthead
  tagline: "Student Press",
  splashMark: "MARET",            // the big word behind the name on the opening splash

  // ── Colors ───────────────────────────────────────────────────────────────
  //  `accent` is the school color (masthead rule, links, active nav).
  colors: {
    ink:    "#121212",   // main text
    muted:  "#666666",   // secondary text
    rule:   "#e2e2e2",   // hairline borders
    paper:  "#ffffff",   // page background
    cream:  "#f7f5ef",   // panel background
    accent: "#2e7d32",   // Woodley green
  },

  // ── The leaf flourish beside the masthead ────────────────────────────────
  //  Named for Woodley Park. Keeps its own green regardless of `accent`.
  ornament: {
    file: "media/leaf.svg",
    width: 72,
    mirror: true,
    opacity: 0.55,
  },

  // ── Favicon (the little tab icon) ─────────────────────────────────────────
  favicon: { initials: "WL", bg: "#2e7d32", fg: "#ffffff" },

  // ── Footer contacts ──────────────────────────────────────────────────────
  contacts: [
    { title: "Online Editor-in-Chief", email: "arielp2027@maret.org" },
    { title: "Online Managing Editor", email: "farrynb2027@maret.org" },
  ],
  footerNote: "Student Publication",

  // ── Sports ───────────────────────────────────────────────────────────────
  //  Our team's name as it appears in the bracket data (teams.js).
  homeTeam: "Maret",

  // ── Where reader submissions go ──────────────────────────────────────────
  //  Newsletter signups, staff signups, and story pitches go to a Google Sheet
  //  via a Google Apps Script web app. Follow setup/README.md, then paste the
  //  web-app URL here. Until it's filled in, those forms tell readers
  //  submissions aren't set up and offer email instead — nothing is discarded.
  submissions: {
    endpoint: "",                          // ← paste the Apps Script web-app URL
    fallbackEmail: "arielp2027@maret.org", // used if a send fails
  },
};
