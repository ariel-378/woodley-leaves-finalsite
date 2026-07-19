# Sending reader submissions to a Google Sheet

Three forms on the site collect things from readers:

| Form | Where it is | Goes to tab |
|------|-------------|-------------|
| Newsletter signup | "Subscribe", top of every page | **Subscribers** |
| Staff signup | "Interested in writing?", top of every page | **Writers** |
| Story pitch | `tip.html` ("Pitch a story") | **Story Pitches** |

The site has no server, so it can't write to a spreadsheet by itself. A small
Google Apps Script sits in the middle: the page sends the form to the script,
and the script adds a row to your Sheet.

**Until you finish this setup, those forms do not pretend to work.** They tell
the reader submissions aren't set up and offer an email link instead. Nothing
a student writes gets silently thrown away.

---

## Setup (about 10 minutes, once)

Do this from the **paper's Google account**, not a personal one — see
[Who should own this](#who-should-own-this) below.

### 1. Make the Sheet

1. Go to [sheets.new](https://sheets.new) to create a spreadsheet.
2. Name it something like **The Paper — Submissions**.
3. You don't need to add any tabs or headers. The script creates
   **Subscribers**, **Writers**, and **Story Pitches** automatically.

### 2. Add the script

1. In the Sheet, go to **Extensions → Apps Script**.
2. Delete whatever is in the editor.
3. Paste in the entire contents of **`google-sheet-endpoint.gs`** (next to this
   file).
4. Click the **Save** icon.

### 3. Publish it

1. Click **Deploy → New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. Set:
   - **Execute as:** *Me*
   - **Who has access:** **Anyone**
4. Click **Deploy**.
5. Google will ask you to **authorize**. It will warn that the app "isn't
   verified" — that's expected for a script you wrote yourself. Click
   **Advanced → Go to (your project name)** and allow it.
6. Copy the **Web app URL**. It looks like:

   ```
   https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxxxxxx/exec
   ```

> **"Who has access: Anyone" is required** — readers aren't signed into your
> Google account, so the script must accept anonymous requests. This is what
> makes the endpoint public; see [Spam](#spam) below.

### 4. Tell the site about it

Open **`config.js`** and paste the URL in:

```js
submissions: {
  endpoint: "https://script.google.com/macros/s/AKfycb.../exec",
  fallbackEmail: "editor@yourschool.org",
},
```

`fallbackEmail` is who a reader is offered if the send ever fails. If you leave
it blank, the first address in `contacts` is used.

### 5. Share the Sheet

**Share → ** add the editor-in-chief's address. Give **Editor** access so they
can add notes and mark pitches as handled.

### 6. Test it

Open `tip.html`, submit a real pitch, and confirm a row appears in **Story
Pitches**. Do the same for Subscribe and "Interested in writing?".

---

## If you redeploy

Editing the script does **not** change what's live. Go to
**Deploy → Manage deployments →** pencil icon **→ Version: New version → Deploy**.
The URL stays the same, so `config.js` doesn't need touching.

---

## Who should own this

The Sheet will hold student email addresses, phone numbers, and pitches that
may be sensitive or sent anonymously.

- **Use the paper's or school's Google account, not a personal one.** When an
  editor graduates, a personally-owned Sheet and script leave with them, and
  next year's staff inherits a dead endpoint.
- **Share with the current EIC**, and update that sharing each year.
- **Check with your adviser** before collecting contact information from
  students. Your school may have rules about this, and they matter more than
  anything in this file.

## Anonymity

The pitch form tells readers: *"Leave your info blank if you want — we don't
need it to read you."* Keep that true. Name and email are optional, and the
script records only what the reader actually typed plus the time it arrived.
Don't add anything that identifies people who chose to stay anonymous.

## Spam

The web-app URL ships in the site's source code. Anyone who views source can
find it and send data to it. **There's no way around that without a real
server** — a password in the page would be just as visible.

What's in place:

- A **honeypot** field, hidden from people but attractive to bots. Anything
  that fills it is dropped silently.
- **Server-side validation** in the Apps Script — every field is length-capped
  and checked. The browser's checks are only a convenience; the script never
  trusts them.
- A **15-second cooldown** per form, per browser.

This stops drive-by bots. It won't stop a determined person who wants to fill
your Sheet with junk. If that happens: **Deploy → Manage deployments → Archive**
kills the endpoint instantly, then deploy a new one and update `config.js`.

## If submissions stop arriving

- **Everything fails at once, right after launch on a school website:** the
  host page's Content-Security-Policy may be blocking requests to
  `script.google.com`. Open the browser console and look for a CSP error. If
  that's it, ask your web host to allow `script.google.com` in `connect-src` —
  or switch these forms to a host-native form tool instead.
- **"Online submissions aren't set up yet":** `endpoint` in `config.js` is
  empty or malformed. It must start with `https://script.google.com/macros/s/`
  and end in `/exec`.
- **Check the script's own log:** Apps Script editor → **Executions**.
