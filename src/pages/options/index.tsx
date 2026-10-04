import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { entries, Options, translations, Locale, Schema } from "@utils";
import { storage } from "webextension-polyfill";
import { mdiCog, mdiHelpCircleOutline } from "@mdi/js";
import logoUrl from "../../icons/32.png";
import "./index.css";

const Icon = ({ path, className, style }: { path: string; className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" className={className} style={{ width: '1.1em', height: '1.1em', fill: 'currentColor', verticalAlign: 'text-bottom', marginRight: '6px', ...style }}>
    <path d={path} />
  </svg>
);

type OptionsState = { [K in keyof Schema]?: Schema[K] };

const Popup = () => {
  const [locale, setLocale] = useState<Locale>("vi");
  const [options, setOptions] = useState<OptionsState>({});
  const [expandedDesc, setExpandedDesc] = useState<Record<string, boolean>>({});
  const [theme, setTheme] = useState<{ isDark: boolean; primaryRgb: string }>({
    isDark: true,
    primaryRgb: "235, 143, 225",
  });

  useEffect(() => {
    // Load saved locale & theme
    storage.local.get(["vtubervn_locale", "vtubervn_theme"]).then((res) => {
      if (res.vtubervn_locale) {
        setLocale(res.vtubervn_locale === "en" ? "en" : "vi");
      }
      if (res.vtubervn_theme) {
        setTheme({
          isDark: res.vtubervn_theme.isDark ?? true,
          primaryRgb: res.vtubervn_theme.primaryRgb || "235, 143, 225",
        });
      }
    }).catch(() => {});

    // Listen for storage changes in real-time
    const handleStorageChange = (changes: Record<string, { newValue?: unknown }>, areaName: string) => {
      if (areaName === "local") {
        if (changes.vtubervn_locale?.newValue) {
          setLocale(changes.vtubervn_locale.newValue === "en" ? "en" : "vi");
        }
        if (changes.vtubervn_theme?.newValue) {
          const newTheme = changes.vtubervn_theme.newValue as { isDark?: boolean; primaryRgb?: string };
          setTheme({
            isDark: newTheme.isDark ?? true,
            primaryRgb: newTheme.primaryRgb || "235, 143, 225",
          });
        }
      }
    };
    storage.onChanged.addListener(handleStorageChange);

    // Load initial options
    const loadOptions = async () => {
      let currentOpts: OptionsState = {};
      for (const [key, defaultVal] of entries(Options.schema())) {
        const val = await Options.get(key);
        currentOpts = { ...currentOpts, [key]: val ?? defaultVal };
      }
      setOptions(currentOpts);
    };
    loadOptions();

    return () => {
      storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const handleOptionChange = async <K extends keyof Schema>(key: K, value: Schema[K]) => {
    await Options.set(key, value);
    setOptions(prev => ({ ...prev, [key]: value }));
  };

  const primaryColor = `rgb(${theme.primaryRgb})`;

  const version = (typeof chrome !== 'undefined' && chrome.runtime?.getManifest?.()?.version) || "2.0.2";

  return (
    <div
      className={`popup-container ${theme.isDark ? "dark" : "light"}`}
      style={{
        userSelect: 'none',
        '--theme-primary': primaryColor,
        '--v-theme-primary': theme.primaryRgb,
      } as React.CSSProperties}
    >
      <div className="header-card">
        <h1 className="options-title" style={{ display: 'flex', alignItems: 'center' }}>
          <img src={logoUrl} alt="Logo" style={{ width: '24px', height: '24px', marginRight: '8px', verticalAlign: 'middle', borderRadius: '4px' }} />
          <span>VtuberVN+</span>
          <span style={{
            marginLeft: '8px',
            fontSize: '11px',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '4px',
            background: 'rgba(var(--v-theme-primary), 0.15)',
            color: 'var(--theme-primary, #EB8FE1)',
            border: '1px solid rgba(var(--v-theme-primary), 0.35)',
            letterSpacing: '0.5px',
          }}>
            v{version}
          </span>
        </h1>
        <div className="locale-selector" style={{ fontSize: '12px', color: '#aaa', display: 'flex', gap: '8px' }}>
          <span
            style={{ cursor: 'pointer', fontWeight: locale === 'vi' ? 'bold' : 'normal', color: locale === 'vi' ? 'var(--theme-primary, #EB8FE1)' : '#888' }}
            onClick={() => { setLocale('vi'); storage.local.set({ vtubervn_locale: 'vi' }).catch(() => {}); }}
          >
            VI
          </span>
          <span>|</span>
          <span
            style={{ cursor: 'pointer', fontWeight: locale === 'en' ? 'bold' : 'normal', color: locale === 'en' ? 'var(--theme-primary, #EB8FE1)' : '#888' }}
            onClick={() => { setLocale('en'); storage.local.set({ vtubervn_locale: 'en' }).catch(() => {}); }}
          >
            EN
          </span>
        </div>
      </div>
      
      <div className="body-card">
        <div className="section">
          <h2 className="section-title"><Icon path={mdiCog} /> {translations[locale]?.popup?.settings || "Cài đặt"}</h2>
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
      <div style={{
        margin: '10px 0 0',
        padding: '8px 12px',
        fontSize: '11px',
        color: '#888',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <span>VtuberVN+ • Full Edition</span>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<Popup />);
