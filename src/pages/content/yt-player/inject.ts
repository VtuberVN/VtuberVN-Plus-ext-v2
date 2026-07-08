(function () {
  function sendYtcfg() {
    try {
      const ytcfg = (window as Record<string, any>).ytcfg;
      const apiKey = ytcfg
        ? typeof ytcfg.get === "function"
          ? ytcfg.get("INNERTUBE_API_KEY")
          : ytcfg.d
            ? ytcfg.d().INNERTUBE_API_KEY
            : undefined
        : undefined;
      const clientName = ytcfg
        ? typeof ytcfg.get === "function"
          ? ytcfg.get("INNERTUBE_CLIENT_NAME")
          : ytcfg.d
            ? ytcfg.d().INNERTUBE_CLIENT_NAME
            : undefined
        : undefined;
      const clientVersion = ytcfg
        ? typeof ytcfg.get === "function"
          ? ytcfg.get("INNERTUBE_CLIENT_VERSION")
          : ytcfg.d
            ? ytcfg.d().INNERTUBE_CLIENT_VERSION
            : undefined
        : undefined;

      let playerResponse = (window as Record<string, any>)
        .ytInitialPlayerResponse;
      if (!playerResponse && ytcfg && typeof ytcfg.get === "function") {
        const playerVars = ytcfg.get("PLAYER_VARS");
        if (playerVars && playerVars.embedded_player_response) {
          try {
            playerResponse = JSON.parse(playerVars.embedded_player_response);
          } catch (e) {}
        }
      }

      window.postMessage(
        {
          type: "VTUBERVN_EXTRACTED_YTCFG",
          data: {
            apiKey,
            clientName: clientName || "WEB_EMBEDDED_PLAYER",
            clientVersion,
            playerResponse,
          },
        },
        "*",
      );
    } catch (e) {
      window.postMessage(
        {
          type: "VTUBERVN_EXTRACTED_YTCFG",
          data: {},
        },
        "*",
      );
    }
  }

  sendYtcfg();

  window.addEventListener("message", (event: MessageEvent) => {
    if (event.data?.type === "VTUBERVN_REQUEST_YTCFG") {
      sendYtcfg();
    }
  });
})();

export {};
