import { inject, validOrigin } from "@utils";
import audioCaptureInjectPath from "../audioCapture?script&module";
import { storage } from "webextension-polyfill";

export function initAudioVisualizerBridge(): void {
  // Inject audio capture script for audio wave visualizer
  // Executes in embed iframe page context -> waits for START -> captures Web Audio -> streams FFT data
  inject(audioCaptureInjectPath);

  // Read and sync visualizer max FPS configuration from storage to page context
  storage.local
    .get("visualizerMaxFps")
    .then((res) => {
      const maxFps = typeof res.visualizerMaxFps === "number" ? res.visualizerMaxFps : 60;
      window.postMessage({ type: "VTUBERVN_AUDIO_CONFIG", maxFps }, window.location.origin);
    })
    .catch(() => {});

  storage.onChanged.addListener((changes, area) => {
    if (
      area === "local" &&
      changes.visualizerMaxFps &&
      typeof changes.visualizerMaxFps.newValue === "number"
    ) {
      window.postMessage(
        { type: "VTUBERVN_AUDIO_CONFIG", maxFps: changes.visualizerMaxFps.newValue },
        window.location.origin
      );
    }
  });

  // Bridge: forward messages between inject script (page context) <-> parent window (host app)
  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data?.type) return;

    const isTrustedOrigin =
      event.origin === window.location.origin ||
      event.origin === "https://www.youtube.com" ||
      !!validOrigin(event.origin);
    if (!isTrustedOrigin) return;

    // Forward audio data, ACK, and heartbeat from inject script to parent host app
    if (
      data.type === "VTUBERVN_AUDIO_DATA" ||
      data.type === "VTUBERVN_AUDIO_CAPTURE_ACK" ||
      data.type === "VTUBERVN_AUDIO_CAPTURE_HEARTBEAT"
    ) {
      try {
        const targetOrigin = validOrigin(document.referrer) ? new URL(document.referrer).origin : "https://vtuberhub.vn";
        window.parent.postMessage(data, targetOrigin);
      } catch (_) {}
    }

    // Forward START/STOP control commands from parent down to inject script in page context
    if (
      data.type === "VTUBERVN_AUDIO_CAPTURE_START" ||
      data.type === "VTUBERVN_AUDIO_CAPTURE_STOP"
    ) {
      if (event.source !== window) {
        window.postMessage(data, window.location.origin);
      }
    }
  });
}
