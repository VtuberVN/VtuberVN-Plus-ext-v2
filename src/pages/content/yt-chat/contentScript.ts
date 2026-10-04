import { inject, validOrigin } from "@utils";
import { storage } from "webextension-polyfill";
import injectPath from "./inject?script&module";

// Host check: ensure script only executes in YouTube context (matches *://*.youtube.com/live_chat*)
const isYouTubeHost = window.location.hostname === 'www.youtube.com' || window.location.hostname.endsWith('.youtube.com');
if (!isYouTubeHost) {
  console.warn("[VtuberVN+] yt-chat content script ignored on non-YouTube hostname:", window.location.hostname);
} else {
  inject(injectPath);

  // Initial query param parse: default to dark theme unless dark_theme=0 is explicitly passed
  const urlParams = new URLSearchParams(window.location.search);
  let currentIsDark = urlParams.get("dark_theme") !== "0";

  // Apply dark attribute to html root immediately
  if (currentIsDark) {
    document.documentElement.setAttribute("dark", "");
  }

  // MutationObserver: Preserve dark attribute on <html> against YouTube script overrides
  const themeObserver = new MutationObserver(() => {
    if (currentIsDark) {
      if (!document.documentElement.hasAttribute("dark")) {
        document.documentElement.setAttribute("dark", "");
      }
    } else {
      if (document.documentElement.hasAttribute("dark")) {
        document.documentElement.removeAttribute("dark");
      }
    }
  });

  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["dark"],
  });

  // Default Base Style (bundled fallback when offline or before remote patch loads)
  const DEFAULT_BASE_STYLE = `
    /* Override YouTube default background colors to transparent */
    :root {
      --v-theme-primary: 156, 39, 176;
      --yt-chat-bg: transparent;
      --yt-live-chat-background-color: transparent !important;
      --yt-live-chat-action-panel-background-color: transparent !important;
      --yt-live-chat-secondary-background-color: transparent !important;
      --yt-live-chat-header-background-color: transparent !important;
      --yt-live-chat-banner-gradient-scrim: transparent !important;
      --yt-live-chat-panel-pages-background: transparent !important;
      --yt-live-chat-message-input-renderer-background: transparent !important;
      --yt-live-chat-primary-background: transparent !important;
      --yt-spec-base-background: transparent !important;
      --yt-spec-general-background-a: transparent !important;
      --yt-spec-general-background-b: transparent !important;
      --yt-spec-touch-response: transparent !important;
    }

    /* Dark Mode Theme */
    html[dark] {
      color-scheme: dark !important;
      --yt-spec-additive-background: rgba(255, 255, 255, 0.05) !important;
      --yt-live-chat-primary-text-color: #f1f1f5 !important;
      --yt-live-chat-secondary-text-color: #a2a2ad !important;
      --yt-live-chat-tertiary-text-color: rgba(255, 255, 255, 0.5) !important;
    }

    /* Light Mode Theme */
    html:not([dark]) {
      color-scheme: light !important;
      --yt-spec-additive-background: rgba(0, 0, 0, 0.05) !important;
      --yt-live-chat-primary-text-color: #0f0f0f !important;
      --yt-live-chat-secondary-text-color: #606060 !important;
      --yt-live-chat-tertiary-text-color: rgba(0, 0, 0, 0.5) !important;
    }

    html, body,
    yt-live-chat-app,
    yt-live-chat-renderer,
    yt-live-chat-item-list-renderer,
    yt-live-chat-header-renderer,
    yt-live-chat-header-renderer #primary-content,
    yt-live-chat-header-renderer #header,
    #chat.yt-live-chat-renderer,
    #chat,
    #primary-content,
    #item-scroller,
    #item-offset,
    #items,
    #items.yt-live-chat-item-list-renderer,
    #item-list,
    #chat-messages,
    #contents,
    #contents.yt-live-chat-renderer,
    #contents.yt-live-chat-item-list-renderer,
    yt-live-chat-item-list-renderer #contents,
    yt-live-chat-item-list-renderer #item-scroller,
    #ticker,
    #panel-pages,
    #panel-pages.yt-live-chat-renderer,
    yt-live-chat-message-input-renderer,
    #input-panel,
    #input-panel.yt-live-chat-message-input-renderer,
    iron-pages#panel-pages,
    yt-live-chat-docked-message-renderer,
    #reaction-control-panel-overlay,
    yt-reaction-control-panel-overlay-view-model,
    #top-level-buttons-computed,
    yt-live-chat-action-panel-renderer,
    #action-panel.yt-live-chat-renderer,
    #action-panel,
    #show-more-button,
    yt-live-chat-ticker-renderer,
    #separator.yt-live-chat-renderer {
      background: transparent !important;
      background-color: transparent !important;
    }

    /* Live chat input box with glassmorphism effect */
    yt-live-chat-message-input-renderer #container {
      background: rgba(255, 255, 255, 0.06) !important;
      backdrop-filter: blur(8px) !important;
      -webkit-backdrop-filter: blur(8px) !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      border-radius: 8px !important;
      margin: 4px 8px !important;
    }
    yt-live-chat-message-input-renderer #input-panel {
      background: transparent !important;
      background-color: transparent !important;
    }
    yt-live-chat-message-input-renderer #author-name,
    yt-live-chat-message-input-renderer #input,
    yt-live-chat-text-input-field-renderer #input,
    yt-live-chat-text-input-field-renderer #label,
    #input-panel [contenteditable="true"] {
      color: #f1f1f5 !important;
    }

    /* Disable YouTube's gradient fade mask at top/bottom of chat */
    #item-scroller {
      mask-image: none !important;
      -webkit-mask-image: none !important;
    }

    /* Live polls & action panels */
    yt-live-chat-action-panel-renderer,
    yt-live-chat-action-panel-renderer #contents,
    yt-live-chat-action-panel-renderer #header {
      background: transparent !important;
      background-color: transparent !important;
      border: none !important;
      box-shadow: none !important;
    }
    yt-live-chat-poll-renderer {
      background: rgba(20, 20, 26, 0.85) !important;
      backdrop-filter: blur(8px) !important;
      -webkit-backdrop-filter: blur(8px) !important;
      border: 1px solid rgba(255, 255, 255, 0.12) !important;
      border-radius: 8px !important;
      margin: 4px 8px !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3) !important;
    }
    yt-live-chat-poll-header-renderer,
    yt-live-chat-poll-renderer #header,
    yt-live-chat-poll-renderer #collapse-container,
    yt-live-chat-poll-renderer #poll-choice-container {
      background: transparent !important;
      border: none !important;
    }
    yt-live-chat-poll-renderer,
    yt-live-chat-poll-renderer *,
    yt-live-chat-poll-renderer #poll-question,
    yt-live-chat-poll-renderer .metadata,
    yt-live-chat-poll-renderer #label-text {
      color: #f1f1f5 !important;
    }
    yt-live-chat-poll-choice tp-yt-paper-item#content {
      background: rgba(255, 255, 255, 0.08) !important;
      border: 1px solid rgba(255, 255, 255, 0.06) !important;
      border-radius: 6px !important;
    }
    yt-live-chat-poll-choice tp-yt-paper-item#content:hover {
      background: rgba(255, 255, 255, 0.14) !important;
    }
    yt-live-chat-poll-renderer #vote-percentage-bar,
    yt-live-chat-poll-renderer .progress-bar {
      background-color: rgba(var(--v-theme-primary), 0.75) !important;
    }

    /* Pinned messages & banners */
    yt-live-chat-banner-manager,
    yt-live-chat-banner-renderer {
      background: transparent !important;
      background-color: transparent !important;
      border: none !important;
      box-shadow: none !important;
    }
    yt-live-chat-pinned-message-renderer {
      background: rgba(20, 20, 26, 0.85) !important;
      backdrop-filter: blur(8px) !important;
      -webkit-backdrop-filter: blur(8px) !important;
      border-left: 3px solid rgba(var(--v-theme-primary), 0.85) !important;
      border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
      border-right: 1px solid rgba(255, 255, 255, 0.1) !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
      border-radius: 8px !important;
      margin: 4px 8px !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3) !important;
    }
    yt-live-chat-pinned-message-renderer #header,
    yt-live-chat-pinned-message-renderer #banner,
    yt-live-chat-pinned-message-renderer #content {
      background: transparent !important;
    }
    yt-live-chat-pinned-message-renderer *:not(a):not(.yt-core-attributed-string__link) {
      color: #f1f1f5 !important;
    }

    /* Preserve YouTube's standard blue link color in live chat & pinned messages */
    html[dark] yt-live-chat-text-message-renderer[author-type="owner"] #message a,
    html[dark] yt-live-chat-text-message-renderer[author-type="owner"] #message a *,
    html[dark] yt-live-chat-text-message-renderer #message a,
    html[dark] yt-live-chat-text-message-renderer #message a *,
    html[dark] yt-live-chat-pinned-message-renderer #message a,
    html[dark] yt-live-chat-pinned-message-renderer #message a *,
    html[dark] yt-live-chat-pinned-message-renderer a,
    html[dark] yt-live-chat-pinned-message-renderer a *,
    html[dark] yt-live-chat-text-message-renderer a,
    html[dark] yt-live-chat-text-message-renderer a *,
    html[dark] a.yt-core-attributed-string__link,
    html[dark] a.yt-core-attributed-string__link *,
    html[dark] #message a.yt-simple-endpoint,
    html[dark] #message a.yt-simple-endpoint * {
      color: #3ea6ff !important;
      text-decoration: underline !important;
      text-underline-offset: 2px !important;
      cursor: pointer !important;
      word-break: break-all !important;
      transition: color 0.15s ease, opacity 0.15s ease !important;
    }
    html[dark] yt-live-chat-text-message-renderer[author-type="owner"] #message a:hover,
    html[dark] yt-live-chat-text-message-renderer[author-type="owner"] #message a:hover *,
    html[dark] yt-live-chat-text-message-renderer #message a:hover,
    html[dark] yt-live-chat-text-message-renderer #message a:hover *,
    html[dark] yt-live-chat-pinned-message-renderer #message a:hover,
    html[dark] yt-live-chat-pinned-message-renderer #message a:hover *,
    html[dark] yt-live-chat-pinned-message-renderer a:hover,
    html[dark] yt-live-chat-pinned-message-renderer a:hover *,
    html[dark] yt-live-chat-text-message-renderer a:hover,
    html[dark] yt-live-chat-text-message-renderer a:hover *,
    html[dark] a.yt-core-attributed-string__link:hover,
    html[dark] a.yt-core-attributed-string__link:hover *,
    html[dark] #message a.yt-simple-endpoint:hover,
    html[dark] #message a.yt-simple-endpoint:hover * {
      color: #70baff !important;
      opacity: 0.9 !important;
    }

    html:not([dark]) yt-live-chat-text-message-renderer[author-type="owner"] #message a,
    html:not([dark]) yt-live-chat-text-message-renderer[author-type="owner"] #message a *,
    html:not([dark]) yt-live-chat-text-message-renderer #message a,
    html:not([dark]) yt-live-chat-text-message-renderer #message a *,
    html:not([dark]) yt-live-chat-pinned-message-renderer #message a,
    html:not([dark]) yt-live-chat-pinned-message-renderer #message a *,
    html:not([dark]) yt-live-chat-pinned-message-renderer a,
    html:not([dark]) yt-live-chat-pinned-message-renderer a *,
    html:not([dark]) yt-live-chat-text-message-renderer a,
    html:not([dark]) yt-live-chat-text-message-renderer a *,
    html:not([dark]) a.yt-core-attributed-string__link,
    html:not([dark]) a.yt-core-attributed-string__link *,
    html:not([dark]) #message a.yt-simple-endpoint,
    html:not([dark]) #message a.yt-simple-endpoint * {
      color: #065fd4 !important;
      text-decoration: underline !important;
      text-underline-offset: 2px !important;
      cursor: pointer !important;
      word-break: break-all !important;
      transition: color 0.15s ease, opacity 0.15s ease !important;
    }
    html:not([dark]) yt-live-chat-text-message-renderer[author-type="owner"] #message a:hover,
    html:not([dark]) yt-live-chat-text-message-renderer[author-type="owner"] #message a:hover *,
    html:not([dark]) yt-live-chat-text-message-renderer #message a:hover,
    html:not([dark]) yt-live-chat-text-message-renderer #message a:hover *,
    html:not([dark]) yt-live-chat-pinned-message-renderer #message a:hover,
    html:not([dark]) yt-live-chat-pinned-message-renderer #message a:hover *,
    html:not([dark]) yt-live-chat-pinned-message-renderer a:hover,
    html:not([dark]) yt-live-chat-pinned-message-renderer a:hover *,
    html:not([dark]) yt-live-chat-text-message-renderer a:hover,
    html:not([dark]) yt-live-chat-text-message-renderer a:hover *,
    html:not([dark]) a.yt-core-attributed-string__link:hover,
    html:not([dark]) a.yt-core-attributed-string__link:hover *,
    html:not([dark]) #message a.yt-simple-endpoint:hover,
    html:not([dark]) #message a.yt-simple-endpoint:hover * {
      color: #0448a3 !important;
      opacity: 0.9 !important;
    }

    /* Channel owner & moderator message styling */
    yt-live-chat-text-message-renderer[author-type="owner"] {
      background-color: rgba(var(--v-theme-primary), 0.12) !important;
      border-left: 3px solid rgba(var(--v-theme-primary), 0.85) !important;
    }
    /* Channel owner: gold badge with high-contrast text */
    yt-live-chat-text-message-renderer[author-type="owner"]:not(yt-live-chat-pinned-message-renderer *) yt-live-chat-author-chip,
    yt-live-chat-text-message-renderer[author-type="owner"]:not(yt-live-chat-pinned-message-renderer *) #author-name {
      background-color: #ffd600 !important;
      color: #000000 !important;
      border-radius: 4px !important;
      padding: 1px 6px !important;
      font-weight: 600 !important;
    }
    yt-live-chat-text-message-renderer[author-type="moderator"] {
      border-left: 3px solid #00bcd4 !important;
    }
    yt-live-chat-text-message-renderer #message {
      color: #f1f1f5 !important;
    }
    yt-live-chat-text-message-renderer:not([author-type="owner"]):not([author-type="moderator"]):not([author-type="member"]):not([author-type="verified"]) #author-name {
      color: #f1f1f5 !important;
    }

    /* Ensure custom member loyalty badge is visible (prevent fallback to grey star) */
    yt-live-chat-author-badge-renderer[type="member"],
    yt-live-chat-author-badge-renderer[type="member"] #image,
    yt-live-chat-author-badge-renderer[type="member"] #image img {
      display: inline-block !important;
      vertical-align: middle !important;
      border-radius: 2px !important;
      width: 16px !important;
      height: 16px !important;
    }
    yt-live-chat-author-badge-renderer[type="member"] img:not([hidden]) {
      display: inline-block !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
    /* Hide default star SVG icon when channel has a custom badge image */
    yt-live-chat-author-badge-renderer[type="member"]:has(img[src]) yt-icon#icon,
    yt-live-chat-author-badge-renderer[type="member"]:has(#image:not([hidden])) yt-icon#icon {
      display: none !important;
    }
    /* Member username highlight using YouTube's standard green */
    html[dark] yt-live-chat-text-message-renderer[author-type="member"] #author-name {
      color: #2ba640 !important;
      font-weight: 500 !important;
    }
    html:not([dark]) yt-live-chat-text-message-renderer[author-type="member"] #author-name {
      color: #0f8b2d !important;
      font-weight: 500 !important;
    }

    /* Custom Scrollbar Styles */
    yt-live-chat-item-list-renderer #item-scroller {
      scrollbar-width: thin !important;
      scrollbar-color: rgba(var(--v-theme-primary), 0.65) transparent !important;
    }
    #item-scroller::-webkit-scrollbar,
    yt-live-chat-item-list-renderer #item-scroller::-webkit-scrollbar {
      width: 14px !important;
      height: 14px !important;
      display: block !important;
      background: transparent !important;
    }
    #item-scroller::-webkit-scrollbar-track,
    yt-live-chat-item-list-renderer #item-scroller::-webkit-scrollbar-track {
      background: transparent !important;
    }
    #item-scroller::-webkit-scrollbar-thumb,
    yt-live-chat-item-list-renderer #item-scroller::-webkit-scrollbar-thumb {
      background-color: rgba(var(--v-theme-primary), 0.65) !important;
      border-radius: 7px !important;
      border: 3px solid transparent !important;
      background-clip: padding-box !important;
      min-height: 32px !important;
    }
    #item-scroller::-webkit-scrollbar-thumb:hover,
    yt-live-chat-item-list-renderer #item-scroller::-webkit-scrollbar-thumb:hover {
      background-color: rgba(var(--v-theme-primary), 1) !important;
    }
    * {
      scrollbar-width: thin !important;
      scrollbar-color: rgba(var(--v-theme-primary), 0.65) transparent !important;
    }
  `;

  // Base style element: inject immediately to prevent white flash and establish transparent Flat UI
  const baseStyleEl = document.createElement("style");
  baseStyleEl.id = "vtubervn-chat-base";
  baseStyleEl.textContent = DEFAULT_BASE_STYLE;
  (document.head || document.documentElement).appendChild(baseStyleEl);

  // Dynamic theme style element: holds custom CSS pushed from the Nuxt useThemeSync composable
  let syncStyleEl = document.getElementById("vtubervn-theme-sync-style") as HTMLStyleElement | null;
  if (!syncStyleEl) {
    syncStyleEl = document.createElement("style");
    syncStyleEl.id = "vtubervn-theme-sync-style";
    (document.head || document.documentElement).appendChild(syncStyleEl);
  }

  let isGlassEnabled = true;

  // ─── HUD Mini Toast Notification ────────────────────────────────
  function showHudToast(message: string, durationMs = 1800) {
    try {
      let toastEl = document.getElementById("vtubervn-hud-toast");
      if (!toastEl) {
        toastEl = document.createElement("div");
        toastEl.id = "vtubervn-hud-toast";
        toastEl.style.cssText = `
          position: fixed;
          top: 10px;
          right: 12px;
          z-index: 9999999;
          background: rgba(20, 20, 26, 0.92);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          color: #f1f1f5;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 500;
          font-family: Roboto, Arial, sans-serif;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
          pointer-events: none;
          transition: opacity 0.25s ease, transform 0.25s ease;
          opacity: 0;
          transform: translateY(-6px);
        `;
        (document.body || document.documentElement).appendChild(toastEl);
      }

      toastEl.textContent = message;
      toastEl.style.opacity = "1";
      toastEl.style.transform = "translateY(0)";

      const timerId = Number(toastEl.getAttribute("data-timer-id"));
      if (timerId) clearTimeout(timerId);

      const newTimerId = window.setTimeout(() => {
        if (toastEl) {
          toastEl.style.opacity = "0";
          toastEl.style.transform = "translateY(-6px)";
        }
      }, durationMs);
      toastEl.setAttribute("data-timer-id", String(newTimerId));
    } catch {
      // Ignore DOM access issues
    }
  }

  // ─── OTA Dynamic Patch Fetcher ──────────────────────────────────
  const PATCH_API_URLS = [
    "https://vtuberhub.vn/api/v1/extension/livechat-theme",
  ];

  interface LiveChatPatchStorage {
    version: string;
    css: string;
    fetchedAt: number;
  }

  function isValidPatch(data: unknown): data is { css: { base: string }; patchVersion: string } {
    if (!data || typeof data !== "object") return false;
    const d = data as { css?: { base?: string }; patchVersion?: string };
    if (typeof d.patchVersion !== "string" || !/^[0-9a-zA-Z._-]{1,32}$/.test(d.patchVersion)) return false;
    if (!d.css || typeof d.css.base !== "string") return false;
    if (d.css.base.length === 0 || d.css.base.length > 200 * 1024) return false;
    return true;
  }

  async function fetchLiveChatPatch(force = false) {
    if (force) {
      showHudToast("VtuberVN: Checking for updates...");
    }

    for (const url of PATCH_API_URLS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) continue;
        const data = await res.json();

        if (isValidPatch(data)) {
          const newPatch: LiveChatPatchStorage = {
            version: data.patchVersion,
            css: data.css.base,
            fetchedAt: Date.now(),
          };

          await storage.local.set({ vtubervn_livechat_patch: newPatch });
          if (isGlassEnabled) {
            baseStyleEl.textContent = data.css.base;
          }

          if (force) {
            showHudToast(`VtuberVN: Updated patch v${data.patchVersion}`);
          }
          return;
        }
      } catch {
        // Try next fallback endpoint
      }
    }

    if (force) {
      showHudToast("VtuberVN: Unable to connect to update server");
    }
  }

  // ─── Cache & Stale-While-Revalidate Initialization ─────────────
  async function initOtaAndHotkeys() {
    try {
      const stored = await storage.local.get([
        "vtubervn_livechat_patch",
        "vtubervn_livechat_glass_disabled",
      ]);

      if (stored?.vtubervn_livechat_glass_disabled === true) {
        isGlassEnabled = false;
        baseStyleEl.disabled = true;
        if (syncStyleEl) syncStyleEl.disabled = true;
      }

      const patch = stored?.vtubervn_livechat_patch as LiveChatPatchStorage | undefined;
      if (patch?.css && isGlassEnabled) {
        baseStyleEl.textContent = patch.css;
      }

      // Stale-While-Revalidate: Fetch in background if cache is missing or older than 12 hours
      const STALE_TTL = 12 * 60 * 60 * 1000;
      if (!patch || !patch.fetchedAt || Date.now() - patch.fetchedAt > STALE_TTL) {
        fetchLiveChatPatch(false).catch(() => {});
      }
    } catch {
      // Fallback to DEFAULT_BASE_STYLE
    }
  }

  initOtaAndHotkeys();

  // ─── Keyboard Shortcuts: F9 (Toggle Glass) & Shift+F9 (Force Update) ─
  window.addEventListener("keydown", (e) => {
    // Do not intercept hotkeys when typing in input or textarea elements
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
      return;
    }

    if (e.key === "F9") {
      e.preventDefault();

      if (e.shiftKey) {
        // Shift + F9: Force Refresh Patch
        fetchLiveChatPatch(true).catch(() => {});
      } else {
        // F9: Toggle Glass Effect
        isGlassEnabled = !isGlassEnabled;
        baseStyleEl.disabled = !isGlassEnabled;
        if (syncStyleEl) syncStyleEl.disabled = !isGlassEnabled;

        storage.local.set({ vtubervn_livechat_glass_disabled: !isGlassEnabled }).catch(() => {});
        showHudToast(
          isGlassEnabled ? "VtuberVN: Glass Theme Enabled [F9]" : "VtuberVN: Glass Theme Disabled [F9]"
        );
      }
    }
  });

  const applyThemePayload = (payload: { cssText?: string; isDark?: boolean }) => {
    if (typeof payload.isDark === 'boolean') {
      currentIsDark = payload.isDark;
      if (currentIsDark) {
        document.documentElement.setAttribute("dark", "");
      } else {
        document.documentElement.removeAttribute("dark");
      }
    }

    if (payload.cssText && syncStyleEl) {
      syncStyleEl.textContent = payload.cssText;
    }
  };

  // Relay events from parent frame to window context (cross-origin relay)
  window.addEventListener("message", (event) => {
    if (event.source === window) return;

    // Security: only allow relays from authenticated origins (vtuberhub.vn, holodex.net, localhost)
    if (!validOrigin(event.origin)) return;

    // Handle theme sync message from Nuxt
    if (event.data?.type === "VTUBERVN_THEME_SYNC" && event.data?.payload) {
      applyThemePayload(event.data.payload);
    }

    window.postMessage(event.data, window.location.origin);
  });

  // ─── Listen for Header Close Button Click ─────────────────────
  const handleCloseTrigger = (e: Event) => {
    let isClose = false;
    const path = typeof (e as MouseEvent).composedPath === "function" ? (e as MouseEvent).composedPath() : [];

    for (const el of path) {
      if (el instanceof Element) {
        const id = el.id || "";
        const ariaLabel = (el.getAttribute("aria-label") || "").toLowerCase();
        const title = (el.getAttribute("title") || "").toLowerCase();
        const tagName = el.tagName.toLowerCase();

        if (
          id === "close-button" ||
          (tagName === "yt-icon-button" && id === "close-button") ||
          ariaLabel === "đóng" ||
          ariaLabel === "close" ||
          ariaLabel.includes("đóng trò chuyện") ||
          ariaLabel.includes("close chat") ||
          title === "đóng" ||
          title === "close"
        ) {
          isClose = true;
          break;
        }
      }
    }

    if (!isClose && (e.target instanceof Element)) {
      const target = e.target as Element;
      if (
        target.closest(
          '#close-button, yt-live-chat-header-renderer #close-button, yt-icon-button#close-button, [aria-label*="Đóng"], [aria-label*="Close"]'
        )
      ) {
        isClose = true;
      }
    }

    if (isClose) {
      console.log("[VtuberVN+] Header close button clicked, notifying parent window to close chat");
      try {
        const targetOrigin = validOrigin(document.referrer) ? new URL(document.referrer).origin : "https://vtuberhub.vn";
        window.parent.postMessage({ type: "VTUBERVN_CLOSE_CHAT" }, targetOrigin);
      } catch {
        // Ignore cross-origin error
      }
    }
  };

  document.addEventListener("click", handleCloseTrigger, true);
  document.addEventListener("pointerup", handleCloseTrigger, true);
}
