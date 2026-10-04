import { inject } from "@utils";
import { storage } from "webextension-polyfill";
import injectPath from "./vtubervn-inject?script&module";

if (!import.meta.env.DEV) {
  console.log = () => {};
  console.debug = () => {};
}

inject(injectPath).catch(e => {
  console.error("[VtuberVN+] Failed to inject vtubervn-inject:", e);
});

// Listen for locale and theme synchronization events from inject script
window.addEventListener('message', (event) => {
  try {
    if (event.data?.type === 'VTUBERVN_LOCALE_SYNC' && event.data?.locale) {
      storage.local.set({ vtubervn_locale: event.data.locale }).catch(() => {});
    }
    if (event.data?.type === 'VTUBERVN_THEME_SYNC' && event.data?.theme) {
      storage.local.set({ vtubervn_theme: event.data.theme }).catch(() => {});
    }
  } catch {
    // Ignore Extension context invalidated error on reload
  }
});
