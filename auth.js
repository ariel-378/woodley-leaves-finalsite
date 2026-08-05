// Student Times — identity adapter. Renders the account bar and decides
// who sees editor tools; the host platform does the authenticating.
//
// IDENTITY MODEL
//  • HOSTED (production): the host platform (e.g. Finalsite) authenticates the
//    school community and injects, before this script runs:
//        window.WL_CONTEXT = { signedIn: true,
//                              user: { name: "Jane Doe", id: "jdoe" },
//                              role: "editor" | "reader" };
//    Who may SEE the paper ("students & faculty only") is enforced by the host's
//    page-audience restriction. Who is an EDITOR is the host role a school
//    administrator assigns, mapped to role:"editor". We simply trust WL_CONTEXT.
//  • STANDALONE (demo/preview): no context is injected, so we fall back to
//    per-browser demo accounts in localStorage, plus a one-click "editor preview"
//    so the dashboard can be shown without the host. No codes, nothing secure.

(function () {
  const LS_PREVIEW = "wl_preview_role"; // demo only: "editor" forces editor preview

  // Identity injected by the host platform (Finalsite). Present only in production.
  const CTX = window.WL_CONTEXT || null;
  const HOSTED = !!(CTX && CTX.signedIn);

  // Resolve the active identity. In hosted mode the host is the source of truth.
  // In standalone/demo mode the only identity is the one-click "editor preview" —
  // there is no in-app reader or editor sign-in (Finalsite handles all login).
  // Returns { hosted, user, role }; user/role are null when nobody is signed in.
  function resolved() {
    if (HOSTED) {
      const name = (CTX.user && (CTX.user.name || CTX.user.id)) || "Member";
      return { hosted: true, user: name, role: CTX.role === "editor" ? "editor" : "reader" };
    }
    if (localStorage.getItem(LS_PREVIEW) === "editor") {
      return { hosted: false, user: "Editor Preview", role: "editor" };
    }
    return { hosted: false, user: null, role: null };
  }

  // ===== Public API =====
  const WLAuth = {
    hosted: HOSTED,
    currentUser() { return resolved().user; },
    isEditor() { return resolved().role === "editor"; },

    // Demo-only: flip in/out of the editor experience without the host platform.
    // In production, editor rights come from the school-assigned role (WL_CONTEXT).
    enableEditorPreview() {
      if (HOSTED) return;
      localStorage.setItem(LS_PREVIEW, "editor");
      renderTopbar();
    },
    disableEditorPreview() {
      localStorage.removeItem(LS_PREVIEW);
      renderTopbar();
    },
  };
  window.WLAuth = WLAuth;

  // ===== Topbar rendering =====
  function ensureTopbarSlot() {
    if (document.getElementById("wl-account")) return;
    const topInner = document.querySelector(".topbar-inner");
    if (!topInner) return;
    const right = topInner.children[topInner.children.length - 1];
    if (!right) return;
    if (right.textContent.trim() !== "") {
      right.appendChild(document.createTextNode(" · "));
    }
    const span = document.createElement("span");
    span.id = "wl-account";
    span.className = "topbar-account";
    right.appendChild(span);
  }

  function renderTopbar() {
    ensureTopbarSlot();
    const el = document.getElementById("wl-account");
    if (!el) return;
    const id = resolved();
    const parts = [];

    if (id.user) {
      parts.push(`<span class="topbar-user">${escapeHtml(id.user)}</span>`);
      if (id.role === "editor") {
        parts.push(`<a href="editor-content.html" class="wl-account-primary">Editor Dashboard</a>`);
      }
      if (!HOSTED) {
        parts.push(id.role === "editor"
          ? `<a href="#" id="wl-preview-off" class="wl-demo-link">Exit editor preview</a>`
          : `<a href="#" id="wl-preview-on" class="wl-demo-link">Preview as editor</a>`);
      }
    } else if (!HOSTED) {
      // Standalone demo: one-click editor preview. Reader login is handled by
      // the host platform (Finalsite) in production — there is no in-app sign-in.
      parts.push(`<a href="#" id="wl-preview-on" class="wl-demo-link">Editor preview</a>`);
    }
    // Hosted + not signed in: the host platform handles login, so show nothing.

    el.innerHTML = parts.join(" · ");

    const on = (elId, fn) => {
      const e = document.getElementById(elId);
      if (e) e.addEventListener("click", (ev) => { ev.preventDefault(); fn(); });
    };
    on("wl-preview-on", () => WLAuth.enableEditorPreview());
    on("wl-preview-off", () => WLAuth.disableEditorPreview());

    // fire a custom event so pages can re-render account / editor UI etc.
    document.dispatchEvent(new CustomEvent("wl-auth-change", { detail: { user: id.user, role: id.role } }));
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ===== Init =====
  document.addEventListener("DOMContentLoaded", () => {
    renderTopbar();
  });
})();
