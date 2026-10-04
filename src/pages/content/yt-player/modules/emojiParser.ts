import { EmojiCategory, EmojiItem, SponsorBadgeRenderer } from "./types";
import { setCurrentUserAvatarUrl, t } from "./context";
import { validOrigin } from "@utils";

export function extractAndSendChannelEmojis(res: any): void {
  try {
    const endpoints: any[] = res?.onResponseReceivedEndpoints || [];
    const continuationItems: any[] = [];
    for (const ep of endpoints) {
      if (ep.appendContinuationItemsAction?.continuationItems) {
        continuationItems.push(
          ...ep.appendContinuationItemsAction.continuationItems,
        );
      } else if (ep.reloadContinuationItemsCommand?.continuationItems) {
        continuationItems.push(
          ...ep.reloadContinuationItemsCommand.continuationItems,
        );
      }
    }

    const headerItem = continuationItems.find(
      (item: any) => item.commentsHeaderRenderer,
    );
    if (!headerItem) return;

    const simplebox =
      headerItem.commentsHeaderRenderer?.createRenderer
        ?.commentSimpleboxRenderer;

    const avatarUrl = simplebox?.authorThumbnail?.thumbnails?.[0]?.url;
    if (avatarUrl) {
      setCurrentUserAvatarUrl(avatarUrl);
    }

    // YouTube can place emojiPicker in 2 different locations depending on UI version
    const emojiPickerRenderer =
      simplebox?.emojiPicker?.emojiPickerRenderer ||
      simplebox?.emojiButton?.buttonRenderer?.navigationEndpoint
        ?.commentEmojiPickerRenderer;

    if (!emojiPickerRenderer?.categories) return;

    // Build lookup map for emojis
    const emojiMap = new Map<string, any>();
    for (const emo of emojiPickerRenderer.emojis || []) {
      if (emo.emojiId) emojiMap.set(emo.emojiId, emo);
    }

    // Modern YouTube API: root emojis list may be empty -> safe iterative recursive search
    if (emojiMap.size === 0) {
      const stack: any[] = [res];
      while (stack.length > 0) {
        const obj = stack.pop();
        if (!obj || typeof obj !== "object") continue;
        
        if (obj.emojiId && obj.image?.thumbnails) {
          emojiMap.set(obj.emojiId, obj);
          continue;
        }
        
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const val = obj[key];
            if (val && typeof val === "object") {
              stack.push(val);
            }
          }
        }
      }
    }

    const categories: EmojiCategory[] = [];

    for (const cat of emojiPickerRenderer.categories) {
      const renderer = cat.emojiPickerCategoryRenderer;
      if (!renderer) continue;

      const categoryName: string =
        renderer.title?.simpleText || renderer.categoryId || "Unknown";
      
      const categoryImage: string = renderer.image?.thumbnails?.[0]?.url || "";

      const emojis: EmojiItem[] = [];

      let sourceEmojis: any[] = [];
      if (renderer.emojiIds && emojiMap.size > 0) {
        sourceEmojis = renderer.emojiIds.map((id: string) => emojiMap.get(id)).filter(Boolean);
      }
      if (sourceEmojis.length === 0) {
        sourceEmojis = renderer.emojis || [];
      }

      for (const emoWrapper of sourceEmojis) {
        const emo = emoWrapper.emoji || emoWrapper;
        if (!emo) continue;

        const shortcut: string = emo.shortcuts?.[0] || emo.emojiId || "";
        const thumbs: Array<{ url: string; width?: number }> =
          emo.image?.thumbnails || [];
        const src: string =
          thumbs.reduce(
            (
              best: { url: string; width?: number },
              t: { url: string; width?: number },
            ) => ((t.width ?? 0) > (best.width ?? 0) ? t : best),
            thumbs[0] || { url: "" },
          ).url || "";
        const alt: string = emo.searchTerms?.[0] || shortcut;
        const isCustom = !!emo.isCustomEmoji;

        if (shortcut && src) {
          emojis.push({ shortcut, src, alt, isCustom });
        }
      }

      if (emojis.length > 0) {
        categories.push({ category: categoryName, categoryImage, emojis });
      }
    }

    // ── Detect membership category ─────────────────────────────────────────────
    let isMember = false;
    let membershipLabel = "";
    let membershipBadge = "";
    let membershipDuration = "";

    const sponsorBadgeRenderer: SponsorBadgeRenderer | null =
      simplebox?.authorCommentBadge?.sponsorCommentBadgeRenderer ?? null;

    if (sponsorBadgeRenderer) {
      const badgeUrl =
        sponsorBadgeRenderer.customBadge?.image?.thumbnails?.[0]?.url ||
        sponsorBadgeRenderer.image?.thumbnails?.[0]?.url ||
        "";
      if (badgeUrl) {
        const hasCustomEmojis = categories.some(cat => cat.emojis.some(e => e.isCustom));

        if (hasCustomEmojis) {
          isMember = true;
          membershipBadge = badgeUrl;
          const tooltipText =
            sponsorBadgeRenderer.tooltip || sponsorBadgeRenderer.iconTooltip || "";

          const durationMatch = tooltipText.match(/\(([^)]+)\)$/);
          if (durationMatch) {
            membershipDuration = durationMatch[1];
            const nameMatch = tooltipText.match(
              /(?:Hội viên|Member)\s*\(([^)]+)\)/,
            );
            if (nameMatch) {
              membershipLabel = nameMatch[1];
            } else {
              membershipLabel = tooltipText.replace(/\(([^)]+)\)$/, "").trim();
            }
          } else {
            const nameMatch = tooltipText.match(
              /(?:Hội viên|Member)\s*\(([^)]+)\)/,
            );
            membershipLabel = nameMatch ? nameMatch[1] : tooltipText;
            membershipDuration = t("newMember");
          }
        }
      }
    }

    const targetOrigin = validOrigin(document.referrer) ? new URL(document.referrer).origin : "https://vtuberhub.vn";
    window.parent.postMessage(
      {
        type: "VTUBERVN_CHANNEL_EMOJIS",
        emojis: categories,
        isMember,
        membershipLabel,
        membershipBadge,
        membershipDuration,
      },
      targetOrigin,
    );
  } catch (err) {
    console.error(t("errorFetchingComments"), err);
  }
}
