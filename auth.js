// Student Times — identity adapter + reader features (comments, subscribe).
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
  const LS_CURRENT = "wl_current_user";
  const LS_USERS = "wl_users";
  const LS_PREVIEW = "wl_preview_role"; // demo only: "editor" forces editor preview

  // Identity injected by the host platform (Finalsite). Present only in production.
  const CTX = window.WL_CONTEXT || null;
  const HOSTED = !!(CTX && CTX.signedIn);

  function getUsers() {
    try { return JSON.parse(localStorage.getItem(LS_USERS) || "{}"); }
    catch { return {}; }
  }
  function saveUsers(u) { localStorage.setItem(LS_USERS, JSON.stringify(u)); }
  function getCurrentUser() { return localStorage.getItem(LS_CURRENT); }
  function setCurrentUser(u) {
    if (u) localStorage.setItem(LS_CURRENT, u);
    else localStorage.removeItem(LS_CURRENT);
  }

  // Resolve the active identity. In hosted mode the host is the source of truth;
  // in standalone/demo mode we use the localStorage account plus an optional
  // "editor preview" override. Returns { hosted, user, role } (user may be null).
  function resolved() {
    if (HOSTED) {
      const name = (CTX.user && (CTX.user.name || CTX.user.id)) || "Member";
      return { hosted: true, user: name, role: CTX.role === "editor" ? "editor" : "reader" };
    }
    if (localStorage.getItem(LS_PREVIEW) === "editor") {
      return { hosted: false, user: getCurrentUser() || "Editor Preview", role: "editor" };
    }
    const u = getCurrentUser();
    const ud = u ? (getUsers()[u] || null) : null;
    return { hosted: false, user: u, role: ud ? (ud.role || "reader") : null };
  }

  function defaultUserData() {
    return {
      password: "",
      role: "reader",          // "reader" or "editor"
      created: Date.now(),
    };
  }

  // ===== Public API =====
  const WLAuth = {
    hosted: HOSTED,
    currentUser() { return resolved().user; },

    signUp(username, password, opts) {
      opts = opts || {};
      username = (username || "").trim();
      if (!username) throw new Error("Username is required");
      if (!password) throw new Error("Password is required");
      if (username.length < 2) throw new Error("Username must be at least 2 characters");
      if (password.length < 4) throw new Error("Password must be at least 4 characters");
      const users = getUsers();
      if (users[username]) throw new Error("That username is taken");
      users[username] = defaultUserData();
      users[username].password = password;
      users[username].role = opts.role === "editor" ? "editor" : "reader";
      saveUsers(users);
      setCurrentUser(username);
      renderTopbar();
    },

    signIn(username, password, opts) {
      opts = opts || {};
      username = (username || "").trim();
      const users = getUsers();
      const user = users[username];
      if (!user) throw new Error("No account found with that username");
      if (user.password !== password) throw new Error("Incorrect password");
      if (opts.requireEditor && user.role !== "editor") {
        throw new Error("This account isn't an editor account. Use the regular sign-in.");
      }
      setCurrentUser(username);
      renderTopbar();
    },

    currentRole() { return resolved().role; },

    isEditor() { return resolved().role === "editor"; },

    signOut() {
      if (HOSTED) return; // host owns the session
      setCurrentUser(null);
      localStorage.removeItem(LS_PREVIEW);
      renderTopbar();
    },

    // Demo-only: flip in/out of the editor experience without the host platform.
    enableEditorPreview() {
      if (HOSTED) return;
      localStorage.setItem(LS_PREVIEW, "editor");
      renderTopbar();
    },
    disableEditorPreview() {
      localStorage.removeItem(LS_PREVIEW);
      renderTopbar();
    },

    // Reader login is handled by the host platform (Finalsite); there is no
    // in-app reader sign-in. Kept as no-ops so any legacy caller won't throw.
    showSignIn() {},
    showSignUp() {}
    // Editor rights come from the school-assigned role in production (WL_CONTEXT),
    // or from the demo-only editor preview (enableEditorPreview) when standalone.
    // There is no separate editor sign-in.
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
        parts.push(`<a href="editor.html" class="wl-account-primary">Editor Dashboard</a>`);
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

  // ===== Modal =====
  let modalLastFocused = null;

  function createModal() {
    const overlay = document.createElement("div");
    overlay.className = "wl-modal-overlay";
    overlay.id = "wl-modal-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Account");
    overlay.innerHTML = `
      <div class="wl-modal" role="document">
        <button class="wl-modal-close" id="wl-modal-close" aria-label="Close dialog">×</button>
        <div id="wl-modal-content"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) hideModal(); });
    document.getElementById("wl-modal-close").addEventListener("click", hideModal);

    // Focus trap + Escape to close
    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { hideModal(); return; }
      if (e.key !== "Tab") return;
      const focusables = overlay.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    });
  }

  // Reader sign-in/sign-up has been removed: the host platform (Finalsite)
  // authenticates readers in production. createModal()/hideModal() remain below
  // because the newsletter subscribe modal still uses them.
  function hideModal() {
    const o = document.getElementById("wl-modal-overlay");
    if (o) o.classList.remove("visible");
    // Restore focus to the element that triggered the modal
    if (modalLastFocused && modalLastFocused.focus) {
      modalLastFocused.focus();
      modalLastFocused = null;
    }
  }

  // ===== Newsletter subscribe =====
  const LS_SUBSCRIBERS = "wl_subscribers";

  function getSubscribers() {
    try { return JSON.parse(localStorage.getItem(LS_SUBSCRIBERS) || "[]"); }
    catch { return []; }
  }
  function saveSubscriber(entry) {
    const list = getSubscribers();
    list.push(entry);
    localStorage.setItem(LS_SUBSCRIBERS, JSON.stringify(list));
  }

  // Show why a send failed, with a mailto: escape hatch. Reader input must
  // never be reported as received when it wasn't.
  function showSendError(errEl, res) {
    errEl.textContent = WLSubmit.explain(res) + " ";
    if (res.mailto) {
      const a = document.createElement("a");
      a.href = res.mailto;
      a.textContent = "Email us instead";
      errEl.appendChild(a);
    }
  }

  function showSubscribeModal() {
    if (!document.getElementById("wl-modal-overlay")) createModal();
    const c = document.getElementById("wl-modal-content");
    c.innerHTML = `
      <h2>Weekly Newsletter</h2>
      <p class="wl-demo-note">Get The Student Times delivered every Friday. Enter your email, phone, or both.</p>
      <label>Email <input type="email" id="sub-email" placeholder="you@example.com" autocomplete="email"></label>
      <label>Phone <input type="tel" id="sub-phone" placeholder="(202) 555-0123" autocomplete="tel"></label>
      <div class="wl-hp" aria-hidden="true"><label>Leave this empty <input type="text" id="sub-hp" tabindex="-1" autocomplete="off"></label></div>
      <div class="wl-error" id="sub-err"></div>
      <button class="wl-submit" id="sub-go">Subscribe</button>
    `;
    document.getElementById("sub-go").addEventListener("click", async () => {
      const email = document.getElementById("sub-email").value.trim();
      const phone = document.getElementById("sub-phone").value.trim();
      const errEl = document.getElementById("sub-err");
      errEl.textContent = "";
      if (!email && !phone) { errEl.textContent = "Please enter your email, phone, or both."; return; }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errEl.textContent = "That email doesn't look right."; return;
      }
      if (phone && phone.replace(/\D/g, "").length < 10) {
        errEl.textContent = "Please enter a valid phone number."; return;
      }
      const btn = document.getElementById("sub-go");
      btn.disabled = true; btn.textContent = "Sending…";
      const res = await WLSubmit.send("subscribe", { email, phone },
        { honeypot: !!(document.getElementById("sub-hp") || {}).value });
      btn.disabled = false; btn.textContent = "Subscribe";
      if (!res.ok) { showSendError(errEl, res); return; }
      saveSubscriber({ email, phone, joinedAt: Date.now() });
      const delivery = email && phone ? "by email, with a text reminder"
                      : phone ? "by text"
                      : "by email";
      c.innerHTML = `
        <h2>You're on the list</h2>
        <p style="color:#333; font-size:14px; margin: 6px 0 16px;">Thanks — you'll get the next Friday edition of The Student Times ${delivery}.</p>
        <button class="wl-submit" id="sub-close">Close</button>
      `;
      document.getElementById("sub-close").addEventListener("click", hideModal);
    });
    ["sub-email", "sub-phone"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("keydown", e => {
        if (e.key === "Enter") document.getElementById("sub-go").click();
      });
    });
    document.getElementById("wl-modal-overlay").classList.add("visible");
    document.getElementById("sub-email").focus();
  }

  function wireSubscribeLinks() {
    document.querySelectorAll(".topbar a").forEach(a => {
      if (a.textContent.trim() === "Subscribe") {
        a.setAttribute("href", "#");
        a.addEventListener("click", (e) => { e.preventDefault(); showSubscribeModal(); });
      }
    });
  }

  WLAuth.showSubscribe = showSubscribeModal;
  WLAuth.getSubscribers = getSubscribers;

  // ===== Writers' club ("Interested in writing?") =====
  const LS_WRITERS = "wl_writers";

  function getWriters() {
    try { return JSON.parse(localStorage.getItem(LS_WRITERS) || "[]"); }
    catch { return []; }
  }
  function saveWriter(entry) {
    const list = getWriters();
    list.push(entry);
    localStorage.setItem(LS_WRITERS, JSON.stringify(list));
  }

  function showWritersModal() {
    if (!document.getElementById("wl-modal-overlay")) createModal();
    const c = document.getElementById("wl-modal-content");
    c.innerHTML = `
      <h2>Join the Student Times staff</h2>
      <p class="wl-demo-note">Add your email to the club mailing list. You'll get pitch deadlines, story assignments, and meeting times.</p>
      <label>Email <input type="email" id="wr-email" placeholder="you@example.com" autocomplete="email"></label>
      <div class="wl-hp" aria-hidden="true"><label>Leave this empty <input type="text" id="wr-hp" tabindex="-1" autocomplete="off"></label></div>
      <div class="wl-error" id="wr-err"></div>
      <button class="wl-submit" id="wr-go">Join the list</button>
    `;
    document.getElementById("wr-go").addEventListener("click", async () => {
      const email = document.getElementById("wr-email").value.trim();
      const errEl = document.getElementById("wr-err");
      errEl.textContent = "";
      if (!email) { errEl.textContent = "Please enter your email."; return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errEl.textContent = "That email doesn't look right."; return;
      }
      const wbtn = document.getElementById("wr-go");
      wbtn.disabled = true; wbtn.textContent = "Sending…";
      const wres = await WLSubmit.send("writers", { email },
        { honeypot: !!(document.getElementById("wr-hp") || {}).value });
      wbtn.disabled = false; wbtn.textContent = "Join the list";
      if (!wres.ok) { showSendError(errEl, wres); return; }
      saveWriter({ email, joinedAt: Date.now() });
      c.innerHTML = `
        <h2>You're in</h2>
        <p style="color:#333; font-size:14px; margin: 6px 0 16px;">Welcome to the team. An editor will be in touch soon with the next issue's pitch deadline.</p>
        <button class="wl-submit" id="wr-close">Close</button>
      `;
      document.getElementById("wr-close").addEventListener("click", hideModal);
    });
    const emailEl = document.getElementById("wr-email");
    emailEl.addEventListener("keydown", e => {
      if (e.key === "Enter") document.getElementById("wr-go").click();
    });
    document.getElementById("wl-modal-overlay").classList.add("visible");
    emailEl.focus();
  }

  function injectWritersLink() {
    const topInner = document.querySelector(".topbar-inner");
    if (!topInner) return;
    const left = topInner.children[0];
    if (!left) return;
    if (left.querySelector(".wl-writers-link")) return;
    const link = document.createElement("a");
    link.href = "#";
    link.className = "wl-writers-link";
    link.textContent = "Interested in writing?";
    link.addEventListener("click", (e) => { e.preventDefault(); showWritersModal(); });
    left.appendChild(link);
  }

  WLAuth.showWriters = showWritersModal;
  WLAuth.getWriters = getWriters;

  // ===== Init =====
  document.addEventListener("DOMContentLoaded", () => {
    renderTopbar();
    wireSubscribeLinks();
    injectWritersLink();
  });
})();
