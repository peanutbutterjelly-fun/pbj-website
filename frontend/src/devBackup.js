// Dev-only safety net for drafts. While building, drafts live only in the browser's storage, and the preview browser
// clears that whenever it restarts. So the dev server also keeps a copy in a file (frontend/.dev-data/, never committed),
// and a page that finds the browser storage empty puts the copy back. Nothing here runs in the real site.
const URL_ = "/__drafts", KEY = "pbj-host-events";

export async function restoreDrafts() {
  if (!import.meta.env.DEV) return;
  try {
    if (localStorage.getItem(KEY) !== null) return; // something is there (even an empty list): leave it alone
    const r = await fetch(URL_);
    if (!r.ok) return;
    const list = await r.json();
    if (Array.isArray(list) && list.length) localStorage.setItem(KEY, JSON.stringify(list));
  } catch { /* no dev server copy: carry on */ }
}

export function backupDrafts(list) {
  if (!import.meta.env.DEV) return;
  fetch(URL_, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(list) }).catch(() => {});
}
