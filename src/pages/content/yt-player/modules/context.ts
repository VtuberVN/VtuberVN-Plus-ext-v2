import { translations, Locale } from "@utils";
import { storage } from "webextension-polyfill";

export const videoId = window.location.pathname.split("/").slice(-1)[0];

let currentLocale: Locale = "vi";

export async function initLocale(): Promise<void> {
  const res = await storage.local.get("vtubervn_locale");
  if (res.vtubervn_locale === "en") {
    currentLocale = "en";
  } else {
    currentLocale = "vi";
  }
}

storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.vtubervn_locale) {
    currentLocale = changes.vtubervn_locale.newValue === "en" ? "en" : "vi";
  }
});

export function t(key: keyof typeof translations.vi.ytPlayer): string {
  return translations[currentLocale].ytPlayer[key];
}
