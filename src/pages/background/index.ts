import { openVtuberVNUrl } from "@utils";
import {
  contextMenus,
  runtime,
} from "webextension-polyfill";

console.log("[VtuberVN+] background script loaded");

runtime.onInstalled.addListener(() => {
  const ytVideoPages = [
    "https://*.youtube.com/feed/*",
    "https://*.youtube.com/watch?*",
    "https://*.youtube.com/shorts/*",
  ];

  const ytChannelPages = [
    "https://*.youtube.com/channel*",
    "https://*.youtube.com/@*",
  ];

  contextMenus.create({
    id: "openLinkVtuberVN",
    title: "Open in VtuberVN",
    contexts: [ "link" ],
    targetUrlPatterns: [ ...ytVideoPages, ...ytChannelPages ],
  });

  contextMenus.create({
    id: "openLinkMultiview",
    title: "Open in Multiview",
    contexts: [ "link" ],
    targetUrlPatterns: ytVideoPages,
  });

  contextMenus.create({
    id: "openPageVtuberVN",
    title: "Open in VtuberVN",
    contexts: [ "page" ],
    documentUrlPatterns: [ ...ytVideoPages, ...ytChannelPages ],
  });

  contextMenus.create({
    id: "openPageMultiview",
    title: "Open in Multiview",
    contexts: [ "page" ],
    documentUrlPatterns: ytVideoPages,
  });
});

contextMenus.onClicked.addListener(async (info, tab) => {
  if (!(tab && tab.url)) return;
  const linkUrl = info.linkUrl || tab.url;
  let isMultiview = false;

  const menuItem = info.menuItemId as string;

  if (menuItem.includes("Multiview"))
    isMultiview = true;

  await openVtuberVNUrl(linkUrl, tab, isMultiview);
});

runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.greeting === "ytButton_Click" && request.pageUrl && sender.tab) {
    openVtuberVNUrl(request.pageUrl, sender.tab, request.isMultiview);
    sendResponse();
  }
});
