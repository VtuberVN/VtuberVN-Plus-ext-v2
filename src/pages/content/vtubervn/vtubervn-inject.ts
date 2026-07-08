// @ts-ignore
window.ARCHIVE_CHAT_OVERRIDE = true;
// @ts-ignore
window.HOLODEX_PLUS_INSTALLED = true;
// @ts-ignore
window.VtuberVN_PLUS_INSTALLED_V3 = true;
// @ts-ignore — Audio Visualizer: cho main app biết extension hỗ trợ capture audio data
window.VtuberVN_AUDIO_VISUALIZER_SUPPORTED = true;

console.log("[VtuberVN+] Activated");

// ─── Audio Visualizer Bridge ──────────────────────────────────────
// Forward audio data từ YouTube embed iframes lên main page context.
//
// Architecture (giải quyết vấn đề multi-iframe):
//   - audioCapture.ts inject vào MỌI YouTube embed iframe
//   - Nhưng CHỈ iframe nào nhận được START command mới capture
//   - Main app gửi START trực tiếp tới iframe music player (qua iframeRef)
//   - Audio data kèm sessionId để main app filter đúng nguồn
//   - Iframe live stream / video embed KHÔNG bị ảnh hưởng

window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data?.type) return;

  // Forward audio data + ACK + heartbeat từ iframe lên main page (dispatch CustomEvent)
  if (data.type === 'VTUBERVN_AUDIO_DATA' || data.type === 'VTUBERVN_AUDIO_CAPTURE_ACK' || data.type === 'VTUBERVN_AUDIO_CAPTURE_HEARTBEAT') {
    window.dispatchEvent(new CustomEvent('vtubervn-audio-data', {
      detail: data,
    }));
  }
});

// ─── Locale Sync (popup i18n) ─────────────────────────────────────
// Detect ngôn ngữ đang dùng trên VtuberVN → gửi về contentScript → lưu storage
function detectAndSyncLocale() {
  // Nuxt i18n lưu locale trong: html[lang], hoặc localStorage key 'i18n_redirected'
  const htmlLang = document.documentElement.lang; // vd: "vi", "en"
  const storedLocale = localStorage.getItem('i18n_redirected'); // vd: "vi", "en"
  const locale = htmlLang || storedLocale || navigator.language.split('-')[0] || 'vi';
  const normalized = locale.startsWith('vi') ? 'vi' : 'en';
  window.postMessage({ type: 'VTUBERVN_LOCALE_SYNC', locale: normalized }, '*');
}

// Sync ngay khi inject
detectAndSyncLocale();

// Sync lại khi Nuxt navigate (SPA routing thay đổi ngôn ngữ)
const localeObserver = new MutationObserver(() => {
  detectAndSyncLocale();
});
localeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });


// Detect user login status từ Pinia localStorage → gửi về contentScript → lưu extension storage
(window as any).__vtubervn_ext_v2 = true;

function detectAndSyncUser() {
  try {
    const keys = ['vtubervn_user', 'user', 'auth'];
    let userStr: string | null = null;
    let foundKey = '';

    for (const key of keys) {
      userStr = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (userStr) {
        foundKey = key;
        break;
      }
      
      const match = document.cookie.match(new RegExp(`(?:^|;)\\s*${encodeURIComponent(key)}=([^;]*)`));
      if (match) {
        userStr = decodeURIComponent(match[1]);
        foundKey = key;
        break;
      }
    }

    // NUXT 3 Fallback
    let nuxtUser = null;
    try {
      // @ts-ignore
      const nuxt = window.__NUXT__;
      if (nuxt) {
        const nuxtState = nuxt.payload?.state || nuxt.state || {};
        nuxtUser = nuxtState['$sauth:user'] || nuxtState['auth:user'] || nuxtState.pinia?.user?.currentUser;
        if (nuxtUser) {
          console.log("[VtuberVN+] Found user directly from window.__NUXT__");
        }
      }
    } catch (e) { }

    if (!userStr && !nuxtUser) {
      window.postMessage({ type: 'VTUBERVN_USER_SYNC', user: null }, '*');
      return;
    }

    if (nuxtUser) {
      try {
        const clonedUser = JSON.parse(JSON.stringify(nuxtUser));
        window.postMessage({ type: 'VTUBERVN_USER_SYNC', user: clonedUser }, '*');
      } catch(e) {
        window.postMessage({ type: 'VTUBERVN_USER_SYNC', user: null }, '*');
      }
      return;
    }

    const userObj = JSON.parse(userStr!);
    const u = userObj.currentUser !== undefined ? userObj.currentUser : userObj;
    if (u) console.log("[VtuberVN+] Parsed user from storage.");
    window.postMessage({ type: 'VTUBERVN_USER_SYNC', user: u || null }, '*');
  } catch (e) {
    window.postMessage({ type: 'VTUBERVN_USER_SYNC', user: null }, '*');
  }
}

// Hook vào fetch để cướp Authorization header nếu có (hacky but works)
const originalFetch = window.fetch;
window.fetch = async function(...args) {
  try {
    const request = args[0];
    const options = args[1] || {};
    let headers = options.headers || {};
    if (request instanceof Request) {
      headers = request.headers;
    }
    
    let authHeader = null;
    if (headers instanceof Headers) {
      authHeader = headers.get('Authorization');
    } else if (typeof headers === 'object') {
      authHeader = Object.keys(headers).find(k => k.toLowerCase() === 'authorization');
      if (authHeader) authHeader = headers[authHeader as keyof typeof headers];
    }
    
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payloadBase64 = token.split('.')[1];
      if (payloadBase64) {
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        if (payload && (payload.id || payload.username || payload.name)) {
          console.log("[VtuberVN+] STOLEN JWT FROM FETCH:", payload);
          const u = {
            id: payload.id,
            username: payload.username || payload.name || payload.displayName,
            displayName: payload.displayName || payload.name,
            avatar: payload.avatar || payload.avatarUrl || payload.avatar_url,
          };
          window.postMessage({ type: 'VTUBERVN_USER_SYNC', user: u }, '*');
        }
      }
    }
  } catch (e) {}
  return originalFetch.apply(this, args);
};

// Hook vào XMLHttpRequest để cướp header
const originalOpen = XMLHttpRequest.prototype.open;
const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
  if (header.toLowerCase() === 'authorization' && value.startsWith('Bearer ')) {
    try {
      const token = value.split(' ')[1];
      const payloadBase64 = token.split('.')[1];
      if (payloadBase64) {
        const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        if (payload && (payload.id || payload.username || payload.name)) {
          console.log("[VtuberVN+] STOLEN JWT FROM XHR:", payload);
          const u = {
            id: payload.id,
            username: payload.username || payload.name || payload.displayName,
            displayName: payload.displayName || payload.name,
            avatar: payload.avatar || payload.avatarUrl || payload.avatar_url,
          };
          window.postMessage({ type: 'VTUBERVN_USER_SYNC', user: u }, '*');
        }
      }
    } catch (e) {}
  }
  return originalSetRequestHeader.apply(this, arguments as any);
};

// Chạy khi script vừa load
detectAndSyncUser();

// Chạy lại vài lần để chờ Nuxt hydration
[1000, 3000, 5000].forEach(delay => setTimeout(detectAndSyncUser, delay));

// Chắc chắn nhất là chờ window load xong
window.addEventListener('load', detectAndSyncUser);

const vtuberThemes = [
  { name: 'Bubblegum', id: 0, themes: { dark: { background: '#121212', primary: '#F06292', secondary: '#3b88d5' }, light: { background: '#f2f2f2', primary: '#F06292', secondary: '#64B5F6' } } },
  { name: 'Citrus', id: 1, themes: { dark: { background: '#121212', primary: '#faa749', secondary: '#82D251' }, light: { background: '#f2f2f2', secondary: '#839C35', primary: '#F2AD46' } } },
  { name: 'Bakery', id: 2, themes: { dark: { background: '#0D0707', primary: '#B07975', secondary: '#D57E3D' }, light: { background: '#f2f2f2', primary: '#F6D68D', secondary: '#80CDC7' } } },
  { name: 'Emerald', id: 3, themes: { dark: { background: '#121212', primary: '#22C4AC', secondary: '#5783BF' }, light: { background: '#f2f2f2', primary: '#9E65A6', secondary: '#F2C9EB' } } },
  { name: 'Winter Gold', id: 4, themes: { dark: { background: '#0C111A', primary: '#9E8461', secondary: '#83B0BD' }, light: { background: '#FDFDFD', primary: '#317192', secondary: '#83B0BD' } } },
  { name: 'Teal Mist', id: 5, themes: { dark: { background: '#121212', primary: '#8FB5B7', secondary: '#688BA1' }, light: { background: '#F5F5F5', primary: '#688BA1', secondary: '#8FB5B7' } } },
  { name: 'Mystic Purple', id: 6, themes: { dark: { background: '#121212', primary: '#998AEB', secondary: '#684C7C' }, light: { background: '#F2F2F2', primary: '#684C7C', secondary: '#998AEB' } } },
  { name: 'Dragon Fire', id: 7, themes: { dark: { background: '#121212', primary: '#D3B633', secondary: '#FF9A63' }, light: { background: '#f2f2f2', secondary: '#B333C9', primary: '#FF9257' } } },
  { name: 'Starlight', id: 8, themes: { dark: { background: '#121212', primary: '#a8d6fc', secondary: '#3c3a97' }, light: { background: '#f2f2f2', secondary: '#a8d6fc', primary: '#3c3a97' } } },
  { name: 'Heart Beat', id: 9, themes: { dark: { background: '#121212', primary: '#ffe799', secondary: '#d52d43' }, light: { background: '#f2f2f2', secondary: '#ffe799', primary: '#d52d43' } } },
  { name: 'Cherry Blossom', id: 10, themes: { dark: { background: '#121212', primary: '#fbb3a5', secondary: '#fe7c8b' }, light: { background: '#f2f2f2', secondary: '#fe7c8b', primary: '#fbb3a5' } } },
  { name: 'Crimson', id: 11, themes: { dark: { background: '#121212', primary: '#d91a5d', secondary: '#98395c' }, light: { background: '#f2f2f2', secondary: '#58294c', primary: '#d91a5d' } } },
  { name: 'Candy', id: 12, themes: { dark: { background: '#121212', primary: '#EB8FE1', secondary: '#F7638B' }, light: { background: '#f3efef', secondary: '#DB8FEB', primary: '#F7638B' } } },
  { name: 'Carrot', id: 13, themes: { dark: { background: '#121212', primary: '#DC8C2C', secondary: '#439369' }, light: { background: '#f2f2f2', primary: '#DC8C2C', secondary: '#439369' } } },
  { name: 'Circus', id: 14, themes: { dark: { background: '#121212', primary: '#e9d9a3', secondary: '#7f796a' }, light: { background: '#f2f2f2', secondary: '#7f796a', primary: '#D4C378' } } },
  { name: 'Neon Purple', id: 15, themes: { dark: { background: '#121212', primary: '#e0e187', secondary: '#7e6bac' }, light: { background: '#f2f2f2', secondary: '#e0e187', primary: '#7e6bac' } } },
  { name: 'Solar Eclipse', id: 16, themes: { dark: { background: '#121212', primary: '#d79e69', secondary: '#244f6f' }, light: { background: '#f2f2f2', primary: '#d79e69', secondary: '#244f6f' } } },
  { name: 'Silver Steel', id: 17, themes: { dark: { background: '#121212', primary: '#9ba4b1', secondary: '#928c97' }, light: { background: '#f2f2f2', primary: '#9ba4b1', secondary: '#928c97' } } },
  { name: 'Snowflake', id: 18, themes: { dark: { background: '#121212', primary: '#338bcc', secondary: '#72b0e4' }, light: { background: '#f2f2f2', primary: '#338bcc', secondary: '#72b0e4' } } },
  { name: 'Lavender Field', id: 19, themes: { dark: { background: '#121212', primary: '#cda4d5', secondary: '#4a477c' }, light: { background: '#f2f2f2', primary: '#4a477c', secondary: '#cda4d5' } } },
  { name: 'Raindrop', id: 20, themes: { dark: { background: '#151515', primary: '#7fbde2', secondary: '#8ec7e5' }, light: { background: '#edf1f4', primary: '#7fbde2', secondary: '#9fcbee' } } },
  { name: 'Olive Grove', id: 21, themes: { dark: { background: '#343431', primary: '#BCA543', secondary: '#A2C79E' }, light: { background: '#F0F6E1', primary: '#A2C79E', secondary: '#BCA543' } } },
  { name: 'Royal Feather', id: 22, themes: { dark: { background: '#090909', primary: '#1775fb', secondary: '#51c3a3' }, light: { background: '#f9f3f6', primary: '#1c51a3', secondary: '#5fbea3' } } },
  { name: 'Sakura Blossom', id: 23, themes: { dark: { background: '#121212', primary: '#F48FB1', secondary: '#81D4FA' }, light: { background: '#FCE4EC', primary: '#C2185B', secondary: '#0277BD' } } },
  { name: 'Forest Walk', id: 24, themes: { dark: { background: '#121212', primary: '#A5D6A7', secondary: '#FFCC80' }, light: { background: '#E8F5E9', primary: '#2E7D32', secondary: '#EF6C00' } } },
  { name: 'Ocean Depths', id: 25, themes: { dark: { background: '#0A111A', primary: '#80DEEA', secondary: '#80CBC4' }, light: { background: '#E0F7FA', primary: '#00838F', secondary: '#00695C' } } },
  { name: 'Sunset Glow', id: 26, themes: { dark: { background: '#121212', primary: '#FFAB91', secondary: '#CE93D8' }, light: { background: '#FBE9E7', primary: '#D84315', secondary: '#6A1B9A' } } },
  { name: 'Coffee Mocha', id: 27, themes: { dark: { background: '#1A1614', primary: '#BCAAA4', secondary: '#FFE082' }, light: { background: '#EFEBE9', primary: '#4E342E', secondary: '#FF8F00' } } },
  { name: 'Lavender Dream', id: 28, themes: { dark: { background: '#121212', primary: '#B39DDB', secondary: '#9FA8DA' }, light: { background: '#EDE7F6', primary: '#4527A0', secondary: '#283593' } } },
  { name: 'Rose Garden', id: 29, themes: { dark: { background: '#121212', primary: '#EF9A9A', secondary: '#F48FB1' }, light: { background: '#FFEBEE', primary: '#C62828', secondary: '#AD1457' } } },
  { name: 'Golden Hour', id: 30, themes: { dark: { background: '#121212', primary: '#FFE082', secondary: '#FFCC80' }, light: { background: '#FFF8E1', primary: '#FF8F00', secondary: '#EF6C00' } } },
  { name: 'Cyber Neon', id: 31, themes: { dark: { background: '#0A0A0A', primary: '#18FFFF', secondary: '#FF4081' }, light: { background: '#FAFAFA', primary: '#00B8D4', secondary: '#C51162' } } },
  { name: 'Monochrome', id: 32, themes: { dark: { background: '#121212', primary: '#EEEEEE', secondary: '#B0BEC5' }, light: { background: '#F5F5F5', primary: '#424242', secondary: '#37474F' } } },
  { name: 'Mint Fresh', id: 33, themes: { dark: { background: '#121212', primary: '#80CBC4', secondary: '#A5D6A7' }, light: { background: '#E0F2F1', primary: '#00695C', secondary: '#2E7D32' } } },
  { name: 'Grape Vine', id: 34, themes: { dark: { background: '#121212', primary: '#CE93D8', secondary: '#B39DDB' }, light: { background: '#F3E5F5', primary: '#4A148C', secondary: '#311B92' } } },
];

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1]!, 16)}, ${parseInt(result[2]!, 16)}, ${parseInt(result[3]!, 16)}` : '255, 255, 255';
}

function adjustBrightness(hex: string, factor: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0, 0, 0';
  const r = Math.min(255, Math.max(0, Math.round(parseInt(result[1]!, 16) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(parseInt(result[2]!, 16) * factor)));
  const b = Math.min(255, Math.max(0, Math.round(parseInt(result[3]!, 16) * factor)));
  return `${r}, ${g}, ${b}`;
}

function detectAndSyncTheme() {
  try {
    const isDark = document.documentElement.classList.contains('dark') || document.documentElement.getAttribute('data-theme') === 'dark';

    // Get glassmorphism settings from vtubervn_ssr_prefs cookie (since they are stored in cookies for SSR)
    const getCookie = (name: string): string | null => {
      const match = document.cookie.match(new RegExp(`(?:^|; )${encodeURIComponent(name)}=([^;]*)`));
      return match ? decodeURIComponent(match[1]!) : null;
    };

    const ssrPrefsStr = getCookie('vtubervn_ssr_prefs');
    let glassSettings: any = {};
    let themeId = 12; // Default to Candy theme
    let customThemeColors: any = null;

    if (ssrPrefsStr) {
      try {
        const parsed = JSON.parse(ssrPrefsStr);
        const settingsObj = parsed.settings || parsed;
        themeId = settingsObj.themeId ?? 12;
        customThemeColors = settingsObj.customThemeColors || null;
        glassSettings = {
          glassType: settingsObj.glassType || 'none',
          glassOpacity: settingsObj.glassOpacity ?? 45,
          glassBlur: settingsObj.glassBlur ?? 16,
          glassSaturate: settingsObj.glassSaturate ?? 140,
          glassNoise: settingsObj.glassNoise ?? 15,
          glassMicaTint: settingsObj.micaTint ?? 20,
          glassTextShadow: settingsObj.textShadow ?? 0,
          enableBackground: settingsObj.enableBackground ?? false,
          bgSource: settingsObj.bgSource || 'none',
          bgBlur: settingsObj.bgBlur ?? 4,
          bgDim: settingsObj.bgDim ?? 35,
        };
      } catch (err) {}
    }

    // Resolve Theme Colors directly
    let primaryHex = '#EB8FE1';
    let secondaryHex = '#F7638B';
    let backgroundHex = '#121212';
    let themeName = 'candy';

    if (themeId === 99 && customThemeColors) {
      primaryHex = customThemeColors.primary || '#F06292';
      secondaryHex = customThemeColors.secondary || '#3b88d5';
      backgroundHex = isDark ? (customThemeColors.bgDark || '#0D0D12') : '#F0F2F8';
      themeName = 'custom';
    } else {
      const entry = vtuberThemes.find(t => t.id === themeId) || vtuberThemes.find(t => t.id === 12) || vtuberThemes[0];
      themeName = entry.name.toLowerCase().replace(/\s+/g, '');
      const colors = isDark ? entry.themes.dark : entry.themes.light;
      primaryHex = colors.primary;
      secondaryHex = colors.secondary;
      backgroundHex = colors.background;
    }

    const primaryFallback = hexToRgb(primaryHex);
    const secondaryFallback = hexToRgb(secondaryHex);
    const backgroundFallback = hexToRgb(backgroundHex);
    const surfaceFallback = isDark ? "30, 30, 30" : "255, 255, 255";
    const onSurfaceFallback = isDark ? "255, 255, 255" : "0, 0, 0";

    // Read actual variables from DOM if present, otherwise use fallbacks
    const appEl = document.querySelector('.v-application') || document.body || document.documentElement;
    const styles = getComputedStyle(appEl);
    const getVar = (name: string, fallback: string) => {
      const val = styles.getPropertyValue(name).trim();
      return val ? val : fallback;
    };

    const resolvedPrimary = getVar('--v-theme-primary', primaryFallback);
    const resolvedSecondary = getVar('--v-theme-secondary', secondaryFallback);
    const resolvedSurface = getVar('--v-theme-surface', surfaceFallback);
    const resolvedBackground = getVar('--v-theme-background', backgroundFallback);
    const resolvedOnSurface = getVar('--v-theme-on-surface', onSurfaceFallback);

    // Variation calculations/fetches
    const primaryDarken1 = getVar('--v-theme-primary-darken-1', adjustBrightness(primaryHex, 0.65));
    const primaryDarken2 = getVar('--v-theme-primary-darken-2', adjustBrightness(primaryHex, 0.35));
    const secondaryLighten1 = getVar('--v-theme-secondary-lighten-1', adjustBrightness(secondaryHex, 1.25));
    const secondaryDarken1 = getVar('--v-theme-secondary-darken-1', adjustBrightness(secondaryHex, 0.65));

    // Detect background image url from app-bg-layer, body, or application container
    let activeBgUrl = '';
    const bgLayer = document.querySelector('.app-bg-layer') || document.querySelector('.v-application') || document.body;
    if (bgLayer) {
      const bgStyle = getComputedStyle(bgLayer).backgroundImage;
      if (bgStyle && bgStyle !== 'none') {
        const match = bgStyle.match(/url\("?([^"\)]+)"?\)/);
        if (match && match[1]) {
          activeBgUrl = match[1];
        }
      }
    }

    // Construct class name exactly like Nuxt app
    const mode = isDark ? 'Dark' : 'Light';
    let className = isDark ? 'dark' : 'light';
    className += ` v-theme--${themeName}${mode}`;
    if (glassSettings.glassType && glassSettings.glassType !== 'none') {
      className += ` glass-theme glass-type-${glassSettings.glassType}`;
    }

    const theme = {
      className: className,
      primary: resolvedPrimary,
      secondary: resolvedSecondary,
      surface: resolvedSurface,
      background: resolvedBackground,
      onSurface: resolvedOnSurface,
      
      // Theme variations from page
      primaryDarken1: primaryDarken1,
      primaryDarken2: primaryDarken2,
      secondaryLighten1: secondaryLighten1,
      secondaryDarken1: secondaryDarken1,

      // Glassmorphism properties
      glassType: glassSettings.glassType || 'none',
      glassOpacity: glassSettings.glassOpacity ?? 45,
      glassBlur: glassSettings.glassBlur ?? 16,
      glassSaturate: glassSettings.glassSaturate ?? 140,
      glassMicaTint: glassSettings.glassMicaTint ?? 20,
      glassTextShadow: glassSettings.glassTextShadow ?? false,
      enableBackground: glassSettings.enableBackground ?? false,
      bgBlur: glassSettings.bgBlur ?? 4,
      bgDim: glassSettings.bgDim ?? 35,
      bgImage: activeBgUrl ? `url("${activeBgUrl}")` : 'none',
    };

    // console.log("[VtuberVN+] detectAndSyncTheme resolved payload:", theme);
    window.postMessage({ type: 'VTUBERVN_THEME_SYNC', theme: theme }, '*');
  } catch (e) {
    console.error("[VtuberVN+] detectAndSyncTheme error:", e);
  }
}

detectAndSyncTheme();
window.addEventListener('load', detectAndSyncTheme);
[1000, 3000, 5000].forEach(delay => setTimeout(detectAndSyncTheme, delay));

// Listen for cookie changes natively using CookieStore API (instantaneous & zero polling overhead in Chrome)
// @ts-ignore
if (typeof cookieStore !== 'undefined' && cookieStore.addEventListener) {
  // @ts-ignore
  cookieStore.addEventListener('change', (event: any) => {
    const hasPrefChange = event.changed?.some((c: any) => c.name === 'vtubervn_ssr_prefs');
    if (hasPrefChange) {
      detectAndSyncTheme();
    }
  });
} else {
  // Fallback for browsers that don't support CookieStore (like Firefox), using a 2s poll
  setInterval(detectAndSyncTheme, 2000);
}

const observer = new MutationObserver(() => {
  detectAndSyncTheme();
});
observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });

// Listen for storage events (nếu web dùng cross-tab sync)
window.addEventListener('storage', (e) => {
  const { key, newValue } = e;
  if (key === 'vtubervn_locale' && newValue) {
    window.postMessage({ type: 'VTUBERVN_LOCALE_SYNC', locale: newValue }, '*');
  }
  if (e.key === 'vtubervn_user') {
    detectAndSyncUser();
  }
  if (e.key === 'vtubervn_settings') {
    detectAndSyncTheme();
  }
});

// Fix: Nếu login trên cùng tab bằng API (không gây ra event 'storage' trên window hiện tại)
// Override localStorage.setItem để dispatch event nội bộ
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
  originalSetItem.apply(this, [key, value]);
  if (key === 'vtubervn_user') detectAndSyncUser();
  if (key === 'vtubervn_settings') detectAndSyncTheme();
};
const originalRemoveItem = localStorage.removeItem;
localStorage.removeItem = function(key) {
  originalRemoveItem.apply(this, [key]);
  if (key === 'vtubervn_user') detectAndSyncUser();
  if (key === 'vtubervn_settings') detectAndSyncTheme();
};

export {};
