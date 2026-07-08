import type { ManifestV3Export } from "@crxjs/vite-plugin";

const manifest = {
  manifest_version: 3,
  version: "<get from package.json>",
  name: "VtuberVN+",
  description: "VtuberVN companion extension",
  options_ui: {
    page: "src/pages/options/index.html",
    open_in_tab: false,
  },
  background: {
    service_worker: "src/pages/background/index.ts",
    type: "module",
  },
  action: {
    default_popup: "src/pages/options/index.html",
    default_icon: {
      "16": "src/icons/16.png",
      "32": "src/icons/32.png",
      "48": "src/icons/48.png",
      "64": "src/icons/64.png",
      "128": "src/icons/128.png",
    },
  },
  icons: {
    "128": "src/icons/128.png",
    "16": "src/icons/16.png",
  },
  permissions: [
    "tabs",
    "storage",
    "contextMenus"
  ],
  host_permissions: [
    "*://*.youtube.com/*",
    "*://*.vtuberhub.vn/*",
    "*://vtuberhub.vn/*"
  ],
  content_scripts: [
    {
      matches: [
        "*://*.vtuberhub.vn/*",
        "*://vtuberhub.vn/*"
      ],
      js: ["src/pages/content/vtubervn/contentScript.ts"],
      all_frames: true,
      run_at: "document_start",
    },
    {
      matches: ["*://*.youtube.com/live_chat*"],
      js: ["src/pages/content/yt-chat/contentScript.ts"],
      all_frames: true,
      run_at: "document_start",
    },
    {
      matches: ["*://*.youtube.com/*"],
      js: ["src/pages/content/yt-watch/contentScript.ts"],
      all_frames: true,
      run_at: "document_start",
    },
    {
      matches: ["*://*.youtube.com/embed/*"],
      js: ["src/pages/content/yt-player/ytPlayerMain.ts"],
      all_frames: true,
      run_at: "document_start",
      world: "MAIN",
    },
    {
      matches: ["*://*.youtube.com/embed/*"],
      js: ["src/pages/content/yt-player/contentScript.ts"],
      all_frames: true,
      run_at: "document_start",
    },
  ],
  // "devtools_page": "src/pages/devtools/index.html",
  // "chrome_url_overrides": {
  //   "newtab": "src/pages/newtab/index.html"
  // },
  browser_specific_settings: {
    gecko: {
      id: "{7ff078b3-b3e9-44df-a646-45c702b2e17c}",
      data_collection_permissions: {
        required: ["none"],
      },
    },
  },
  web_accessible_resources: [
    {
      resources: ["assets/*", "src/*"],
      matches: [
        "*://*.youtube.com/*",
        "*://*.vtuberhub.vn/*",
        "*://vtuberhub.vn/*"
      ]
    }
  ]
} as const satisfies ManifestV3Export;

export default manifest;
