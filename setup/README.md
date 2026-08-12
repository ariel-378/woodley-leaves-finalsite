# Sending newsletter signups to a Google Sheet

The **Subscribe** button at the top of every page collects an email address —
and nothing else. It goes to a **Subscribers** tab in a Google Sheet you own.

> **Email only, on purpose.** An earlier version also took a phone number. A
> student paper holding other students' phone numbers is a bigger promise than
> a newsletter needs, and texting minors carries rules nobody on a student
> masthead should have to know. The endpoint now *rejects* anything carrying a
> phone number rather than quietly ignoring it. Please don't add the field back.

The site has no server, so it can't write to a spreadsheet by itself. A small
Google Apps Script sits in the middle: the page sends the signup to the script,
and the script adds a row to your Sheet.

**Until you finish this setup, the form does not pretend to work.** It tells the
reader signups aren't set up and offers an email link instead. Nobody's address
gets silently thrown away.

---

## Setup (about 10 minutes, once)

Do this from the **paper's Google account**, not a personal one — see
[Who should own this](#who-should-own-this) below.

### 1. Make the Sheet

1. Go to [sheets.new](https://sheets.new) to create a spreadsheet.
2. Name it something like **The Paper — Newsletter**.
3. You don't need to add any tabs or headers. The script creates the
   **Subscribers** tab, with headers, on the first signup.

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

In the dashboard, open **Brand design → Newsletter signups**, paste the URL into
**Google Apps Script web-app URL**, fill in a **fallback email**, and click
**Save design**.

That saves it in your browser. To make it real for readers, click **Download
config** and send the `config.js` it gives you to whoever manages the site — the
panel says as much, and keeps saying it until the file is deployed. If you'd
rather edit the file directly, it's the same four settings:

```js
submissions: {
  enabled: true,
  endpoint: "https://script.google.com/macros/s/AKfycb.../exec",
  fallbackEmail: "editor@yourschool.org",
  sheetUrl: "https://docs.google.com/spreadsheets/d/.../edit",
},
```

`fallbackEmail` is who a reader is offered if the send ever fails. If you leave
it blank, the first address in `contacts` is used. `sheetUrl` is just a
convenience link for editors — readers never see it. Setting `enabled: false`
removes the Subscribe button from every page.

### 5. Share the Sheet

**Share →** add the editor-in-chief's address. Give **Editor** access so they
can work the list.

### 6. Test it

In **Brand design → Newsletter signups**, click **Send a test signup**. It posts
to the URL in the box and reports exactly what came back; a row should appear in
the **Subscribers** tab within a few seconds. Delete the test row afterwards if
you like.

Once the config is deployed, do it once more the reader's way: open any page,
click **Subscribe**, and enter a real address.

---

## If you redeploy

Editing the script does **not** change what's live. Go to
**Deploy → Manage deployments →** pencil icon **→ Version: New version → Deploy**.
The URL stays the same, so `config.js` doesn't need touching.

---

## Who should own this

The Sheet will hold student email addresses.

- **Use a school-owned Google account, not a student's personal one.** This is
  the most important line in this file. A list of students' addresses sitting in
  an account the school does not control is a problem for the school whatever
  the intent, and when the editor who made it graduates, the Sheet and the
  script leave with them — next year's staff inherits a dead endpoint and the
  old list is unreachable. Set this up in the paper's or school's account from
  the start; moving it later means moving the data too.
- **Share with the current EIC**, and update that sharing each year.
- **Check with your adviser before collecting contact details from students.**
  Your school may have rules about this — for a mailing list of minors it very
  likely does — and they matter more than anything in this file.

## What readers should be told

The signup asks for an address and gives one thing in return: the paper. Don't
use the list for anything else without saying so at the point of signup, and
give people a way to get off it — an editor deleting the row is enough, but
somebody has to actually answer when they ask.

## Spam

The web-app URL ships in the site's source code. Anyone who views source can
find it and send data to it. **There's no way around that without a real
server** — a password in the page would be just as visible.

What's in place:

- A **honeypot** field, hidden from people but attractive to bots. Anything
  that fills it is dropped before it is ever sent.
- **Server-side validation** in the Apps Script — every field is length-capped
  and the address is checked. The browser's checks are only a convenience; the
  script never trusts them.
- A **15-second cooldown** per browser.

This stops drive-by bots. It won't stop a determined person who wants to fill
your Sheet with junk. If that happens: **Deploy → Manage deployments → Archive**
kills the endpoint instantly, then deploy a new one and update `config.js`.

## If signups stop arriving

- **Everything fails at once, right after launch on a school website:** the
  host page's Content-Security-Policy may be blocking requests to
  `script.google.com`. Open the browser console and look for a CSP error. If
  that's it, ask your web host to allow `script.google.com` in `connect-src` —
  or switch the form to a host-native tool instead.
- **"Signups aren't set up yet":** `endpoint` in `config.js` is empty or
  malformed. It must start with `https://script.google.com/macros/s/` and end
  in `/exec`.
- **Check the script's own log:** Apps Script editor → **Executions**.
