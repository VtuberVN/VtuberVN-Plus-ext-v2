import { Options, validOrigin } from "@utils";
import { videoId } from "./context";

// ─── Timers ────────────────────────────────────────────────────────────────
let crowdsourcingTimeout: ReturnType<typeof setTimeout> | null = null;
let crowdsourcingInterval: ReturnType<typeof setInterval> | null = null;
let nextRefreshInterval: ReturnType<typeof setInterval> | null = null;

// ─── State ─────────────────────────────────────────────────────────────────
let hasSentVodData = false;
let isLivePolling = false;
let liveEndedConfirms = 0; // Consecutive /next calls reporting isLive=false

interface YtExtractorData {
  apiKey?: string;
  clientVersion?: string;
}

/** Video context received from host web application (YoutubePlayer.vue) */
interface VideoContext {
  status?: string; // 'live' | 'upcoming' | 'past_live' | 'none'
  type?: string;   // 'stream' | 'video' | 'clip' | 'shorts'
}
let videoContext: VideoContext = {};

// ─── ytcfg ─────────────────────────────────────────────────────────────────
function requestYtCfgFromMain(): Promise<YtExtractorData> {
  return new Promise((resolve) => {
    const handler = (event: MessageEvent<{ type?: string; data?: YtExtractorData }>) => {
      if (event.origin !== window.location.origin && event.origin !== "https://www.youtube.com") return;
      if (event.data?.type === "VTUBERVN_YTDATA_FROM_MAIN") {
        window.removeEventListener("message", handler as EventListener);
        resolve(event.data.data ?? {});
      }
    };
    window.addEventListener("message", handler as EventListener);
    window.postMessage({ type: "VTUBERVN_REQUEST_YTDATA" }, window.location.origin);
    setTimeout(() => {
      window.removeEventListener("message", handler as EventListener);
      resolve({});
    }, 2000);
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Parse like count from accessibilityText across English & Vietnamese locales.
 * Supports patterns: "8,8 N lượt thích", "8.8K likes", "1,2 Tr lượt thích", "like this video along with 5,851 other people"
 */
function parseLikeCount(jsonStr: string): number {
  const regex = /"accessibilityText"\s*:\s*"([^"]*?(?:lượt thích|thích|like)[^"]*?)"/gi;
  for (const match of jsonStr.matchAll(regex)) {
    const text = match[1] ?? "";
    const trMatch = text.match(/([\d,.]+)\s*(?:Tr|tr|M)\b/);
    if (trMatch) return Math.round(parseFloat((trMatch[1] ?? "0").replace(",", ".")) * 1_000_000);
    const nMatch = text.match(/([\d,.]+)\s*(?:N|K)\b/i);
    if (nMatch) return Math.round(parseFloat((nMatch[1] ?? "0").replace(",", ".")) * 1000);
    
    const numMatch = text.match(/([\d,.]+)/);
    if (numMatch) {
      const plain = parseInt(numMatch[1].replace(/[^\d]/g, ""), 10);
      if (plain > 0) return plain;
    }
  }
  return 0;
}

interface NextData {
  isLive: boolean;
  ccv: number;
  viewCount: number;
  likeCount: number;
}

/**
 * Parse /next response from JSON string without full 500KB-1.2MB JSON deserialization.
 * Extracts data directly from videoViewCountRenderer section.
 */
function parseNextResponse(jsonStr: string): NextData {
  const match = jsonStr.match(/"videoViewCountRenderer"\s*:\s*\{/);
  const vcSection = match && match.index !== undefined ? jsonStr.slice(match.index, match.index + 800) : "";

  const isLive = /"isLive"\s*:\s*true/.test(vcSection);
  let ccv = 0;
  let viewCount = 0;

  if (isLive) {
    // CCV pattern: "runs":[{"text":"4,273"},{"text":" watching"}]
    const ccvMatch = /"text"\s*:\s*"([\d,. ]+)"/.exec(vcSection);
    ccv = ccvMatch ? parseInt((ccvMatch[1] ?? "").replace(/[^\d]/g, ""), 10) || 0 : 0;
  } else {
    // VOD view count: simpleText or runs[0].text
    const simpleMatch = /"simpleText"\s*:\s*"([\d,. ]+)[^"]*"/i.exec(vcSection);
    if (simpleMatch) {
      viewCount = parseInt((simpleMatch[1] ?? "").replace(/[^\d]/g, ""), 10) || 0;
    } else {
      const runsMatch = /"text"\s*:\s*"([\d,. ]+)"/.exec(vcSection);
      viewCount = runsMatch ? parseInt((runsMatch[1] ?? "").replace(/[^\d]/g, ""), 10) || 0 : 0;
    }
  }

  const likeCount = parseLikeCount(jsonStr);

  return { isLive, ccv, viewCount, likeCount };
}

/**
 * Query InnerTube /next endpoint — comprehensive initial payload.
 * Returns: isLive, CCV (livestream), viewCount (VOD), likeCount
 */
async function fetchNext(apiKey: string, clientVersion: string): Promise<NextData | null> {
  try {
    const res = await fetch(`https://www.youtube.com/youtubei/v1/next?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: { client: { clientName: "WEB", clientVersion } },
        videoId,
      }),
    });
    const jsonStr = await res.text();
    const data = parseNextResponse(jsonStr);
    console.log(
      `[VtuberVN+] /next -> isLive=${data.isLive}, ccv=${data.ccv}, viewCount=${data.viewCount}, like=${data.likeCount}`
    );
    return data;
  } catch (e) {
    console.error("[VtuberVN+] fetchNext error:", e);
    return null;
  }
}

/**
 * Query /updated_metadata — lightweight (~5KB) CCV polling during active livestreams.
 */
async function fetchLiveCcv(apiKey: string, clientVersion: string): Promise<number> {
  try {
    const res = await fetch(`https://www.youtube.com/youtubei/v1/updated_metadata?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: { client: { clientName: "WEB", clientVersion } },
        videoId,
      }),
    });
    const json = await res.json() as Record<string, unknown>;
    const actions = (json?.actions ?? []) as Array<Record<string, unknown>>;
    for (const action of actions) {
      const renderer = (action?.updateViewershipAction as Record<string, unknown> | undefined)
        ?.viewCount as Record<string, unknown> | undefined;
      const vcr = renderer?.videoViewCountRenderer as Record<string, unknown> | undefined;
      if (vcr) {
        const runs = ((vcr.viewCount as Record<string, unknown>)?.runs ?? []) as Array<{ text?: string }>;
        const rawText = runs[0]?.text ?? "0";
        const ccv = parseInt(rawText.replace(/[^\d]/g, ""), 10) || 0;
        console.log(`[VtuberVN+] /updated_metadata -> ccv=${ccv} (raw="${rawText}")`);
        return ccv;
      }
    }
    return 0;
  } catch (e) {
    console.error("[VtuberVN+] fetchLiveCcv error:", e);
    return 0;
  }
}

// ─── Control ───────────────────────────────────────────────────────────────

function stopLivePolling(): void {
  if (crowdsourcingInterval) { clearInterval(crowdsourcingInterval); crowdsourcingInterval = null; }
  if (nextRefreshInterval) { clearInterval(nextRefreshInterval); nextRefreshInterval = null; }
  if (crowdsourcingTimeout) { clearTimeout(crowdsourcingTimeout); crowdsourcingTimeout = null; }
  isLivePolling = false;
  liveEndedConfirms = 0;
  console.log("[VtuberVN+] Live polling stopped.");
}

function sendCrowdsourcingData(params: {
  viewCount?: number;
  ccv?: number;
  likeCount?: number;
}): void {
  window.parent.postMessage(
    {
      type: "VTUBERVN_CROWDSOURCING_DATA",
      videoId,
      viewCount: params.viewCount ?? 0,
      ccv: params.ccv ?? 0,
      likeCount: params.likeCount ?? 0,
      likeStatus: "INDIFFERENT",
    },
    "*"
  );
}

// ─── Main Logic ────────────────────────────────────────────────────────────

async function startApiPolling(apiKey: string, clientVersion: string): Promise<void> {
  // Step 1: /next — single call providing: isLive, CCV, viewCount, likeCount
  const data = await fetchNext(apiKey, clientVersion);
  if (!data) return;

  if (!data.isLive && !hasSentVodData) {
    // VOD / Past stream: send once and complete
    sendCrowdsourcingData({ viewCount: data.viewCount, likeCount: data.likeCount });
    hasSentVodData = true;
    console.log(`[VtuberVN+] VOD: viewCount=${data.viewCount}, like=${data.likeCount}`);
    return;
  }

  if (data.isLive) {
    isLivePolling = true;
    liveEndedConfirms = 0;

    // Send initial CCV and like count
    if (data.ccv > 0 || data.likeCount > 0) {
      sendCrowdsourcingData({ ccv: data.ccv, likeCount: data.likeCount });
      console.log(`[VtuberVN+] Live initial: ccv=${data.ccv}, like=${data.likeCount}`);
    }

    // Step 2: Poll /updated_metadata every 10s for CCV updates
    const now = new Date();
    let msToWait = (9 - (now.getSeconds() % 10)) * 1000 - now.getMilliseconds();
    if (msToWait <= 0) msToWait += 10000;

    const runCcvTick = async (): Promise<void> => {
      if (!isLivePolling) return;
      const video = document.querySelector("video");
      if (!video || video.paused) return;
      const ccv = await fetchLiveCcv(apiKey, clientVersion);
      if (ccv > 0) {
        sendCrowdsourcingData({ ccv });
      }
    };

    crowdsourcingTimeout = setTimeout(() => {
      void runCcvTick();
      crowdsourcingInterval = setInterval(() => { void runCcvTick(); }, 10000);
    }, msToWait);

    // Step 3: Refresh /next every 60s to sync like count and verify stream status
    nextRefreshInterval = setInterval(async () => {
      if (!isLivePolling) { clearInterval(nextRefreshInterval!); return; }

      const refreshed = await fetchNext(apiKey, clientVersion);
      if (!refreshed) return;

      if (!refreshed.isLive) {
        liveEndedConfirms++;
        console.log(`[VtuberVN+] Stream ended confirm ${liveEndedConfirms}/2`);
        if (liveEndedConfirms >= 2) stopLivePolling();
        return;
      }

      // Stream remains live: reset counter, dispatch updated CCV and likes
      liveEndedConfirms = 0;
      if (refreshed.likeCount > 0 || refreshed.ccv > 0) {
        sendCrowdsourcingData({ ccv: refreshed.ccv, likeCount: refreshed.likeCount });
      }
    }, 60_000);
  }
}

async function startCrowdsourcing(): Promise<void> {
  if (!videoId) return;

  const isEnabled = await Options.get("enableCrowdsourcing");
  if (!isEnabled) return;

  stopLivePolling();
  hasSentVodData = false;

  console.log(`[VtuberVN+] Crowdsourcing for videoId=${videoId}, polling ytcfg...`);

  let retries = 0;
  const pollForYtCfg = async (): Promise<void> => {
    const ytData = await requestYtCfgFromMain();
    if (ytData.apiKey && ytData.clientVersion) {
      console.log(`[VtuberVN+] ytcfg found! Starting crowdsourcing.`);
      await startApiPolling(ytData.apiKey, ytData.clientVersion);
    } else {
      retries++;
      if (retries < 30) setTimeout(() => { void pollForYtCfg(); }, 500);
      else console.warn("[VtuberVN+] Timed out waiting for ytcfg.");
    }
  };
  void pollForYtCfg();
}

// ─── Export ────────────────────────────────────────────────────────────────

export function initCrowdsourcing(): void {
  void startCrowdsourcing();

  window.addEventListener("message", (event: MessageEvent<Record<string, unknown>>) => {
    if (!validOrigin(event.origin) && event.origin !== window.location.origin && event.origin !== "https://www.youtube.com") return;
    const evEvent = event.data?.event;

    // Receive video context from host web app (YoutubePlayer.vue on ready)
    if (evEvent === "videoContext") {
      videoContext = {
        status: event.data.status as string | undefined,
        type: event.data.type as string | undefined,
      };
      console.log(`[VtuberVN+] videoContext from webs: status=${videoContext.status ?? "?"}, type=${videoContext.type ?? "?"}`);
      return;
    }

    // Stream ended notification from host web app (YouTube IFrame API stateChange ENDED)
    if (evEvent === "streamEnded") {
      console.log("[VtuberVN+] streamEnded signal from webs → stopping live polling");
      stopLivePolling();
      return;
    }

    // Crowdsourcing toggle
    if (validOrigin(event.origin) && evEvent === "updateCrowdsourcing") {
      void Options.get("enableCrowdsourcing").then((enabled) => {
        if (enabled) {
          void startCrowdsourcing();
        } else {
          stopLivePolling();
        }
      });
    }
  });
}
