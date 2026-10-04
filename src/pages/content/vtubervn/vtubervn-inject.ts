// @ts-ignore
window.ARCHIVE_CHAT_OVERRIDE = true;
// @ts-ignore
window.HOLODEX_PLUS_INSTALLED = true;
// @ts-ignore
window.VtuberVN_PLUS_INSTALLED_V3 = true;
// @ts-ignore — Audio Visualizer: notify main web app that extension supports audio data capture
window.VtuberVN_AUDIO_VISUALIZER_SUPPORTED = true;
// @ts-ignore — Mark Extension V2 (Full Edition)
window.__vtubervn_ext_v2 = true;

if (!import.meta.env.DEV) {
  const _log = console.log;
  console.log = (...args: any[]) => {
    if (args.length > 0 && typeof args[0] === 'string' && args[0].includes('[VtuberVN')) {
      return;
    }
    _log(...args);
  };
}

if (import.meta.env.DEV) {
  console.log("[VtuberVN+ V2] Activated");
}

// ─── Audio Visualizer Bridge ──────────────────────────────────────
// Relay audio data from YouTube embed iframes to main page context.
window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data?.type) return;

  // Forward audio data, ACK, and heartbeat from iframe to main page via CustomEvent
  if (data.type === 'VTUBERVN_AUDIO_DATA' || data.type === 'VTUBERVN_AUDIO_CAPTURE_ACK' || data.type === 'VTUBERVN_AUDIO_CAPTURE_HEARTBEAT') {
    window.dispatchEvent(new CustomEvent('vtubervn-audio-data', {
      detail: data,
    }));
  }
});

// ─── Locale Sync (popup i18n) ─────────────────────────────────────
function detectAndSyncLocale() {
  const htmlLang = document.documentElement.lang;
  const storedLocale = localStorage.getItem('i18n_redirected');
  const locale = htmlLang || storedLocale || navigator.language.split('-')[0] || 'vi';
  const normalized = locale.startsWith('vi') ? 'vi' : 'en';
  window.postMessage({ type: 'VTUBERVN_LOCALE_SYNC', locale: normalized }, '*');
}

detectAndSyncLocale();

const localeObserver = new MutationObserver(() => {
  detectAndSyncLocale();
});
localeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

// Theme Sync
function detectAndSyncTheme() {
  try {
    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    const appEl = document.querySelector('.v-application') || htmlEl;

    const isDark =
      htmlEl.classList.contains('dark') ||
      bodyEl?.classList.contains('dark') ||
      htmlEl.getAttribute('data-theme') === 'dark' ||
      appEl.classList.contains('v-theme--dark') ||
      (!htmlEl.classList.contains('light') && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const styles = getComputedStyle(appEl);
    let primaryRgb = styles.getPropertyValue('--v-theme-primary').trim();
    if (!primaryRgb) {
      primaryRgb = isDark ? '235, 143, 225' : '156, 39, 176';
    }

    window.postMessage({
      type: 'VTUBERVN_THEME_SYNC',
      theme: {
        isDark,
        primaryRgb,
      }
    }, '*');
  } catch {
    // silent fail
  }
}

detectAndSyncTheme();

const themeObserver = new MutationObserver(() => {
  detectAndSyncTheme();
});
themeObserver.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['class', 'data-theme', 'style'],
});

window.addEventListener('storage', (e) => {
  if (e.key === 'vtubervn_locale' && e.newValue) {
    window.postMessage({ type: 'VTUBERVN_LOCALE_SYNC', locale: e.newValue }, '*');
  }
  if (e.key && (e.key.includes('theme') || e.key.includes('settings') || e.key.includes('color-mode'))) {
    detectAndSyncTheme();
  }
});

export {};
