// The tab icon — drawn letters, or an image an editor uploads.
//
// The icon is one value doing two jobs: an object is letters on a square, a
// string is an image (an upload, or a path config.js set). brand.js has always
// read both; what these cover is the editor being able to SET the image, and
// the export shipping a file that actually exists at the name the config names.
import { loadPage, Check } from "../harness.mjs";

const $ = (ctx, id) => ctx.window.document.getElementById(id);

// A one-pixel PNG and a tiny SVG, as a browser would hand them to FileReader.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const SVG = "data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%2F%3E";

const brandTab = (storage = {}) => loadPage("editor-brand.html", { storage });

/** Seed a saved brand override, the way a previous session would have left it. */
const withSavedFavicon = favicon => brandTab({ wl_brand: JSON.stringify({ favicon }) });

export async function run() {
  const check = new Check();

  // ===== The panel offers an upload =====
  {
    const ctx = await brandTab();
    check.ok("the Tab icon panel takes a file", !!$(ctx, "f-fav-file"));
    check.ok("and shows a preview", !!$(ctx, "fav-preview-img"));
    check.ok("with the letter fields still there", !!$(ctx, "f-fav-initials"));
    check.ok("nothing uploaded, so there is nothing to remove", $(ctx, "fav-actions").hidden);
    check.ok("and the preview says where the icon comes from",
      /letters/i.test($(ctx, "fav-preview-label").textContent),
      $(ctx, "fav-preview-label").textContent);
    check.clean("the Tab icon panel renders without errors", ctx);
  }

  // ===== Letters still draw the icon, through brand.js itself =====
  {
    const ctx = await brandTab();
    ctx.type($(ctx, "f-fav-initials"), "ZQ");
    const src = $(ctx, "fav-preview-img").src;
    check.ok("the preview is an SVG built from the letters", /^data:image\/svg\+xml/.test(src), src.slice(0, 40));
    check.ok("carrying the letters that were typed", decodeURIComponent(src).includes("ZQ"));

    // The preview must come from brand.js, not a copy — same input, same output.
    const viaBrand = ctx.window.WLBrandIcon.href(
      { initials: "ZQ", bg: $(ctx, "f-fav-bg").value.trim(), fg: $(ctx, "f-fav-fg").value.trim() },
      { accent: $(ctx, "f-accent").value.trim() },
      $(ctx, "f-name").value.trim());
    check.equal("and is the very icon brand.js would draw", src, viaBrand);
  }

  // ===== An uploaded image replaces the letters =====
  {
    const ctx = await withSavedFavicon(PNG);
    check.equal("a saved image is shown in the preview", $(ctx, "fav-preview-img").src, PNG);
    check.ok("the panel says the upload is in use",
      /uploaded icon is in use/i.test($(ctx, "fav-preview-label").textContent));
    check.ok("Remove is offered", !$(ctx, "fav-actions").hidden);
    check.ok("and the letters are shown as overridden",
      $(ctx, "fav-letters").classList.contains("is-replaced"));
    check.clean("no errors with an uploaded icon", ctx);
  }

  // ===== Saving keeps the image, and every page picks it up =====
  {
    const ctx = await withSavedFavicon(PNG);
    ctx.click($(ctx, "save-all"));
    check.equal("the image survives a save", ctx.window.WLBrand.overrides().favicon, PNG);
    check.equal("and is what the merged config reports", ctx.window.WLBrand.get().favicon, PNG);
  }

  {
    // The point of all of it: the browser tab actually shows it.
    const ctx = await loadPage("index.html", {
      editor: false,
      storage: { wl_brand: JSON.stringify({ favicon: PNG }) },
    });
    const link = ctx.window.document.querySelector('link[rel="icon"]');
    check.equal("a reader's tab uses the uploaded icon", link && link.getAttribute("href"), PNG);
    check.equal("declared with the type it really is", link && link.getAttribute("type"), "image/png");
  }

  {
    const ctx = await loadPage("index.html", {
      editor: false,
      storage: { wl_brand: JSON.stringify({ favicon: SVG }) },
    });
    const link = ctx.window.document.querySelector('link[rel="icon"]');
    check.equal("an SVG upload is typed as SVG", link && link.getAttribute("type"), "image/svg+xml");
  }

  // ===== Remove goes back to letters, not to a blank square =====
  {
    const ctx = await withSavedFavicon(PNG);
    ctx.click($(ctx, "fav-remove"));
    check.ok("Remove drops the image", !/^data:image\/png/.test($(ctx, "fav-preview-img").src));
    check.ok("and the letters draw the icon again",
      /^data:image\/svg\+xml/.test($(ctx, "fav-preview-img").src));
    check.ok("with the letter fields live again",
      !$(ctx, "fav-letters").classList.contains("is-replaced"));

    ctx.click($(ctx, "save-all"));
    const saved = ctx.window.WLBrand.overrides().favicon;
    check.ok("and what's saved is letters, not a string", saved && typeof saved === "object", typeof saved);
  }

  // ===== The export ships a file that matches the name it writes =====
  //  An uploaded icon used to export as "media/favicon-upload" — no extension,
  //  so brand.js could not tell its type — and the file itself was never
  //  downloaded. The config pointed at something that did not exist.
  {
    const ctx = await withSavedFavicon(PNG);
    ctx.click($(ctx, "save-all"));

    const source = ctx.window.WLBrand.exportConfigSource();
    const uploads = ctx.window.WLBrand.exportUploads();

    check.ok("the exported config names a real file with an extension",
      /"favicon":\s*"media\/favicon\.png"/.test(source),
      (source.match(/"favicon":[^,\n]*/) || [""])[0]);
    check.ok("the huge data URL is kept out of the config", !source.includes("base64"));
    check.equal("and the image is downloaded alongside it", uploads.length, 1);
    check.equal("under exactly the name the config used", uploads[0].name, "favicon.png");
    check.equal("with the bytes intact", uploads[0].dataUrl, PNG);
    check.ok("and the config says where to put it", /media\/favicon\.png/.test(source));
  }

  {
    const ctx = await withSavedFavicon(SVG);
    ctx.click($(ctx, "save-all"));
    check.equal("an SVG upload keeps the .svg extension",
      ctx.window.WLBrand.exportUploads()[0].name, "favicon.svg");
  }

  // Both uploads at once — the flourish and the icon must not collide or drop
  // one another, since they share the export path.
  {
    const ctx = await brandTab({
      wl_brand: JSON.stringify({ favicon: PNG, ornament: { file: SVG, width: 72, mirror: true, opacity: 0.55 } }),
    });
    const uploads = ctx.window.WLBrand.exportUploads();
    const names = uploads.map(u => u.name).sort();
    check.equal("a flourish and an icon both come down", names, ["favicon.png", "masthead-flourish.svg"]);

    const source = ctx.window.WLBrand.exportConfigSource();
    check.ok("both are named in the config", /media\/favicon\.png/.test(source) && /media\/masthead-flourish\.svg/.test(source));
    check.ok("and the note tells the reader to save both",
      /favicon\.png/.test(source.split("window.WL_CONFIG")[0]) &&
      /masthead-flourish\.svg/.test(source.split("window.WL_CONFIG")[0]));
  }

  // ===== A plain path is left alone =====
  //  config.js may point the icon at a committed file. That is already a real
  //  file, so it must not be turned into a download.
  {
    const ctx = await withSavedFavicon("media/school-crest.svg");
    check.equal("a path is shown as the current icon",
      $(ctx, "fav-preview-img").getAttribute("src"), "media/school-crest.svg");
    check.equal("but nothing is downloaded for it", ctx.window.WLBrand.exportUploads().length, 0);
    check.ok("and the path survives the export unchanged",
      /"favicon":\s*"media\/school-crest\.svg"/.test(ctx.window.WLBrand.exportConfigSource()));
  }

  // ===== Reset puts the shipped icon back =====
  {
    const ctx = await withSavedFavicon(PNG);
    ctx.click($(ctx, "reset-all"));
    check.ok("Reset everything clears an uploaded icon",
      ctx.window.WLBrand.overrides().favicon === undefined);
    check.ok("and the panel stops offering Remove", $(ctx, "fav-actions").hidden);
    check.clean("no errors resetting", ctx);
  }

  return check;
}
