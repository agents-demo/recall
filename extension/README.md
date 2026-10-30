# RECALL browser extension

A minimal Manifest V3 extension: it reads the title and URL of the active tab (on click only) and opens
RECALL's share-target review. No page content is scraped, no network request is made by the extension, and
the user still confirms the capture in the app.

## Load it

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. **Load unpacked** and select this `extension/` folder.
4. Click the RECALL action on any tab, review the note, then **Open in RECALL**.

The extension opens the public demo by default. Change the URL in `popup.js` for a local or pilot
deployment.
