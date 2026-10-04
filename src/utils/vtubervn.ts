import { Tabs } from "webextension-polyfill";
import { Options } from "@utils";

const VTUBERVN_URL_HOME = "https://vtuberhub.vn";
const VTUBERVN_URL_REGEX = /^(?:[^:]+:\/\/)?(?:[^\/]+\.)?vtuberhub.vn\b/i;
const YOUTUBE_HOSTNAME_REGEX = /^(?:[^\/]+\.)?youtube.com/i;
const FEED_PATHNAME_REGEX = /^(?:\/?$|\/feed\b)/i; // pathname matches homepage or any feed like subscriptions
const CHANNEL_URL_REGEX = /(?<=[=\/?&#])[A-Za-z0-9\-_]{24}(?=[=\/?&#]|$)/;
const VIDEO_URL_REGEX = /(?<=[=\/?&#])[A-Za-z0-9\-_]{11}(?=[=\/?&#]|$)/;
const CANONICAL_URL_REGEX =
  /\/(?:channel\/[A-Za-z0-9\-_]{24}|(?:shorts\/|watch\?v=)[A-Za-z0-9\-_]{11})\b/;

export async function openVtuberVNUrl(url: string, tab: Tabs.Tab, isMultiview: boolean = false) {
  const vtubervnUrl = await getVtuberVNUrl(url, isMultiview);
  if (!vtubervnUrl) return;

  const currentTabId = tab.id;
  if (currentTabId)
    await chrome.tabs.update(currentTabId, { url: vtubervnUrl });
  else
    // fallback behavior
    await chrome.tabs.create({ url: vtubervnUrl, index: 9999 });
}

/**
 * Returns a promise resolving to the VtuberVN URL for given URL.
 * Supports returning VtuberVN channel and watch VtuberVN URLs,
 * and defaults to VtuberVN homepage for non-YT URLs and YT homepage & feeds.
 * For other YT URLs, including the new @<channel> URLs, delegates to given handler,
 * which is passed the given URL and returns a promise resolving to a YT canonical URL,
 * from which to derive the VtuberVN URL from.
 */
export async function getVtuberVNUrl(url: string | undefined, isMultiview: boolean) {
  if (url) {
    /** Do nothing if the given URL is VtuberVN */
    if (VTUBERVN_URL_REGEX.test(url)) {
      return null;
    }

    /** Match with given URL */
    const result = matchUrl(url, isMultiview);
    if (result) return result;

    /** Match with canonical URL */
    const urlObj = new URL(url);
    if (YOUTUBE_HOSTNAME_REGEX.test(urlObj.hostname) && !FEED_PATHNAME_REGEX.test(urlObj.pathname)) {
      const canonicalUrl = await findCanonicalUrl(url);

      if (canonicalUrl) {
        const result = matchUrl(canonicalUrl, isMultiview);
        if (result) return result;
      }
    }
  }

  /** Return VtuberVN URL after all tests exhausted */
  if (isMultiview) return VTUBERVN_URL_HOME.concat(`/multiview`);
  return VTUBERVN_URL_HOME;
}

/** Attempt to match given URL */
function matchUrl(testUrl: string, isMultiview: boolean): string | undefined {
  const videoMatch = testUrl.match(VIDEO_URL_REGEX);
  if (videoMatch) {
    if (isMultiview) return VTUBERVN_URL_HOME.concat(`/multiview/AAUY${ videoMatch[0] }%2CUAEYchat`);
    return VTUBERVN_URL_HOME.concat(`/watch/${ videoMatch[0] }`);
  }

  const channelMatch = testUrl.match(CHANNEL_URL_REGEX);
  if (channelMatch) {
    if (isMultiview) return VTUBERVN_URL_HOME.concat(`/multiview`)
    return VTUBERVN_URL_HOME.concat(`/channel/${ channelMatch[0] }`);
  }
}

/** Retrieve canonical URL */
async function findCanonicalUrl(url: string): Promise<string | null> {
  const doc = await (await fetch(url)).text();
  const match = doc.match(CANONICAL_URL_REGEX);
  const canonicalUrl = match ? "https://www.youtube.com" + match[0] : null;
  return canonicalUrl;
}
