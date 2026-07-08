import { inject } from "@utils";
import { storage } from "webextension-polyfill";
import injectPath from "./vtubervn-inject?script&module";

console.log("[VtuberVN+] Content Script for vtuberhub.vn loading...");
console.log("[VtuberVN+] injectPath:", injectPath);

inject(injectPath).then(() => {
  console.log("[VtuberVN+] Injected vtubervn-inject successfully!");
}).catch(e => {
  console.error("[VtuberVN+] Failed to inject vtubervn-inject:", e);
});

// Nhận data từ inject script → lưu vào storage cho popup đọc
window.addEventListener('message', (event) => {
  try {
    if (event.data?.type === 'VTUBERVN_LOCALE_SYNC' && event.data?.locale) {
      storage.local.set({ vtubervn_locale: event.data.locale }).catch(() => {});
    }
    if (event.data?.type === 'VTUBERVN_USER_SYNC') {
      if (event.data.user) {
        console.log("[VtuberVN+] contentScript received VTUBERVN_USER_SYNC successfully!");
      }
      storage.local.set({ vtubervn_user: event.data.user }).then(() => {
        if (event.data.user) {
          console.log("[VtuberVN+] Saved user to storage.local!");
        }
      }).catch(() => {});
    }
    if (event.data?.type === 'VTUBERVN_THEME_SYNC') {
      // console.log("[VtuberVN+] contentScript received VTUBERVN_THEME_SYNC:", event.data.theme);
      storage.local.set({ vtubervn_theme: event.data.theme }).then(() => {
        // console.log("[VtuberVN+] Saved theme to storage.local!");
      }).catch(() => {});
    }
  } catch (err) {
    // Ignore Extension context invalidated error on reload
  }
});
