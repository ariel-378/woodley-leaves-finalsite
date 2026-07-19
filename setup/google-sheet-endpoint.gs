/**
 * ============================================================================
 *  THE PAPER — form endpoint (Google Apps Script)
 *
 *  Receives newsletter signups, staff signups, and story pitches from the
 *  website and appends them as rows in this spreadsheet. One tab per form,
 *  created automatically on first submission.
 *
 *  Setup instructions: see setup/README.md in the site files.
 *
 *  ⚠️ The web-app URL is public — it ships in the website's source, so anyone
 *  can send data to it. That is unavoidable for a site with no server. This
 *  script is therefore the ONLY real gatekeeper: it validates every field,
 *  caps every length, and silently drops anything that trips the honeypot.
 *  Do not move validation into the browser and trust it.
 * ============================================================================
 */

// Tab name and columns for each form.
var FORMS = {
  subscribe: { sheet: 'Subscribers',   headers: ['Received', 'Email', 'Phone'] },
  writers:   { sheet: 'Writers',       headers: ['Received', 'Email'] },
  tip:       { sheet: 'Story Pitches', headers: ['Received', 'Pitch', 'Name', 'Email'] },
};

var MAX = { pitch: 5000, name: 120, email: 254, phone: 40 };

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return json({ result: 'error', error: 'empty request' });

    var data;
    try { data = JSON.parse(e.postData.contents); }
    catch (err) { return json({ result: 'error', error: 'bad json' }); }

    // Honeypot: a hidden field no human can see. Bots fill it in. Answer "ok"
    // so they don't learn they were caught, but write nothing.
    if (data.website) return json({ result: 'ok' });

    var form = FORMS[String(data.kind || '')];
    if (!form) return json({ result: 'error', error: 'unknown form' });

    var email = clip(data.email, MAX.email);
    var phone = clip(data.phone, MAX.phone);
    var name  = clip(data.name,  MAX.name);
    var pitch = clip(data.pitch, MAX.pitch);

    if (email && !isEmail(email)) return json({ result: 'error', error: 'invalid email' });

    // Per-form required fields.
    if (data.kind === 'subscribe' && !email && !phone) return json({ result: 'error', error: 'email or phone required' });
    if (data.kind === 'writers' && !email)             return json({ result: 'error', error: 'email required' });
    if (data.kind === 'tip' && pitch.trim().length < 20) return json({ result: 'error', error: 'pitch too short' });

    var row;
    var received = new Date();        // server time — never trust the browser's clock
    if (data.kind === 'subscribe')   row = [received, email, phone];
    else if (data.kind === 'writers') row = [received, email];
    else                              row = [received, pitch, name, email];   // tip: name/email may be blank by design

    appendRow_(form, row);
    return json({ result: 'ok' });

  } catch (err) {
    return json({ result: 'error', error: String(err) });
  }
}

/** A browser hitting the URL directly gets a human answer, not a stack trace. */
function doGet() {
  return json({ result: 'ok', message: 'The paper\'s form endpoint is running. Submissions are accepted via POST.' });
}

/**
 * A LockService guard keeps two simultaneous submissions from writing to the
 * same row — rare, but it silently eats a pitch when it happens.
 */
function appendRow_(form, row) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(form.sheet);
    if (!sheet) {
      sheet = ss.insertSheet(form.sheet);
      sheet.appendRow(form.headers);
      sheet.getRange(1, 1, 1, form.headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }
}

function clip(v, n) { return String(v == null ? '' : v).slice(0, n); }
function isEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
