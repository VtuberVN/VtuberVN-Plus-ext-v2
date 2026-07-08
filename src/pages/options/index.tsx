import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { entries, Options, translations, Locale, Schema } from "@utils";
import { storage } from "webextension-polyfill";
import { mdiTelevision, mdiRecordCircle, mdiCog, mdiEye, mdiHelpCircleOutline } from "@mdi/js";
import logoUrl from "../../icons/32.png";
import "./index.css";

const Icon = ({ path, className, style }: { path: string; className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" className={className} style={{ width: '1.1em', height: '1.1em', fill: 'currentColor', verticalAlign: 'text-bottom', marginRight: '6px', ...style }}>
    <path d={path} />
  </svg>
);

type OptionsState = { [K in keyof Schema]?: Schema[K] };

type UserInfo = { username: string; avatar: string; frame?: string } | null;
type LiveChannel = { name: string; viewers: string };

const getAvatarUrl = (u: any) => {
  let url = typeof u.avatarUrl === 'string' ? u.avatarUrl
    : (u.avatarUrl?.url || u.avatarUrl?.medium || u.avatarUrl?.thumbnail
    || u.avatar_url?.url || u.avatar_url?.medium || u.avatar_url?.thumbnail
    || u.avatar || "");
  if (typeof url === 'object' && url !== null) {
    url = (url as any).url || (url as any).medium || (url as any).thumbnail || "";
  }
  if (!url) return "https://ui-avatars.com/api/?name=" + encodeURIComponent(u.displayName || u.username || 'User');
  if (url.startsWith('/uploads/')) return "https://vtuberhub.vn" + url;
  if (url.startsWith('/api/v2/uploads/')) return "https://vtuberhub.vn" + url.replace('/api/v2', '');
  return url;
};

const getFrameUrl = (u: any) => {
  let url = u.avatarFrameUrl || u.avatar_frame_url;
  if (typeof url === 'object' && url !== null) {
    url = url.url || url.medium || url.thumbnail || "";
  }
  if (!url) return "";
  if (url.startsWith('/uploads/')) return "https://vtuberhub.vn" + url;
  if (url.startsWith('/api/v2/uploads/')) return "https://vtuberhub.vn" + url.replace('/api/v2', '');
  return url;
};

const adjustBrightnessHex = (rgbStr: string, factor: number): string => {
  const parts = rgbStr.split(',').map(x => parseInt(x.trim()));
  if (parts.length !== 3 || parts.some(isNaN)) return rgbStr;
  const r = Math.min(255, Math.max(0, Math.round(parts[0]! * factor)));
  const g = Math.min(255, Math.max(0, Math.round(parts[1]! * factor)));
  const b = Math.min(255, Math.max(0, Math.round(parts[2]! * factor)));
  return `${r}, ${g}, ${b}`;
};

const applyTheme = (t: any) => {
  const root = document.documentElement;
  if (t.primary) root.style.setProperty('--v-theme-primary', t.primary);
  if (t.secondary) root.style.setProperty('--v-theme-secondary', t.secondary);
  if (t.surface) root.style.setProperty('--v-theme-surface', t.surface);
  if (t.background) root.style.setProperty('--v-theme-background', t.background);
  if (t.onSurface) root.style.setProperty('--v-theme-on-surface', t.onSurface);
  
  const opacity = t.glassOpacity !== undefined ? t.glassOpacity / 100 : 0.45;
  root.style.setProperty('--glass-opacity', opacity.toString());
  root.style.setProperty('--glass-blur', t.glassBlur !== undefined ? `${t.glassBlur}px` : '16px');
  root.style.setProperty('--glass-saturate', t.glassSaturate !== undefined ? `${t.glassSaturate}%` : '140%');
  
  const micaTint = t.glassMicaTint !== undefined ? t.glassMicaTint / 100 : 0.2;
  root.style.setProperty('--glass-mica-tint', micaTint.toString());

  const noise = t.glassNoise !== undefined ? t.glassNoise / 100 : 0.15;
  root.style.setProperty('--glass-noise-opacity', noise.toString());

  const ts = t.glassTextShadow ?? 0;
  const shadowAlpha = ((ts / 10) * 0.85).toFixed(2);
  const shadowSpread = Math.round(ts * 0.8);
  const shadowValue = ts > 0 
    ? `0 1px ${shadowSpread}px rgba(0,0,0,${shadowAlpha}), 0 0 ${shadowSpread * 2}px rgba(0,0,0,${(+shadowAlpha * 0.5).toFixed(2)})` 
    : 'none';
  root.style.setProperty('--glass-text-shadow', shadowValue);

  const isDark = !(t.className?.includes('light') ?? false);

  // Surface Base (using darken-2 for dark theme, white for light theme)
  const primaryDarken2 = t.primaryDarken2 || adjustBrightnessHex(t.primary || '235, 143, 225', 0.35);
  const surfaceBase = isDark ? primaryDarken2 : '255, 255, 255';
  root.style.setProperty('--glass-surface-base', surfaceBase);

  // Watched title color
  const secondaryLighten1 = t.secondaryLighten1 || adjustBrightnessHex(t.secondary || '247, 99, 139', 1.25);
  const secondaryDarken1 = t.secondaryDarken1 || adjustBrightnessHex(t.secondary || '247, 99, 139', 0.65);
  const watchedColor = isDark ? secondaryLighten1 : secondaryDarken1;
  root.style.setProperty('--watched-title-color', watchedColor.includes(',') ? `rgb(${watchedColor})` : watchedColor);

  // Channel name color
  const primaryDarken1 = t.primaryDarken1 || adjustBrightnessHex(t.primary || '235, 143, 225', 0.65);
  const channelColor = isDark ? (t.primary || '235, 143, 225') : primaryDarken1;
  root.style.setProperty('--channel-name-color', channelColor.includes(',') ? `rgb(${channelColor})` : channelColor);
};

const Popup = () => {
  const [locale, setLocale] = useState<Locale>("vi");
  const [options, setOptions] = useState<OptionsState>({});
  const [currentVideo, setCurrentVideo] = useState<{title: string, thumbnail: string, id: string} | null>(null);
  const [user, setUser] = useState<UserInfo>(null);
  const [theme, setTheme] = useState<any>(null);
  const [liveChannels, setLiveChannels] = useState<LiveChannel[]>([]);
  const [loadingLive, setLoadingLive] = useState(true);
  const [expandedDesc, setExpandedDesc] = useState<Record<string, boolean>>({});

  useEffect(() => {
    storage.local.get(["vtubervn_locale", "vtubervn_theme"]).then((res) => {
      setLocale(res.vtubervn_locale === "en" ? "en" : "vi");
      console.log("[VtuberVN+] Popup retrieved vtubervn_theme:", res.vtubervn_theme);
      if (res.vtubervn_theme) {
        setTheme(res.vtubervn_theme);
        applyTheme(res.vtubervn_theme);
      } else {
        console.log("[VtuberVN+] No theme found in storage, using candyTheme default.");
        const candyTheme = {
          className: 'dark v-theme--candy12dark',
          primary: '235, 143, 225',
          secondary: '247, 99, 139',
          surface: '30, 30, 30',
          background: '18, 18, 18',
          onSurface: '255, 255, 255',
          glassType: 'none',
          glassOpacity: 45,
          glassBlur: 16,
          glassSaturate: 140,
          enableBackground: false,
          bgImage: 'none'
        };
        setTheme(candyTheme);
        applyTheme(candyTheme);
      }
    });

    const checkAuth = () => {
      if (typeof chrome !== "undefined" && chrome.cookies) {
        chrome.cookies.get({ url: 'https://vtuberhub.vn', name: 'vtubervn_token' }, (cookie) => {
          if (cookie && cookie.value) {
            fetch('https://vtuberhub.vn/api/auth/me', {
              headers: { 'Authorization': `Bearer ${cookie.value}` }
            })
            .then(res => res.json())
            .then(u => {
              if (u && (u.username || u.displayName || u.id)) {
                setUser({
                  username: u.displayName || u.username || 'User',
                  avatar: getAvatarUrl(u),
                  frame: getFrameUrl(u)
                });
              } else {
                setUser(null);
              }
            }).catch(() => setUser(null));
          } else {
            setUser(null);
          }
        });
      }
    };
    checkAuth();
    
    // Check if current tab is a YouTube video
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        const tab = tabs[0];
        if (tab && tab.url && tab.url.includes("youtube.com/watch")) {
          const urlObj = new URL(tab.url);
          const videoId = urlObj.searchParams.get("v");
          if (videoId) {
            setCurrentVideo({
              title: tab.title?.replace(" - YouTube", "") || "YouTube Video",
              thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
              id: videoId
            });
          }
        }
      });
    }

    // Load initial options
    const loadOptions = async () => {
      let currentOpts: OptionsState = {};
      for (const [key, defaultVal] of entries(Options.schema())) {
        const val = await Options.get(key);
        currentOpts = { ...currentOpts, [key]: val ?? defaultVal };
      }
      setOptions(currentOpts);
      
      // Since live channels are not fetched yet, stop loading state
      setLoadingLive(false);
    };
    loadOptions();

    // Listen for realtime storage changes (khi user login/logout trên web tab khác)
    const storageListener = (changes: Record<string, any>) => {
      if (changes.vtubervn_user) {
        const raw = changes.vtubervn_user.newValue;
        if (raw) {
          const u = raw.currentUser || raw;
          if (u && (u.username || u.displayName)) {
            setUser({
              username: u.displayName || u.username,
              avatar: getAvatarUrl(u),
              frame: getFrameUrl(u)
            });
          }
        } else {
          setUser(null);
        }
      }
      if (changes.vtubervn_theme) {
        const t = changes.vtubervn_theme.newValue;
        console.log("[VtuberVN+] Popup storageListener received theme change:", t);
        if (t) {
          setTheme(t);
          applyTheme(t);
        } else {
          const candyTheme = {
            className: 'dark v-theme--candy12dark',
            primary: '235, 143, 225',
            secondary: '247, 99, 139',
            surface: '30, 30, 30',
            background: '18, 18, 18',
            onSurface: '255, 255, 255',
            glassType: 'none',
            glassOpacity: 45,
            glassBlur: 16,
            glassSaturate: 140,
            enableBackground: false,
            bgImage: 'none'
          };
          setTheme(candyTheme);
          applyTheme(candyTheme);
        }
      }
    };
    storage.onChanged.addListener(storageListener);
    return () => storage.onChanged.removeListener(storageListener);
  }, []);

  const handleOptionChange = async <K extends keyof Schema>(key: K, value: Schema[K]) => {
    await Options.set(key, value);
    setOptions(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className={`popup-container ${theme?.className || 'v-theme--candy12dark'}`} style={{ 
      userSelect: 'none', 
      background: theme?.bgImage && theme.bgImage !== 'none' ? 'transparent' : (theme?.background ? `rgb(${theme.background})` : '#121212')
    }}>
      {theme?.bgImage && theme.bgImage !== 'none' && (
        <div className="app-bg-layer" style={{
          backgroundImage: `linear-gradient(rgba(${theme.className?.includes('light') ? '255, 255, 255' : '0, 0, 0'}, ${(theme.bgDim ?? 40) / 100}), rgba(${theme.className?.includes('light') ? '255, 255, 255' : '0, 0, 0'}, ${(theme.bgDim ?? 40) / 100})), ${theme.bgImage}`,
          filter: `blur(${theme.bgBlur ?? 4}px)`,
          transform: 'scale(1.02)',
        }} />
      )}
      <div className="header-card">
        <h1 className="options-title">
          <img src={logoUrl} alt="Logo" style={{ width: '24px', height: '24px', marginRight: '8px', verticalAlign: 'middle', borderRadius: '4px' }} />
          VtuberVN+
        </h1>
        <div className="user-info">
          {user ? (
            <>
              <div style={{position: 'relative', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <img src={user.avatar} alt="Avatar" className="user-avatar" style={{width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover'}} />
                {user.frame && <img src={user.frame} alt="" style={{position: 'absolute', top: '-5px', left: '-5px', width: 'calc(100% + 10px)', height: 'calc(100% + 10px)', pointerEvents: 'none', zIndex: 2, borderRadius: '50%'}} />}
              </div>
              <span className="user-name">Hi, {user.username}</span>
            </>
          ) : (
            <span className="user-name" style={{ paddingLeft: '8px' }}>Chưa đăng nhập</span>
          )}
        </div>
      </div>
      
      <div className="body-card">
        {currentVideo && (
          <div className="section">
            <h2 className="section-title"><Icon path={mdiTelevision} /> {translations[locale].popup.nowPlaying}</h2>
            <div className="now-playing">
              <img src={currentVideo.thumbnail} alt="Thumb" className="video-thumb" />
              <div className="video-info">
                <p className="video-title">{currentVideo.title}</p>
                <div className="video-actions">
                  <button aria-label={translations[locale].popup.openOnVtuberVN} className="btn btn-primary" onClick={() => window.open(`https://vtuberhub.vn/watch/${currentVideo.id}`)}>{translations[locale].popup.openOnVtuberVN}</button>
                  <button aria-label="MV" className="btn btn-secondary">MV</button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="section">
          <h2 className="section-title"><Icon path={mdiRecordCircle} style={{ color: 'var(--theme-primary)' }}/> {translations[locale].popup.liveNow} {!loadingLive && liveChannels.length > 0 && `${liveChannels.length} ${translations[locale].popup.channels}`}</h2>
          <div className="live-list">
            {loadingLive ? (
              <div className="live-item" style={{ justifyContent: 'center' }}>
                <span className="option-description">Loading...</span>
              </div>
            ) : liveChannels.length > 0 ? (
              liveChannels.map((ch) => (
                <div key={ch.name} className="live-item">
                  <span className="live-name">{ch.name}</span>
                  <span className="live-viewers"><Icon path={mdiEye} style={{ marginRight: '4px' }}/>{ch.viewers}</span>
                </div>
              ))
            ) : (
              <div className="live-item" style={{ justifyContent: 'center' }}>
                <span className="option-description">Không có kênh nào đang Live</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="section">
          <h2 className="section-title"><Icon path={mdiCog} /> {translations[locale].popup.settings}</h2>
          <div className="options-list">
            {entries(Options.schema()).map(([key, defaultVal]) => (
              <div key={key} className="option-item">
                <div className="option-name-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                    <span className="option-name">{Options.name(key, locale) || key}</span>
                    {Options.description(key, locale) && (
                      <span 
                        className="option-tooltip" 
                        onClick={() => setExpandedDesc(prev => ({ ...prev, [key]: !prev[key] }))}
                        style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <Icon path={mdiHelpCircleOutline} style={{ marginRight: 0 }} />
                      </span>
                    )}
                  </div>
                  {expandedDesc[key] && Options.description(key, locale) && (
                    <div className="option-description">
                      {Options.description(key, locale)}
                    </div>
                  )}
                </div>
                <div className="option-control">
                  {typeof defaultVal === "number" ? (
                    <>
                      <input 
                        type="range" 
                        min="10" max="60" step="1" 
                        className="option-slider" 
                        value={options[key] as number ?? defaultVal as number}
                        onChange={(e) => handleOptionChange(key, parseInt(e.target.value) as Schema[typeof key])}
                      />
                      <span className="option-slider-value">{options[key] as number ?? defaultVal as number}</span>
                    </>
                  ) : (
                    <label className="option-toggle" aria-label={Options.name(key, locale) || key}>
                      <input 
                        type="checkbox" 
                        className="option-toggle__input"
                        checked={options[key] as boolean ?? defaultVal as boolean}
                        onChange={(e) => handleOptionChange(key, e.target.checked as Schema[typeof key])}
                      />
                      <span className="option-toggle__track"><span className="option-toggle__thumb"></span></span>
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<Popup />);
