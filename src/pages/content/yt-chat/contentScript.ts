import { inject, validOrigin } from "@utils";
import injectPath from "./inject?script&module";

inject(injectPath);

// Inject ngay lập tức: thiết lập color-scheme đúng và xóa nền trắng mặc định
// Không chờ theme sync — tránh flash trắng khi iframe load
const baseStyleEl = document.createElement("style");
baseStyleEl.id = "vtubervn-chat-base";
baseStyleEl.textContent = `
  /* Chỉ thiết lập nền trong suốt để tránh flash trắng */
  :root {
    --v-theme-primary: 255, 255, 255;
    --yt-chat-bg: transparent;
  }
  
  html, body {
    background: var(--yt-chat-bg) !important;
  }
  yt-live-chat-app,
  yt-live-chat-renderer,
  yt-live-chat-item-list-renderer,
  yt-live-chat-header-renderer,
  #primary-content,
  #item-scroller,
  #item-list,
  #chat-messages,
  #contents,
  #ticker {
    background: var(--yt-chat-bg) !important;
  }
`;
(document.head || document.documentElement).appendChild(baseStyleEl);

// Re-emit events từ parent frame sang window (cross-origin relay)
// Guard: không re-post message từ chính window này → tránh infinite loop
window.addEventListener("message", (event) => {
  if (event.source === window) return;

  // Intercept theme sync from VtuberVN website
  if (event.data && event.data.type === 'VTUBERVN_THEME_SYNC') {
    const payload = event.data.payload;
    if (payload) {
      const root = document.documentElement;
      
      // 1. Sync dark/light mode attribute
      if (typeof payload.isDark === 'boolean') {
        root.style.colorScheme = payload.isDark ? 'dark' : 'light';
        if (payload.isDark) {
          root.setAttribute('dark', 'true');
          document.body?.setAttribute('dark', 'true');
        } else {
          root.removeAttribute('dark');
          document.body?.removeAttribute('dark');
        }
      }

      // 2. Inject CSS string from website
      if (payload.cssText) {
        let dynamicStyle = document.getElementById("vtubervn-chat-dynamic");
        if (!dynamicStyle) {
          dynamicStyle = document.createElement("style");
          dynamicStyle.id = "vtubervn-chat-dynamic";
          document.head.appendChild(dynamicStyle);
        }
        dynamicStyle.textContent = payload.cssText;
      }
    }
  }

  if (validOrigin(event.origin)) {
    window.postMessage(event.data, "*");
  }
});
