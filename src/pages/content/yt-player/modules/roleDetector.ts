import { getCurrentUserAvatarUrl, getAvatarId, t } from "./context";
import { validOrigin } from "@utils";

export function detectAndSendUserRole(res: any): void {
  let isOwner = false;
  let isMod = false;

  try {
    const endpoints = res?.onResponseReceivedEndpoints || [];
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

    const currentUserAvatarUrl = getCurrentUserAvatarUrl();

    for (const item of continuationItems) {
      const commentRenderer =
        item.commentThreadRenderer?.comment?.commentRenderer;
      if (commentRenderer) {
        const commentAvatar = commentRenderer.authorThumbnail?.thumbnails?.[0]?.url || "";
        const isSelf = currentUserAvatarUrl && getAvatarId(commentAvatar) === getAvatarId(currentUserAvatarUrl);

        const actionBtns =
          commentRenderer.actionButtons?.commentActionButtonsRenderer;
        if (actionBtns) {
          if (
            actionBtns.creatorHeart?.creatorHeartRenderer?.heartActionParams
          ) {
            isOwner = true;
          }
          
          let hasEdit = false;
          const menuItems =
            actionBtns.moderationButton?.buttonRenderer?.menu?.menuRenderer
              ?.items || [];
          for (const mItem of menuItems) {
            const renderer = mItem.menuServiceItemRenderer;
            if (renderer) {
              const iconType = renderer.icon?.iconType || "";
              if (
                iconType === "EDIT" ||
                iconType === "UPDATE" ||
                renderer.navigationEndpoint?.updateCommentDialogEndpoint ||
                renderer.command?.updateCommentEndpoint ||
                renderer.serviceEndpoint?.updateCommentEndpoint
              ) {
                hasEdit = true;
              }
            }
          }

          if (actionBtns.deleteButton?.buttonRenderer && !isSelf && !hasEdit) {
            isMod = true;
          }

          for (const mItem of menuItems) {
            const renderer = mItem.menuServiceItemRenderer;
            if (renderer) {
              const iconType = renderer.icon?.iconType || "";
              if (iconType === "PIN" || iconType === "UNPIN") {
                isOwner = true;
              }
              if (iconType === "DELETE" && !isSelf && !hasEdit) {
                isMod = true;
              }
            }
          }
        }
      }
    }

    if (isOwner) isMod = true;

    // Dispatch detected user roles to host web app
    if (isOwner || isMod) {
      const targetOrigin = validOrigin(document.referrer) ? new URL(document.referrer).origin : "https://vtuberhub.vn";
      window.parent.postMessage(
        { type: "VTUBERVN_USER_ROLE", isOwner, isMod },
        targetOrigin,
      );
    }
  } catch (err) {
    console.error(t("errorDetectingRole"), err);
  }
}
