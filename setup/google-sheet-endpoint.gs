/**
 * ============================================================================
 *  THE PAPER — newsletter signup endpoint (Google Apps Script)
 *
 *  Receives newsletter signups from the website's Subscribe button and appends
 *  them as rows in this spreadsheet. The "Subscribers" tab is created
 *  automatically on the first signup.
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

var SHEET = 'Subscribers';
var HEADERS = ['Received', 'Email'];

//  Email only. A phone number is a bigger promise than a newsletter needs, and
//  a student publication holding other students' phone numbers invites rules
//  about texting minors that nobody here wants to be responsible for. The
//  script rejects a phone field outright rather than quietly ignoring it, so a
//  stale copy of the page cannot start filling a column nobody is watching.
var MAX = { email: 254 };

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return json({ result: 'error', error: 'empty request' });

    var data;
    try { data = JSON.parse(e.postData.contents); }
    catch (err) { return json({ result: 'error', error: 'bad json' }); }

    // Honeypot: a hidden field no human can see. The site drops these before
    // sending, so this only catches something posting straight at the URL.
    // Answer "ok" so it doesn't learn it was caught, but write nothing.
    if (data.website) return json({ result: 'ok' });

    if (String(data.kind || '') !== 'subscribe') {
      return json({ result: 'error', error: 'unknown form' });
    }

    // Refuse anything carrying a phone number instead of silently dropping it,
    // so an old cached page fails loudly rather than half-working.
    if (data.phone) return json({ result: 'error', error: 'phone numbers are not collected' });

    var email = clip(data.email, MAX.email);

    if (!email) return json({ result: 'error', error: 'email required' });
    if (!isEmail(email)) return json({ result: 'error', error: 'invalid email' });

    // Server time — never trust the browser's clock.
    appendRow_([new Date(), email]);
    return json({ result: 'ok' });

  } catch (err) {
    return json({ result: 'error', error: String(err) });
  }
}

/** A browser hitting the URL directly gets a human answer, not a stack trace. */
function doGet() {
  return json({
    result: 'ok',
    message: 'The paper\'s signup endpoint is running. Signups are accepted via POST.'
  });
}

/**
 * A LockService guard keeps two simultaneous signups from writing to the same
 * row — rare, but it silently eats an address when it happens.
 */
function appendRow_(row) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET);
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
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
