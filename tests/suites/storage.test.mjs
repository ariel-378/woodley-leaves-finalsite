// Losing a writer's story is the worst thing this site can do.
//
// Two failures put it one photo away. Uploads were stored at full size as
// base64 — a single phone photo is ~4MB, ~5.4MB encoded, more than the whole
// ~5MB localStorage budget — and of the twenty-one files that write to
// storage, one handled the quota error. Everywhere else the write threw into
// nothing: the change was gone and the page said it had saved.
//
// These cover the two halves. Uploads are shrunk before they are stored, so
// the ceiling is rarely reached; and when it is reached anyway, the reader of
// the screen finds out.
import { loadPage, SITE, Check } from "../harness.mjs";
import fs from "node:fs";
import path from "node:path";

/**
 * jsdom has no canvas, so a page that resizes an image would silently fall
 * back everywhere and prove nothing. This stands one in: it records the size
 * the code asked for and hands back a marker, which is exactly what the
 * assertions need.
 */
function fakeCanvas(w) {
  const drawn = [];
  w.__drawn = drawn;
  w.HTMLCanvasElement.prototype.getContext = function () {
    const canvas = this;
    return {
      drawImage(img, x, y, cw, ch) { drawn.push({ w: cw, h: ch, canvas: { w: canvas.width, h: canvas.height } }); },
      fillRect() {}, set fillStyle(v) {}, get fillStyle() { return ""; },
    };
  };
  w.HTMLCanvasElement.prototype.toDataURL = function (type) {
    return "data:" + (type || "image/png") + ";base64,SHRUNK";
  };
  // An <img> in jsdom never loads, so drive onload the moment a src is set.
  Object.defineProperty(w.HTMLImageElement.prototype, "src", {
    set(v) {
      this._src = v;
      Object.defineProperty(this, "naturalWidth", { value: 4032, configurable: true });
      Object.defineProperty(this, "naturalHeight", { value: 3024, configurable: true });
      setTimeout(() => this.onload && this.onload(), 0);
    },
    get() { return this._src; },
    configurable: true,
  });
}

/** A File whose FileReader yields `dataUrl`, since jsdom's reader won't. */
function fakeFile(w, name, type, dataUrl, size) {
  w.FileReader = class {
    readAsDataURL() { setTimeout(() => { this.result = dataUrl; this.onload && this.onload({ target: this }); }, 0); }
  };
  return { name, type, size: size || 4 * 1024 * 1024 };
}

const settle = () => new Promise(r => setTimeout(r, 5));

export async function run() {
  const check = new Check();

  // ===== A photo is shrunk before it is stored =====
  {
    const ctx = await loadPage("editor-content.html", { beforeParse: fakeCanvas });
    const W = ctx.window;
    check.ok("the site has a shared image shrinker", !!(W.WLStorage && W.WLStorage.shrinkImage));

    // Long on purpose: the shrinker keeps whichever is smaller, so a stand-in
    // original has to actually be bigger than the redraw for the swap to mean
    // anything.
    const huge = "data:image/jpeg;base64," + "A".repeat(20000);
    const file = fakeFile(W, "photo.jpg", "image/jpeg", huge);
    const out = await W.WLStorage.shrinkImage(file);
    await settle();

    check.ok("a 4032px photo is not stored at 4032px", W.__drawn.length > 0, "nothing was redrawn");
    const d = W.__drawn[0] || {};
    check.ok("it is capped to the long edge", d.w && d.w <= 1400, "drew at " + d.w);
    check.ok("and keeps its shape", d.w && d.h && Math.abs((d.w / d.h) - (4032 / 3024)) < 0.02,
      d.w + "x" + d.h);
    check.ok("what comes back is the shrunk image, not the original",
      /SHRUNK/.test(out), String(out).slice(0, 40));
  }

  // ===== An SVG is left alone =====
  //  It has no pixels to shrink, and rasterising it would make it worse.
  {
    const ctx = await loadPage("editor-content.html", { beforeParse: fakeCanvas });
    const W = ctx.window;
    const svg = "data:image/svg+xml,%3Csvg%2F%3E";
    const out = await W.WLStorage.shrinkImage(fakeFile(W, "logo.svg", "image/svg+xml", svg));
    check.equal("an SVG upload is passed through untouched", out, svg);
  }

  // ===== Nothing crashes where canvas is missing =====
  //  Real browsers have canvas; a locked-down one might not. Falling back to
  //  the original beats throwing inside an upload handler.
  {
    const ctx = await loadPage("editor-content.html", {
      beforeParse(w) {
        fakeCanvas(w);
        w.HTMLCanvasElement.prototype.getContext = () => null;   // no 2d context
      },
    });
    const W = ctx.window;
    const out = await W.WLStorage.shrinkImage(fakeFile(W, "p.jpg", "image/jpeg", "data:image/jpeg;base64,ORIG"));
    check.ok("with no canvas, the original is kept rather than throwing",
      /ORIG/.test(out), String(out).slice(0, 40));
    check.clean("and the page is still clean", ctx);
  }

  // ===== A full browser tells the person at the keyboard =====
  {
    const ctx = await loadPage("editor-content.html", {
      beforeParse(w) {
        // Every store writes through Storage.prototype, so failing there is
        // the honest simulation of a full browser.
        const native = w.Storage.prototype.setItem;
        w.__native = native;
        w.__failing = false;
        w.Storage.prototype.setItem = function (k, v) {
          if (w.__failing) { const e = new Error("full"); e.name = "QuotaExceededError"; throw e; }
          return native.call(this, k, v);
        };
      },
    });
    const W = ctx.window;
    W.__failing = true;

    let threw = false;
    try { W.localStorage.setItem("wl_articles_custom", "{}"); } catch (e) { threw = true; }

    check.ok("a failed write still throws, so no caller thinks it saved", threw);
    const banner = ctx.window.document.querySelector("#wl-storage-full, .wl-storage-full");
    check.ok("and the page says so out loud", !!banner, "no visible warning appeared");
    if (banner) {
      check.ok("naming the problem in words a student can act on",
        /full|space|storage/i.test(banner.textContent), banner.textContent.slice(0, 80));
      check.ok("and pointing at the backup they should take now",
        /back ?up|download|export/i.test(banner.textContent), banner.textContent.slice(0, 120));
    }
  }

  // ===== Every upload path goes through the shrinker =====
  //  A new upload field that reads the file itself would quietly reintroduce
  //  the whole problem, and no behavioural test would catch it — the bug only
  //  shows up on a real camera photo. So this reads the source.
  {
    const files = fs.readdirSync(SITE).filter(f => /\.(js|html)$/.test(f) && f !== "storage.js");
    const raw = files.filter(f => /readAsDataURL/.test(fs.readFileSync(path.join(SITE, f), "utf8")));
    check.equal("no page reads an upload without shrinking it first", raw, []);

    const wired = files.filter(f => /WLStorage\.shrinkImage/.test(fs.readFileSync(path.join(SITE, f), "utf8")));
    check.ok("and every upload field that exists uses the shrinker",
      wired.length >= 4, "only found it in: " + wired.join(", "));
  }

  // ===== Every page that can write is carrying the guard =====
  {
    const pageFiles = fs.readdirSync(SITE).filter(f => f.endsWith(".html"));
    const missing = pageFiles.filter(f => {
      const src = fs.readFileSync(path.join(SITE, f), "utf8");
      return /src="config\.js"/.test(src) && !/src="storage\.js"/.test(src);
    });
    check.equal("no page loads the site's scripts without the storage guard", missing, []);
  }

  // ===== The warning is not shown when nothing is wrong =====
  {
    const ctx = await loadPage("editor-content.html");
    ctx.window.localStorage.setItem("wl_articles_custom", "{}");
    check.ok("a healthy browser shows no storage warning",
      !ctx.window.document.querySelector("#wl-storage-full, .wl-storage-full"));
    check.clean("and nothing throws on a normal save", ctx);
  }

  return check;
}
