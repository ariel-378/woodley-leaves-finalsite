// ============================================================================
//  STORAGE — the two guards that keep a writer from losing a story.
//
//  Everything an editor does lives in this browser's localStorage, which is
//  about 5MB. That is a lot of prose and almost no photographs: a phone camera
//  file is ~4MB, and base64 makes it ~5.4MB, so ONE uploaded photo could fill
//  the whole budget on its own. When it filled, `setItem` threw, and of the
//  twenty-one files that write here exactly one caught it — everywhere else
//  the change vanished and the page carried on as if it had saved.
//
//  So, two things:
//
//   1. shrinkImage() — every upload path runs through it, so a photo is stored
//      at a sensible size instead of at whatever the camera produced. This is
//      the fix that matters: it stops the ceiling being reached at all.
//
//   2. A guard on Storage.prototype.setItem that shows a visible banner when
//      the browser is full. It RE-THROWS afterwards, deliberately — swallowing
//      the error would turn a loud failure into the silent one we are fixing.
//      Callers that already handle quota keep working unchanged; the only new
//      behaviour is that the person at the keyboard finds out.
//
//  Load this before any *-store.js.
// ============================================================================
window.WLStorage = (function () {
  // 1400px is larger than any slot the site renders an image into, on any
  // screen we support, at 2x. Bigger than this is bytes nobody ever sees.
  var MAX_DIM = 1400;
  var JPEG_QUALITY = 0.82;

  function isQuotaError(e) {
    return !!e && (e.name === "QuotaExceededError" ||
                   e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
                   e.code === 22 || e.code === 1014);
  }

  // ── The banner ────────────────────────────────────────────────────────────
  //  Deliberately hard to miss and not auto-dismissed. Someone losing work
  //  should not be able to look away and forget.
  var shown = false;
  function warnStorageFull() {
    if (shown) return;
    var body = document.body;
    if (!body) return;               // thrown before the page exists; nothing to show on
    shown = true;

    var bar = document.createElement("div");
    bar.id = "wl-storage-full";
    bar.className = "wl-storage-full";
    bar.setAttribute("role", "alert");
    bar.style.cssText =
      "position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#b8002a;color:#fff;" +
      "font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;line-height:1.5;" +
      "padding:14px 18px;box-shadow:0 -2px 12px rgba(0,0,0,0.3);";
    bar.innerHTML =
      "<strong>Your browser's storage is full — that last change was not saved.</strong><br>" +
      "Take a backup now: <b>Content &rarr; Publish &amp; transfer &rarr; Download a backup</b>. " +
      "Then remove a large photo, or paste an image URL instead of uploading a file.";

    var close = document.createElement("button");
    close.type = "button";
    close.textContent = "Dismiss";
    close.style.cssText =
      "margin-left:14px;background:#fff;color:#b8002a;border:none;padding:5px 12px;" +
      "font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;";
    close.addEventListener("click", function () { bar.remove(); shown = false; });
    bar.appendChild(close);

    body.appendChild(bar);
  }

  // ── The guard ─────────────────────────────────────────────────────────────
  (function guardSetItem() {
    if (typeof Storage === "undefined" || Storage.prototype.__wlGuarded) return;
    var native = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      try {
        return native.call(this, key, value);
      } catch (e) {
        if (isQuotaError(e)) warnStorageFull();
        throw e;                     // never swallow — see the header
      }
    };
    Storage.prototype.__wlGuarded = true;
  })();

  // ── Shrinking uploads ─────────────────────────────────────────────────────
  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) { resolve(e && e.target ? e.target.result : reader.result); };
      reader.onerror = function () { reject(new Error("unreadable")); };
      reader.readAsDataURL(file);
    });
  }

  function redraw(dataUrl, maxDim, mime) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        if (!w || !h) return reject(new Error("no dimensions"));
        if (w <= maxDim && h <= maxDim) return reject(new Error("already small"));

        var scale = maxDim / Math.max(w, h);
        var tw = Math.round(w * scale), th = Math.round(h * scale);

        var canvas = document.createElement("canvas");
        canvas.width = tw; canvas.height = th;
        var ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no 2d context"));

        // JPEG has no transparency, so anything see-through would come out
        // black. Paint white under it first.
        if (mime === "image/jpeg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, tw, th); }
        ctx.drawImage(img, 0, 0, tw, th);

        var out = canvas.toDataURL(mime, mime === "image/jpeg" ? JPEG_QUALITY : undefined);
        // A canvas that failed returns something that isn't an image data URL
        // ("data:," in some browsers). Check the shape rather than a length.
        if (!/^data:image\/[a-z0-9.+-]+;/i.test(out || "")) return reject(new Error("empty canvas"));
        resolve(out);
      };
      img.onerror = function () { reject(new Error("undecodable")); };
      img.src = dataUrl;
    });
  }

  /**
   * shrinkImage(file, { maxDim, keepAlpha }) → Promise<dataURL>
   *
   * Always resolves. If anything goes wrong — no canvas, an image the browser
   * can't decode, an SVG — it resolves with the file exactly as read. A photo
   * stored too large is a problem for later; an upload handler that throws is
   * a problem right now.
   *
   * keepAlpha: true keeps PNG output, for artwork that must stay see-through
   * (a crest, a masthead flourish, a tab icon). Photographs don't need it and
   * JPEG is several times smaller.
   */
  function shrinkImage(file, opts) {
    opts = opts || {};
    var maxDim = opts.maxDim || MAX_DIM;
    return readFile(file).then(function (dataUrl) {
      // Vector art has no pixels to drop, and rasterising it would only make
      // it bigger and blurrier.
      if (/^data:image\/svg\+xml/i.test(dataUrl)) return dataUrl;
      var mime = opts.keepAlpha ? "image/png" : "image/jpeg";
      return redraw(dataUrl, maxDim, mime).then(
        function (small) {
          // A redraw that came out heavier than the original helps nobody.
          return small.length < dataUrl.length ? small : dataUrl;
        },
        function () { return dataUrl; }
      );
    });
  }

  /** Rough size of what is currently stored, for the backup nudge. */
  function usedBytes() {
    var total = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf("wl_") === 0) total += k.length + (localStorage.getItem(k) || "").length;
      }
    } catch (e) { /* storage blocked — the nudge is a nicety */ }
    return total;
  }

  return {
    shrinkImage: shrinkImage,
    isQuotaError: isQuotaError,
    warnStorageFull: warnStorageFull,
    usedBytes: usedBytes,
    MAX_DIM: MAX_DIM,
  };
})();
