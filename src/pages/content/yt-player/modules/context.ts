import { YtLikeData } from "./types";
import { sha1, translations, Locale, validOrigin } from "@utils";
import { storage } from "webextension-polyfill";

export const videoId = window.location.pathname.split("/").slice(-1)[0];

let currentLocale: Locale = "vi";

export async function initLocale(): Promise<void> {
  const res = await storage.local.get("vtubervn_locale");
  if (res.vtubervn_locale === "en") {
    currentLocale = "en";
  } else {
    currentLocale = "vi";
  }
}

storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.vtubervn_locale) {
    currentLocale = changes.vtubervn_locale.newValue === "en" ? "en" : "vi";
  }
});

export function t(key: keyof typeof translations.vi.ytPlayer): string {
  return translations[currentLocale].ytPlayer[key];
}

let currentUserAvatarUrl = "";
export function getCurrentUserAvatarUrl(): string {
  return currentUserAvatarUrl;
}
export function setCurrentUserAvatarUrl(url: string) {
  currentUserAvatarUrl = url;
}

let cachedYtLikeData: YtLikeData | null = null;
let ytLikeDataPromise: Promise<YtLikeData | null> | null = null;

export function getCachedYtLikeData(): YtLikeData | null {
  return cachedYtLikeData;
}

export function setCachedYtLikeData(data: YtLikeData | null) {
  cachedYtLikeData = data;
}

export function getAvatarId(url: string | null | undefined): string {
  if (!url) return "";
  const match = url.match(/yt3\.ggpht\.com\/([^=]+)/);
  return match ? match[1] : url;
}

/** Try fallback regex patterns for a field, returning the first successful match */
function tryMatchPatterns(doc: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = doc.match(pattern)?.[1];
    if (match) return match;
  }
  return undefined;
}

/** Extract InnerTube configuration from YouTube window/DOM globals as a last-resort fallback */
function tryExtractFromDom(): Partial<YtLikeData> {
  try {
    const ytcfgData = (window as unknown as Record<string, unknown>).ytcfg as Record<string, unknown> | undefined;
    if (!ytcfgData || typeof ytcfgData.get !== "function") return {};
    const getCfg = ytcfgData.get as (key: string) => unknown;
    const apiKey = getCfg("INNERTUBE_API_KEY") as string | undefined;
    const ytClientName = String(getCfg("INNERTUBE_CONTEXT_CLIENT_NAME") ?? "");
    const ytClientVersion = getCfg("INNERTUBE_CONTEXT_CLIENT_VERSION") as string | undefined;
    const context = getCfg("INNERTUBE_CONTEXT") as Record<string, unknown> | undefined;
    if (apiKey && ytClientVersion && context && Object.keys(context).length > 0) {
      return { apiKey, ytClientName, ytClientVersion, context: context as YtLikeData['context'] };
    }
  } catch {
    // silent fail
  }
  return {};
}

/** Dispatch regex/DOM fallback failure telemetry to the parent host frame */
function notifyRegexFailure(failedFields: string[]): void {
  try {
    const targetOrigin = validOrigin(document.referrer) ? new URL(document.referrer).origin : "https://vtuberhub.vn";
    window.parent.postMessage(
      {
        type: "VTUBERVN_REGEX_FAILURE",
        videoId,
        failedFields,
        timestamp: Date.now(),
      },
      targetOrigin,
    );
  } catch {
    // silent fail
  }
}

export async function getYtLikeData(): Promise<YtLikeData | null> {
  if (cachedYtLikeData) return cachedYtLikeData;
  if (ytLikeDataPromise) return ytLikeDataPromise;

  ytLikeDataPromise = (async () => {
    try {
      const doc = await fetch(`https://www.youtube.com/watch?v=${videoId}`).then(
        (r) => r.text(),
      );

      const apiKey = tryMatchPatterns(doc, [
        /"INNERTUBE_API_KEY":"(.*?)"/,
        /"innertubeApiKey":"(.*?)"/,
        /ytcfg\.set\([^)]*"INNERTUBE_API_KEY":"([^"]+)"/,
      ]);

      let context: Record<string, unknown> = {};
      const contextPatterns: RegExp[] = [
        new RegExp('\\(\\{"INNERTUBE_CONTEXT":([\\w\\W]*?)}\\)'),
        new RegExp('"INNERTUBE_CONTEXT":([\\w\\W]*?}),"INNERTUBE'),
        new RegExp('"innertubeContext":([\\w\\W]*?}),"'),
      ];
      for (const p of contextPatterns) {
        try {
          const raw = doc.match(p)?.[1];
          if (raw) {
            context = JSON.parse(raw);
            if (Object.keys(context).length > 0) break;
          }
        } catch {
          // next pattern
        }
      }

      const ytClientName = tryMatchPatterns(doc, [
        /"INNERTUBE_CONTEXT_CLIENT_NAME":(\d+),/,
        /"innertube_context_client_name":(\d+)/i,
      ]);

      const ytClientVersion = tryMatchPatterns(doc, [
        /"INNERTUBE_CONTEXT_CLIENT_VERSION":"(.*?)"/,
        /"innertubeContextClientVersion":"(.*?)"/,
      ]);

      const pageId = tryMatchPatterns(doc, [
        /"DELEGATED_SESSION_ID":"(.*?)"/,
        /"delegatedSessionId":"(.*?)"/,
      ]);

      const likeParams = tryMatchPatterns(doc, [
        /"likeParams":"(.*?)"/,
        /"like_params":"(.*?)"/,
      ]);

      const removeLikeParams = tryMatchPatterns(doc, [
        /"removeLikeParams":"(.*?)"/,
        /"remove_like_params":"(.*?)"/,
      ]);

      const PAPISID = document.cookie.match(/3PAPISID=([^;]*);?.*$/)?.[1];

      const likeStatus = tryMatchPatterns(doc, [
        /"likeStatus":"(LIKE|DISLIKE|INDIFFERENT)"/,
        /"like_status":"(LIKE|DISLIKE|INDIFFERENT)"/,
      ]) ?? "INDIFFERENT";

      const resumeTime = parseInt(
        tryMatchPatterns(doc, [
          /"startSeconds":(\d+)/,
          /"start_seconds":(\d+)/,
        ]) ?? "0",
      );

      const isSubscribedRaw = tryMatchPatterns(doc, [
        /"subscribed":(true|false)/,
        /"isSubscribed":(true|false)/,
      ]);
      const isSubscribed = isSubscribedRaw === "true";

      const failedFields: string[] = [];
      let domFallback: Partial<YtLikeData> = {};

      const isMissingCore = !apiKey || Object.keys(context).length === 0 || !ytClientName || !ytClientVersion;
      if (isMissingCore) {
        domFallback = tryExtractFromDom();
        if (!apiKey && !domFallback.apiKey) failedFields.push("apiKey");
        if (Object.keys(context).length === 0 && !domFallback.context) failedFields.push("context");
        if (!ytClientName && !domFallback.ytClientName) failedFields.push("ytClientName");
        if (!ytClientVersion && !domFallback.ytClientVersion) failedFields.push("ytClientVersion");
      }

      const finalApiKey = apiKey ?? domFallback.apiKey;
      const finalContext = Object.keys(context).length > 0 ? context : (domFallback.context ?? {});
      const finalClientName = ytClientName ?? domFallback.ytClientName ?? "";
      const finalClientVersion = ytClientVersion ?? domFallback.ytClientVersion;

      if (failedFields.length > 0) {
        notifyRegexFailure(failedFields);
        console.warn("[VtuberVN+] Regex parsing failed, missing fields:", failedFields);
      }

      if (
        !finalApiKey ||
        Object.keys(finalContext).length === 0 ||
        !finalClientName ||
        !finalClientVersion
      ) {
        return null;
      }

      cachedYtLikeData = {
        apiKey: finalApiKey,
        context: finalContext as YtLikeData['context'],
        ytClientName: finalClientName,
        ytClientVersion: finalClientVersion,
        pageId,
        likeParams,
        removeLikeParams,
        PAPISID: PAPISID || "",
        likeStatus,
        resumeTime,
        isSubscribed,
      };
      return cachedYtLikeData;
    } catch (e) {
      console.error(t("errorGettingYtLikeData"), e);
      return null;
    }
  })();

  return ytLikeDataPromise;
}

export async function fetchYoutubeApi(
  endpoint: string,
  bodyData: Record<string, unknown>,
  ytLikeData: YtLikeData,
): Promise<any> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Goog-AuthUser": "0",
    "X-Goog-Visitor-Id": ytLikeData.context?.client?.visitorData || "",
    "X-Youtube-Client-Name": ytLikeData.ytClientName,
    "X-Youtube-Client-Version": ytLikeData.ytClientVersion,
    "X-Origin": "https://www.youtube.com",
  };

  if (ytLikeData.pageId) {
    headers["X-Goog-PageId"] = ytLikeData.pageId;
  }

  if (ytLikeData.PAPISID) {
    const nowTime = Math.floor(Date.now() / 1000);
    const authHeader = `SAPISIDHASH ${nowTime}_${await sha1(`${nowTime} ${ytLikeData.PAPISID} https://www.youtube.com`)}`;
    headers["Authorization"] = authHeader;
  }

  return fetch(
    `https://www.youtube.com/youtubei/v1/${endpoint}?key=${ytLikeData.apiKey}`,
    {
      method: "POST",
      mode: "same-origin",
      referrer: `https://www.youtube.com/watch?v=${videoId}`,
      referrerPolicy: "origin-when-cross-origin",
      headers,
      body: JSON.stringify({
        context: ytLikeData.context,
        ...bodyData,
      }),
    },
  ).then(async (r) => {
    const text = await r.text();
    return text ? JSON.parse(text) : { success: r.ok };
  });
}

export async function like(): Promise<boolean> {
  const ytLikeData = await getYtLikeData();
  if (!ytLikeData) return false;
  const {
    apiKey,
    context,
    pageId,
    ytClientName,
    ytClientVersion,
    PAPISID,
    likeParams,
  } = ytLikeData;
  const nowTime = Math.floor(Date.now() / 1000);
  try {
    const res = await fetch(
      `https://www.youtube.com/youtubei/v1/like/like?key=${apiKey}`,
      {
        method: "POST",
        referrer: `https://youtube.com/watch?v=${videoId}`,
        mode: "same-origin",
        referrerPolicy: "origin-when-cross-origin",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-AuthUser": "0",
          "X-Goog-Visitor-Id": context.client.visitorData,
          ...(pageId && { "X-Goog-PageId": pageId }),
          "X-Youtube-Client-Name": ytClientName,
          "X-Youtube-Client-Version": ytClientVersion,
          "X-Origin": "https://www.youtube.com",
          "SEC-CH-UA-ARCH": "x86",
          "sec-ch-ua-platform-version": "10.0.0",
          "sec-ch-ua-full-version": "93.0.4577.82",
          Authorization: `SAPISIDHASH ${nowTime}_${await sha1(
            `${nowTime} ${PAPISID} https://www.youtube.com`,
          )}`,
        },
        body: JSON.stringify({
          context,
          target: { videoId },
          params: likeParams,
        }),
      },
    ).then(async (r) => ({ status: r.status, body: await r.text() }));
    if (res.status === 200) {
      return true;
    }
  } catch (e) {
    console.error(t("errorSendingLike"), e);
  }
  return false;
}
