// Shared article editor.
//
// One implementation used by every host that needs to create or edit an
// article: the Articles dashboard (editor.html) and the Content tab
// (editor-content.html). The modal markup is injected on first use, so a host
// only needs this script plus WLArticles / WLSections / WLAuth.
//
//   WLArticleEditor.open(id, { section, onSave })
//
//   id       article id to edit, or null/undefined to create a new one
//   section  preselected section for a new article (optional)
//   onSave   called after a successful save (optional)

window.WLArticleEditor = (function () {
  "use strict";

  const MARKUP = `
  <div class="ed-modal-overlay" id="ed-modal" role="dialog" aria-modal="true" aria-labelledby="ed-modal-title">
    <div class="ed-modal" role="document">
      <button class="ed-modal-close" id="ed-modal-close" aria-label="Close article editor">&times;</button>
      <h2 id="ed-modal-title">New Article</h2>

      <div class="ed-form">
        <div class="ed-form-row">
          <label>Section
            <select id="ed-section"></select>
          </label>
          <label>Date (e.g., April 17, 2026)
            <input type="text" id="ed-date">
          </label>
        </div>

        <label>Publish date &amp; time <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--muted);">(leave blank to publish now; set a future time to schedule)</span>
          <input type="datetime-local" id="ed-publish">
        </label>

        <label>ID / URL slug (lowercase, dashes-only) <input type="text" id="ed-id" placeholder="e.g., new-art-show-opens"></label>
        <p class="ed-tip">The article will live at <code>article.html?id=<span id="ed-id-preview">&hellip;</span></code></p>

        <label>Headline <input type="text" id="ed-title"></label>
        <label>Deck (one-sentence summary) <textarea id="ed-deck" rows="2"></textarea></label>

        <label style="margin-bottom:4px;">Writers <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--muted);">(add more than one for a co-written article)</span></label>
        <div id="ed-authors"></div>
        <button type="button" class="btn-ghost" id="ed-author-add" style="margin:2px 0 14px;">+ Add another writer</button>
        <label>Role (optional, e.g., "Editor-in-Chief") <input type="text" id="ed-role"></label>

        <label>Body (one paragraph per line; blank lines separate paragraphs)
          <textarea id="ed-body" rows="14" placeholder="The story opens here.&#10;&#10;Each paragraph goes on its own line."></textarea>
        </label>

        <label>Tags (comma-separated, optional)
          <input type="text" id="ed-tags" placeholder="e.g., seniors, prom, profile">
        </label>

        <fieldset class="ed-media">
          <legend>Media (optional)</legend>
          <p class="ed-tip" style="margin-top:0;">Add a photo, a video, or both. Videos take priority and replace the photo.</p>

          <label>Photo URL
            <input type="text" id="ed-photo" placeholder="https://example.com/photo.jpg">
          </label>
          <label>Or upload a photo
            <input type="file" id="ed-photo-file" accept="image/*">
          </label>
          <p class="ed-tip">Files are stored in your browser. Keep them under ~1 MB to avoid running out of space.</p>

          <label>Photo caption
            <input type="text" id="ed-caption" placeholder="Photo by the student photo staff.">
          </label>

          <label>Video URL (YouTube or Vimeo)
            <input type="text" id="ed-video" placeholder="https://youtube.com/watch?v=&hellip; or https://vimeo.com/&hellip;">
          </label>

          <div id="ed-photo-preview" style="margin-top:8px;"></div>

          <hr style="margin:16px 0; border:none; border-top:1px solid var(--rule);">
          <p class="ed-tip" style="margin-top:0;">Photo gallery (optional). Extra photos displayed below the article.</p>
          <div id="ed-gallery-rows"></div>
          <button type="button" class="btn-ghost" id="ed-gallery-add" style="margin-top:6px;">+ Add photo to gallery</button>
        </fieldset>

        <div class="ed-error" id="ed-error" role="alert"></div>
        <div class="ed-form-actions">
          <button class="btn-ghost" id="ed-cancel">Cancel</button>
          <button class="btn-primary" id="ed-save">Save article</button>
        </div>
      </div>
    </div>
  </div>`;

  // ===== Helpers =====
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function slugify(s) {
    return String(s).toLowerCase().trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80);
  }
  function todayString() {
    return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  }
  function sectionNames() { return WLSections.articleNames(); }

  // ===== One-time build =====
  let built = false;
  let modal, idEl, idPreview, titleEl, sectionEl, dateEl, roleEl, deckEl, bodyEl,
      errEl, photoEl, photoFileEl, captionEl, videoEl, photoPreviewEl,
      galleryRowsEl, publishEl, tagsEl, authorsEl, titleHeadingEl;
  let editingId = null;
  let lastFocused = null;      // restored when the modal closes
  let workingGallery = [];
  let workingAuthors = [];
  let onSaveCallback = null;

  function build() {
    if (built) return;
    const host = document.createElement("div");
    host.innerHTML = MARKUP;
    document.body.appendChild(host.firstElementChild);

    const $ = id => document.getElementById(id);
    modal = $("ed-modal");
    idEl = $("ed-id"); idPreview = $("ed-id-preview");
    titleEl = $("ed-title"); sectionEl = $("ed-section"); dateEl = $("ed-date");
    roleEl = $("ed-role"); deckEl = $("ed-deck"); bodyEl = $("ed-body");
    errEl = $("ed-error"); photoEl = $("ed-photo"); photoFileEl = $("ed-photo-file");
    captionEl = $("ed-caption"); videoEl = $("ed-video");
    photoPreviewEl = $("ed-photo-preview"); galleryRowsEl = $("ed-gallery-rows");
    publishEl = $("ed-publish"); tagsEl = $("ed-tags"); authorsEl = $("ed-authors");
    titleHeadingEl = $("ed-modal-title");

    $("ed-author-add").addEventListener("click", () => {
      workingAuthors.push("");
      renderAuthorRows();
      authorsEl.querySelector("div:last-child input").focus();
    });

    $("ed-gallery-add").addEventListener("click", () => {
      workingGallery.push({ url: "", caption: "" });
      renderGalleryRows();
    });

    photoEl.addEventListener("input", refreshPhotoPreview);
    videoEl.addEventListener("input", refreshPhotoPreview);
    photoFileEl.addEventListener("change", onPhotoFile);

    // Auto-suggest slug from the headline until the editor types their own.
    titleEl.addEventListener("input", () => {
      if (!editingId && !idEl.dataset.touched) {
        idEl.value = slugify(titleEl.value);
        idPreview.textContent = idEl.value || "…";
      }
    });
    idEl.addEventListener("input", () => {
      idEl.dataset.touched = "1";
      idPreview.textContent = idEl.value || "…";
    });

    publishEl.addEventListener("change", (e) => {
      if (!dateEl.value.trim() && e.target.value) {
        const d = new Date(e.target.value);
        if (!isNaN(d)) dateEl.value = d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
      }
    });

    $("ed-save").addEventListener("click", save);
    $("ed-cancel").addEventListener("click", close);
    $("ed-modal-close").addEventListener("click", close);
    modal.addEventListener("click", e => { if (e.target === modal) close(); });

    // Escape-to-close + focus trap
    modal.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { close(); return; }
      if (e.key !== "Tab") return;
      const f = modal.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (f.length === 0) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    built = true;
  }

  // ===== Writers (one or more; co-written articles list every contributor) =====
  function renderAuthorRows() {
    authorsEl.innerHTML = "";
    workingAuthors.forEach((name, i) => {
      const row = document.createElement("div");
      row.className = "ed-repeat-row ed-repeat-row-author";
      const input = document.createElement("input");
      input.type = "text";
      input.value = name;
      input.placeholder = i === 0 ? "Writer's name" : "Co-writer's name";
      input.setAttribute("aria-label", i === 0 ? "Writer" : "Co-writer " + (i + 1));
      input.style.cssText = "padding:8px 10px; border:1px solid var(--rule); background:#fafafa; font-size:14px;";
      input.addEventListener("input", () => { workingAuthors[i] = input.value; });
      const rm = document.createElement("button");
      rm.type = "button"; rm.className = "btn-danger"; rm.textContent = "Remove";
      rm.style.cssText = "padding:4px 10px; font-size:11px;";
      rm.disabled = workingAuthors.length <= 1;   // always keep at least one row
      rm.addEventListener("click", () => { workingAuthors.splice(i, 1); renderAuthorRows(); });
      row.appendChild(input); row.appendChild(rm);
      authorsEl.appendChild(row);
    });
  }
  function setAuthors(list) {
    workingAuthors = (list && list.length) ? list.slice() : [""];
    renderAuthorRows();
  }

  // ===== Gallery =====
  function renderGalleryRows() {
    galleryRowsEl.innerHTML = "";
    workingGallery.forEach((g, i) => {
      const row = document.createElement("div");
      row.className = "ed-repeat-row ed-repeat-row-gallery";
      row.innerHTML = `
        <input type="text" placeholder="Photo URL" value="${(g.url || "").replace(/"/g, "&quot;")}" data-gi="${i}" data-gfield="url" style="padding:6px 8px; border:1px solid var(--rule); background:#fafafa; font-size:13px;">
        <input type="text" placeholder="Caption (optional)" value="${(g.caption || "").replace(/"/g, "&quot;")}" data-gi="${i}" data-gfield="caption" style="padding:6px 8px; border:1px solid var(--rule); background:#fafafa; font-size:13px;">
        <button type="button" class="btn-danger" data-gi="${i}" data-gremove style="padding:4px 8px; font-size:11px;">Remove</button>
      `;
      galleryRowsEl.appendChild(row);
    });
    galleryRowsEl.querySelectorAll("[data-gfield]").forEach(el => el.addEventListener("input", (e) => {
      const row = workingGallery[+e.currentTarget.dataset.gi];
      if (row) row[e.currentTarget.dataset.gfield] = e.currentTarget.value;
    }));
    galleryRowsEl.querySelectorAll("[data-gremove]").forEach(b => b.addEventListener("click", (e) => {
      const i = +e.currentTarget.dataset.gi;
      if (!workingGallery[i]) return;
      workingGallery.splice(i, 1);
      renderGalleryRows();
    }));
  }

  // ===== Media preview =====
  function refreshPhotoPreview() {
    photoPreviewEl.innerHTML = "";
    if (videoEl.value.trim()) {
      photoPreviewEl.innerHTML = `<div style="font-size:12px; color: var(--muted);">Video will display in place of the photo.</div>`;
      return;
    }
    if (photoEl.value.trim()) {
      const img = document.createElement("img");
      img.src = photoEl.value.trim();
      img.style.maxWidth = "100%";
      img.style.maxHeight = "200px";
      img.style.display = "block";
      img.onerror = () => { photoPreviewEl.innerHTML = `<div style="font-size:12px; color: #b8002a;">Couldn't load that image URL.</div>`; };
      photoPreviewEl.appendChild(img);
    }
  }

  function onPhotoFile() {
    const file = photoFileEl.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      if (!confirm("That file is over 2 MB. Storing it in your browser may cause problems. Continue anyway?")) {
        photoFileEl.value = ""; return;
      }
    }
    // Shrunk before it is stored. A phone photo is ~4MB, and base64 makes it
    // ~5.4MB — more than the whole browser budget, for an image the page never
    // renders above ~700px.
    WLStorage.shrinkImage(file).then(dataUrl => {
      photoEl.value = dataUrl;
      refreshPhotoPreview();
    });
  }

  function populateSectionSelect() {
    const current = sectionEl.value;
    const names = sectionNames();
    sectionEl.innerHTML = names.map(n => `<option>${escapeHtml(n)}</option>`).join("");
    if (names.includes(current)) sectionEl.value = current;
  }

  // ===== Open / close =====
  function open(id, opts) {
    lastFocused = document.activeElement;
    build();
    opts = opts || {};
    onSaveCallback = typeof opts.onSave === "function" ? opts.onSave : null;
    editingId = id || null;
    errEl.textContent = "";
    populateSectionSelect();

    const fallback = (WLSections.navSections().find(s => !s.fixedPage) || WLSections.list()[0] || {}).name || "";
    // A section passed by the host wins, as long as it still takes articles.
    const preset = opts.section && sectionNames().includes(opts.section) ? opts.section : "";
    const defaultSection = preset || fallback;

    if (id) {
      const a = WLArticles.getById(id);
      titleHeadingEl.textContent = "Edit Article";
      idEl.value = id;
      idEl.disabled = true;
      titleEl.value = a.title || "";
      // Keep showing the article's own section even if it was later renamed away.
      if (a.section && !sectionNames().includes(a.section)) {
        sectionEl.insertAdjacentHTML("beforeend", `<option>${escapeHtml(a.section)}</option>`);
      }
      sectionEl.value = a.section || defaultSection;
      dateEl.value = a.date || "";
      publishEl.value = a.publishAt || "";
      setAuthors(WL_articleAuthors(a));
      roleEl.value = a.role || "";
      deckEl.value = a.deck || "";
      bodyEl.value = (a.body || []).join("\n\n");
      photoEl.value = a.photo || "";
      captionEl.value = a.photoCaption || "";
      videoEl.value = a.video || "";
      workingGallery = (a.gallery || []).map(g => Object.assign({}, g));
      tagsEl.value = (a.tags || []).join(", ");
    } else {
      titleHeadingEl.textContent = "New Article";
      idEl.value = "";
      idEl.disabled = false;
      delete idEl.dataset.touched;   // let the headline drive the slug again
      titleEl.value = "";
      sectionEl.value = defaultSection;
      dateEl.value = todayString();
      publishEl.value = "";
      setAuthors([WLAuth.currentUser() || ""]);
      roleEl.value = "";
      deckEl.value = "";
      bodyEl.value = "";
      photoEl.value = "";
      captionEl.value = "";
      videoEl.value = "";
      workingGallery = [];
      tagsEl.value = "";
    }

    photoFileEl.value = "";
    renderGalleryRows();
    refreshPhotoPreview();
    idPreview.textContent = idEl.value || "…";
    modal.classList.add("visible");
    setTimeout(() => titleEl.focus(), 50);
  }

  function close() {
    modal.classList.remove("visible");
    editingId = null;
    // Send focus back where it came from, rather than dropping it on <body>
    // and making a keyboard user navigate the page again.
    if (lastFocused && lastFocused.focus) lastFocused.focus();
    lastFocused = null;
  }

  // ===== Save =====
  function save() {
    errEl.textContent = "";
    const id = (idEl.value || "").trim();
    const title = titleEl.value.trim();
    const deck = deckEl.value.trim();
    const authors = workingAuthors.map(x => x.trim()).filter(Boolean);
    const byline = WL_bylineText(authors);
    const date = dateEl.value.trim();
    const publishAt = publishEl.value.trim();
    const section = sectionEl.value;
    const role = roleEl.value.trim();
    const bodyParas = bodyEl.value.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

    if (!id || !/^[a-z0-9-]+$/.test(id)) { errEl.textContent = "ID must be lowercase letters, numbers, and dashes only."; return; }
    if (!title) { errEl.textContent = "Headline is required."; return; }
    if (!deck) { errEl.textContent = "Deck is required."; return; }
    if (authors.length === 0) { errEl.textContent = "At least one writer is required."; return; }
    if (!date) { errEl.textContent = "Date is required."; return; }
    if (bodyParas.length === 0) { errEl.textContent = "Body cannot be empty."; return; }

    // Prevent overwriting existing IDs (except when editing the same one)
    if (id !== editingId && WLArticles.getById(id)) {
      errEl.textContent = "Another article already uses that ID. Choose a different slug."; return;
    }

    const data = {
      title, deck, section, byline, date, body: bodyParas,
      sectionPage: WLSections.pageFor(section)
    };
    if (authors.length > 1) data.authors = authors;
    if (role) data.role = role;
    const photoVal = photoEl.value.trim();
    const captionVal = captionEl.value.trim();
    const videoVal = videoEl.value.trim();
    if (photoVal) data.photo = photoVal;
    if (captionVal) data.photoCaption = captionVal;
    if (videoVal) data.video = videoVal;
    if (publishAt) data.publishAt = publishAt;
    // Strip empty gallery rows
    const cleanGallery = workingGallery.filter(g => g.url && g.url.trim());
    cleanGallery.forEach(g => { g.url = g.url.trim(); g.caption = (g.caption || "").trim(); if (!g.caption) delete g.caption; });
    if (cleanGallery.length > 0) data.gallery = cleanGallery;
    const rawTags = tagsEl.value.trim();
    if (rawTags) {
      const tagList = rawTags.split(",").map(t => t.trim()).filter(Boolean);
      if (tagList.length > 0) data.tags = tagList;
    }

    try {
      WLArticles.save(id, data);
    } catch (err) {
      errEl.textContent = "Couldn't save. Your browser storage is full. Try a smaller photo file, or paste an image URL instead.";
      return;
    }
    close();
    if (onSaveCallback) onSaveCallback(id);
  }

  return { open: open, close: close };
})();
