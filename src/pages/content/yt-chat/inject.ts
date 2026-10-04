// Fix theme not following query param on archive / live chat
const darkThemeParam = new URLSearchParams(window.location.search).get(
  "dark_theme",
);
if (darkThemeParam === "1" || darkThemeParam === null) {
  document.documentElement.setAttribute("dark", "");
} else if (darkThemeParam === "0") {
  document.documentElement.removeAttribute("dark");
}

// Listen for relay from content script to synchronize dark theme attribute on MAIN world
window.addEventListener("message", (event) => {
  if (event.data?.type === "VTUBERVN_THEME_SYNC" && event.data?.payload) {
    if (typeof event.data.payload.isDark === 'boolean') {
      if (event.data.payload.isDark) {
        document.documentElement.setAttribute("dark", "");
      } else {
        document.documentElement.removeAttribute("dark");
      }
    }
  }
});

if (!import.meta.env.DEV) {
  const _log = console.log;
  console.log = (...args: any[]) => {
    if (args.length > 0 && typeof args[0] === 'string' && (args[0].includes('[VtuberVN+]') || args[0].includes('[VtuberVN+ Lite]'))) {
      return;
    }
    _log(...args);
  };
}

console.log("[VtuberVN+] live chat overrides injected");

export {};
