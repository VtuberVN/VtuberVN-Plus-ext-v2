import { validOrigin } from "@utils";

export function initApiHandlers(): void {
  window.addEventListener("message", (event) => {
    if (validOrigin(event.origin)) {
      if (event.data?.event === "checkLikeStatus") {
        console.log(`[VtuberVN+ Lite] checkLikeStatus -> Status: INDIFFERENT, Subscribed: false (Disabled in Lite)`);
        window.parent.postMessage(
          {
            type: "VTUBERVN_LIKE_STATUS",
            status: "INDIFFERENT",
            resumeTime: 0,
            isSubscribed: false,
          },
          "*",
        );
      }
    }
  });
}
