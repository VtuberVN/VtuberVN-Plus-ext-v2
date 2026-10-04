// Script running in YouTube embed iframe MAIN execution world
// Directly accesses window.ytcfg and window.ytInitialPlayerResponse
// Free from CSP restrictions (content script bypasses CSP)
// Note: chrome.* APIs are not available in MAIN world

(function () {
  interface YtcfgLike {
    get?: (key: string) => string | undefined;
    d?: () => Record<string, string | undefined>;
  }

  interface PlayerResponse {
    videoDetails?: {
      viewCount?: string;
      isLiveContent?: boolean;
      videoId?: string;
    };
  }

  function extract() {
    const ytcfg = (window as Window & { ytcfg?: YtcfgLike }).ytcfg;

    const get = (key: string): string | undefined => {
      if (!ytcfg) return undefined;
      if (typeof ytcfg.get === "function") return ytcfg.get(key);
      if (typeof ytcfg.d === "function") return ytcfg.d()[key];
      return undefined;
    };

    const apiKey = get("INNERTUBE_API_KEY");
    const clientName = get("INNERTUBE_CLIENT_NAME");
    const clientVersion = get("INNERTUBE_CLIENT_VERSION");

    let pr = (window as Window & { ytInitialPlayerResponse?: PlayerResponse }).ytInitialPlayerResponse;

    // Fallback: extract from PLAYER_VARS.embedded_player_response
    if (!pr && apiKey) {
      const rawPlayerVars = get("PLAYER_VARS");
      if (rawPlayerVars) {
        try {
          const pv = JSON.parse(rawPlayerVars) as { embedded_player_response?: string };
          if (pv.embedded_player_response) {
            pr = JSON.parse(pv.embedded_player_response) as PlayerResponse;
          }
        } catch {
          // ignore
        }
      }
    }

    return {
      viewCount: pr?.videoDetails?.viewCount,
      isLiveContent: !!pr?.videoDetails?.isLiveContent,
      videoId: pr?.videoDetails?.videoId,
      apiKey,
      clientName: clientName ?? "WEB_EMBEDDED_PLAYER",
      clientVersion,
    };
  }

  function send() {
    window.postMessage({ type: "VTUBERVN_YTDATA_FROM_MAIN", data: extract() }, window.location.origin);
  }

  // Listen for request from isolated world content script
  window.addEventListener("message", (event: MessageEvent<{ type?: string }>) => {
    if (event.origin !== window.location.origin && event.origin !== "https://www.youtube.com") return;
    if (event.data?.type === "VTUBERVN_REQUEST_YTDATA") {
      send();
    }
  });
})();

export {};
