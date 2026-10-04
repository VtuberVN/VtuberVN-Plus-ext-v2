import { Options, validOrigin } from "@utils";
import { videoId, getYtLikeData, fetchYoutubeApi, like, t } from "./context";
import { detectAndSendUserRole } from "./roleDetector";
import { extractAndSendChannelEmojis } from "./emojiParser";

let currentHostOrigin = "https://vtuberhub.vn";

function postToParent(payload: unknown, targetOrigin?: string): void {
  try {
    const origin = targetOrigin || currentHostOrigin || (validOrigin(document.referrer) ? new URL(document.referrer).origin : "https://vtuberhub.vn");
    window.parent.postMessage(payload, origin);
  } catch {
    // silent fail
  }
}

/** Dispatch session expired signal to host web app */
function sendSessionExpiredAlert(): void {
  try {
    postToParent({
      type: "VTUBERVN_SESSION_EXPIRED",
      timestamp: Date.now(),
    });
  } catch {
    // silent fail
  }
}

/**
 * Safe wrapper for fetchYoutubeApi — handles 401/403 auth errors and dispatches session expiration alert.
 * Returns response data or null on critical errors.
 */
async function safeFetchYoutubeApi(
  endpoint: string,
  bodyData: Record<string, unknown>,
): Promise<unknown> {
  const ytLikeData = await getYtLikeData();
  if (!ytLikeData) return null;

  // Check PAPISID presence first — missing PAPISID indicates unauthenticated state
  if (!ytLikeData.PAPISID) {
    sendSessionExpiredAlert();
    return null;
  }

  const result = await fetchYoutubeApi(endpoint, bodyData, ytLikeData);

  // Check for authentication failure codes in InnerTube response
  if (result && typeof result === "object") {
    const res = result as Record<string, unknown>;
    const errorCode = (res.error as Record<string, unknown> | undefined)?.code;
    if (errorCode === 401 || errorCode === 403) {
      sendSessionExpiredAlert();
      return null;
    }
  }

  return result;
}

export function initApiHandlers(): void {
  window.addEventListener("message", async (event) => {
    if (validOrigin(event.origin)) {
      currentHostOrigin = event.origin;

      if (event.data?.event === "checkLikeStatus") {
        try {
          const ytLikeData = await getYtLikeData();
          if (ytLikeData) {
            console.log(`[VtuberVN+] checkLikeStatus -> Status: ${ytLikeData.likeStatus || 'INDIFFERENT'}, Subscribed: ${!!ytLikeData.isSubscribed}`);
            postToParent(
              {
                type: "VTUBERVN_LIKE_STATUS",
                status: ytLikeData.likeStatus || "INDIFFERENT",
                resumeTime: ytLikeData.resumeTime || 0,
                isSubscribed: !!ytLikeData.isSubscribed,
              },
              event.origin,
            );
          }
        } catch (e) {
          console.error(t("errorGettingYtLikeData"), e);
        }
      }

      if (event.data?.event === "checkSubscribeStatus") {
        try {
          const { channelId } = event.data;
          const ytLikeData = await getYtLikeData();
          if (channelId && ytLikeData) {
            const res = await fetchYoutubeApi("browse", { browseId: channelId }, ytLikeData);
            
            // Recursive helper to find key in nested JSON objects
            const deepFind = (obj: any, key: string): any => {
              if (obj === null || typeof obj !== 'object') return undefined;
              if (key in obj) return obj[key];
              for (const k in obj) {
                const found = deepFind(obj[k], key);
                if (found !== undefined) return found;
              }
              return undefined;
            };

            const subscribeBtn = deepFind(res, 'subscribeButtonRenderer');
            const toggleBtn = deepFind(res, 'subscriptionNotificationToggleButtonRenderer');
            
            const isSubscribed = !!(subscribeBtn?.subscribed || toggleBtn || deepFind(res, 'subscribed') === true);
            let notificationState = 0; // 0 = not subbed or unknown
            
            if (isSubscribed) {
              notificationState = toggleBtn?.currentStateId || 2;
            }

            console.log(`[VtuberVN+] checkSubscribeStatus -> Channel: ${channelId}, Subscribed: ${isSubscribed}, State: ${notificationState}`);
            
            postToParent(
              { type: "VTUBERVN_SUBSCRIBE_STATUS", channelId, isSubscribed, notificationState },
              event.origin,
            );
          }
        } catch (e) {
          console.error(t("errorGettingYtLikeData"), e);
        }
      }

      // Fetch Comments (Continuation)
      if (event.data?.event === "fetchComments") {
        try {
          let { continuation } = event.data;

          const ytLikeData = await getYtLikeData();
          if (!ytLikeData) {
            console.error(t("errorGettingYtLikeData"));
            return;
          }

          if (!continuation) {
            const res = await fetchYoutubeApi("next", { videoId }, ytLikeData);
            if (res) {
              const items =
                res.contents?.twoColumnWatchNextResults?.results?.results?.contents;
              const commentsSection = items?.find(
                (x: any) =>
                  x.itemSectionRenderer?.targetId === "comments-section" ||
                  x.itemSectionRenderer?.sectionIdentifier === "comment-item-section",
              );
              if (commentsSection) {
                continuation =
                  commentsSection.itemSectionRenderer?.contents?.[0]
                    ?.continuationItemRenderer?.continuationEndpoint
                    ?.continuationCommand?.token;
              } else {
                console.error(t("errorFetchingComments"));
              }
            } else {
              console.error(t("errorFetchingComments"));
            }
          }

          if (continuation) {
            const res = await fetchYoutubeApi(
              "next",
              { continuation },
              ytLikeData,
            );
            detectAndSendUserRole(res);
            extractAndSendChannelEmojis(res);
            postToParent(
              { type: "VTUBERVN_COMMENTS_DATA", data: res },
              event.origin,
            );
          }
        } catch (e) {
          console.error(t("errorFetchingComments"), e);
        }
      }

      // Fetch Comment Replies
      if (event.data?.event === "fetchReplies") {
        try {
          const { continuation, commentKey } = event.data;
          const ytLikeData = await getYtLikeData();
          if (ytLikeData && continuation) {
            const res = await fetchYoutubeApi(
              "comment/get_comment_replies",
              { continuation },
              ytLikeData,
            );
            postToParent(
              { type: "VTUBERVN_REPLIES_DATA", commentKey, data: res },
              event.origin,
            );
          }
        } catch (e) {
          console.error(t("errorFetchingComments"), e);
        }
      }

      // Create Comment
      if (event.data?.event === "createComment") {
        try {
          const { commentText, createCommentParams } = event.data;
          const ytLikeData = await getYtLikeData();
          if (ytLikeData && commentText && createCommentParams) {
            const res = await fetchYoutubeApi(
              "comment/create_comment",
              { commentText, createCommentParams },
              ytLikeData,
            );
            postToParent(
              { type: "VTUBERVN_COMMENT_POSTED", data: res },
              event.origin,
            );
          }
        } catch (e) {
          console.error(t("errorPostingComment"), e);
        }
      }

      // Edit Comment
      if (event.data?.event === "editComment") {
        try {
          const { actionParam, commentText, commentKey } = event.data;
          const ytLikeData = await getYtLikeData();
          if (ytLikeData && actionParam && commentText) {
            const res = await fetchYoutubeApi(
              "comment/update_comment",
              { commentText, updateCommentParams: actionParam },
              ytLikeData,
            );
            const success = res && !res.error ? true : false;
            postToParent(
              {
                type: "VTUBERVN_ADMIN_ACTION_RESULT",
                action: "edit",
                success,
                targetId: commentKey,
                newText: commentText,
              },
              event.origin,
            );
          }
        } catch (e) {
          console.error(t("errorEditingComment"), e);
        }
      }

      // Like / Dislike Comment
      if (event.data?.event === "likeComment") {
        try {
          const { actionParam } = event.data;
          const ytLikeData = await getYtLikeData();
          if (ytLikeData && actionParam) {
            const res = await fetchYoutubeApi(
              "comment/perform_comment_action",
              { actions: [actionParam] },
              ytLikeData,
            );
            postToParent(
              { type: "VTUBERVN_COMMENT_ACTION_DONE", data: res },
              event.origin,
            );
          }
        } catch (e) {
          console.error(t("errorLikingComment"), e);
        }
      }

      // Heart Comment
      if (event.data?.event === "heartComment") {
        try {
          const { actionParam, commentKey } = event.data;
          const ytLikeData = await getYtLikeData();
          if (ytLikeData && actionParam) {
            const res = await fetchYoutubeApi(
              "comment/perform_comment_action",
              { actions: [actionParam] },
              ytLikeData,
            );
            const success = res && res.actionResults ? true : false;
            postToParent(
              {
                type: "VTUBERVN_ADMIN_ACTION_RESULT",
                action: "heart",
                success,
                targetId: commentKey,
              },
              event.origin,
            );
          }
        } catch (e) {
          console.error(t("errorHeartingComment"), e);
        }
      }

      // Delete Comment
      if (event.data?.event === "deleteComment") {
        try {
          const { actionParam, commentKey } = event.data;
          const ytLikeData = await getYtLikeData();
          if (ytLikeData && actionParam) {
            const res = await fetchYoutubeApi(
              "comment/perform_comment_action",
              { actions: [actionParam] },
              ytLikeData,
            );
            const success = res && !res.error ? true : false;
            postToParent(
              {
                type: "VTUBERVN_ADMIN_ACTION_RESULT",
                action: "delete",
                success,
                targetId: commentKey,
              },
              event.origin,
            );
          }
        } catch (e) {
          console.error(t("errorDeletingComment"), e);
        }
      }

      // Flag Comment
      if (event.data?.event === "flagComment") {
        try {
          const { actionParam, commentKey } = event.data;
          const ytLikeData = await getYtLikeData();
          if (ytLikeData && actionParam) {
            const res = await fetchYoutubeApi(
              "comment/perform_comment_action",
              { actions: [actionParam] },
              ytLikeData,
            );
            const success = res && !res.error ? true : false;
            postToParent(
              {
                type: "VTUBERVN_ADMIN_ACTION_RESULT",
                action: "flag",
                success,
                targetId: commentKey,
              },
              event.origin,
            );
          }
        } catch (e) {
          console.error(t("errorFlaggingComment"), e);
        }
      }

      // Block / Hide User from Channel
      if (event.data?.event === "blockComment") {
        try {
          const { actionParam, commentKey } = event.data;
          const ytLikeData = await getYtLikeData();
          if (ytLikeData && actionParam) {
            const res = await fetchYoutubeApi(
              "comment/perform_comment_action",
              { actions: [actionParam] },
              ytLikeData,
            );
            const success = res && !res.error ? true : false;
            postToParent(
              {
                type: "VTUBERVN_ADMIN_ACTION_RESULT",
                action: "block",
                success,
                targetId: commentKey,
              },
              event.origin,
            );
          }
        } catch (e) {
          console.error(t("errorBlockingUser"), e);
        }
      }

      // Pin Comment
      if (event.data?.event === "pinComment") {
        try {
          const { actionParam, commentKey } = event.data;
          const ytLikeData = await getYtLikeData();
          if (ytLikeData && actionParam) {
            const res = await fetchYoutubeApi(
              "comment/perform_comment_action",
              { actions: [actionParam] },
              ytLikeData,
            );
            const success = res && !res.error ? true : false;
            postToParent(
              {
                type: "VTUBERVN_ADMIN_ACTION_RESULT",
                action: "pin",
                success,
                targetId: commentKey,
              },
              event.origin,
            );
          }
        } catch (e) {
          console.error(t("errorPinningComment"), e);
        }
      }

      // Unpin Comment
      if (event.data?.event === "unpinComment") {
        try {
          const { actionParam, commentKey } = event.data;
          const ytLikeData = await getYtLikeData();
          if (ytLikeData && actionParam) {
            const res = await fetchYoutubeApi(
              "comment/perform_comment_action",
              { actions: [actionParam] },
              ytLikeData,
            );
            const success = res && !res.error ? true : false;
            postToParent(
              {
                type: "VTUBERVN_ADMIN_ACTION_RESULT",
                action: "unpin",
                success,
                targetId: commentKey,
              },
              event.origin,
            );
          }
        } catch (e) {
          console.error(t("errorUnpinningComment"), e);
        }
      }

      // Live Chat Moderation: Delete Message
      if (event.data?.event === "deleteChatMessage") {
        try {
          const { params } = event.data;
          const ytLikeData = await getYtLikeData();
          if (ytLikeData && params) {
            const res = await fetchYoutubeApi(
              "live_chat/perform_moderation_action",
              { params: params },
              ytLikeData,
            );

            const success = res && !res.error ? true : false;
            postToParent(
              {
                type: "VTUBERVN_ADMIN_ACTION_RESULT",
                action: "deleteChat",
                success,
              },
              event.origin,
            );
          }
        } catch (e) {
          console.error(t("errorDeletingChatMessage"), e);
        }
      }

      // Live Chat Moderation: Timeout User
      if (event.data?.event === "timeoutUser") {
        try {
          const { params } = event.data;
          const ytLikeData = await getYtLikeData();
          if (ytLikeData && params) {
            const res = await fetchYoutubeApi(
              "live_chat/perform_moderation_action",
              { params: params },
              ytLikeData,
            );

            const success = res && !res.error ? true : false;
            postToParent(
              {
                type: "VTUBERVN_ADMIN_ACTION_RESULT",
                action: "timeoutChat",
                success,
              },
              event.origin,
            );
          }
        } catch (e) {
          console.error(t("errorTimingOutUser"), e);
        }
      }

      // Live Chat Moderation: Ban User
      if (event.data?.event === "banUser") {
        try {
          const { params } = event.data;
          const ytLikeData = await getYtLikeData();
          if (ytLikeData && params) {
            const res = await fetchYoutubeApi(
              "live_chat/perform_moderation_action",
              { params: params },
              ytLikeData,
            );

            const success = res && !res.error ? true : false;
            postToParent(
              {
                type: "VTUBERVN_ADMIN_ACTION_RESULT",
                action: "banChat",
                success,
              },
              event.origin,
            );
          }
        } catch (e) {
          console.error(t("errorBanningUser"), e);
        }
      }

      // Create Comment Reply
      if (event.data?.event === "createCommentReply") {
        try {
          const { commentText, createReplyParams } = event.data;
          const ytLikeData = await getYtLikeData();
          if (ytLikeData && commentText && createReplyParams) {
            const res = await fetchYoutubeApi(
              "comment/create_comment_reply",
              { commentText, createReplyParams },
              ytLikeData,
            );
            postToParent(
              { type: "VTUBERVN_COMMENT_REPLY_POSTED", data: res },
              event.origin,
            );
          }
        } catch (e) {
          console.error(t("errorReplyingComment"), e);
        }
      }

      // Subscribe Channel
      if (event.data?.event === "subscribeChannel") {
        try {
          const { channelId } = event.data;
          const ytLikeData = await getYtLikeData();
          if (ytLikeData && channelId) {
            const res = await fetchYoutubeApi(
              "subscription/subscribe",
              { channelIds: [channelId] },
              ytLikeData,
            );
            postToParent(
              { type: "VTUBERVN_SUBSCRIBE_POSTED", data: res },
              event.origin,
            );
          }
        } catch (e) {
          console.error(t("errorSubscribing"), e);
        }
      }

      // Unsubscribe Channel
      if (event.data?.event === "unsubscribeChannel") {
        try {
          const { channelId } = event.data;
          const ytLikeData = await getYtLikeData();
          if (ytLikeData && channelId) {
            const res = await fetchYoutubeApi(
              "subscription/unsubscribe",
              { channelIds: [channelId] },
              ytLikeData,
            );
            postToParent(
              { type: "VTUBERVN_UNSUBSCRIBE_POSTED", data: res },
              event.origin,
            );
          }
        } catch (e) {
          console.error(t("errorUnsubscribing"), e);
        }
      }

      // Sync Watch History
      if (event.data?.event === "syncHistory") {
        try {
          const ytLikeData = await getYtLikeData();
          if (ytLikeData) {
            const res = await fetchYoutubeApi("browse", { browseId: "FEhistory" }, ytLikeData);
            const videoIds: string[] = [];

            const contents =
              res?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]
                ?.tabRenderer?.content?.sectionListRenderer?.contents;
            if (contents) {
              for (const section of contents) {
                const itemSection = section?.itemSectionRenderer?.contents;
                if (itemSection) {
                  for (const item of itemSection) {
                    const id = item?.videoRenderer?.videoId;
                    if (id) videoIds.push(id);
                  }
                }
              }
            }
            postToParent(
              { type: "VTUBERVN_HISTORY_SYNC_DATA", videoIds },
              event.origin,
            );
          }
        } catch (e) {
          console.error(t("errorSyncingHistory"), e);
        }
      }

      if (event.data?.event === "likeVideo") {
        const res = await like();

        const indicator = document.createElement("div");
        indicator.style.position = "fixed";
        indicator.style.bottom = "20px";
        indicator.style.right = "20px";
        indicator.style.padding = "10px 20px";
        indicator.style.borderRadius = "5px";
        indicator.style.color = "white";
        indicator.style.fontSize = "14px";
        indicator.style.zIndex = "9999";
        indicator.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
        indicator.style.transition = "opacity 0.3s ease-in-out";
        indicator.style.opacity = "1";

        if (res) {
          indicator.style.backgroundColor = "#4CAF50";
          indicator.innerText = t("videoLiked");
        } else {
          indicator.style.backgroundColor = "#F44336";
          indicator.innerText = t("videoLikeFailed");
        }

        document.body.appendChild(indicator);

        setTimeout(() => {
          indicator.style.opacity = "0";
          setTimeout(() => indicator.remove(), 300);
        }, 3000);
      }
    }
  });
}
