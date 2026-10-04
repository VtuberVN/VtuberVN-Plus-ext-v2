import { initLocale } from "./modules/context";
import { initFastHideUI } from "./modules/fastHideUI";
import { initAudioVisualizerBridge } from "./modules/audioVisualizerBridge";
import { initApiHandlers } from "./modules/apiHandlers";
import { initCrowdsourcing } from "./modules/crowdsourcing";

if (!import.meta.env.DEV) {
  console.log = () => {};
  console.debug = () => {};
}

console.log("[VtuberVN+] yt-player content script is loading in iframe:", window.location.href);

// Initialize core features after locale synchronization
initLocale().then(() => {
  initFastHideUI();
  initAudioVisualizerBridge();
  initApiHandlers();
  initCrowdsourcing();
});
