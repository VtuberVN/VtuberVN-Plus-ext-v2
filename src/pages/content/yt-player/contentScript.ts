import { initLocale } from "./modules/context";
import { initFastHideUI } from "./modules/fastHideUI";
import { initAudioVisualizerBridge } from "./modules/audioVisualizerBridge";
import { initApiHandlers } from "./modules/apiHandlers";
import { initCrowdsourcing } from "./modules/crowdsourcing";

console.log("[VtuberVN+ Lite] yt-player content script is loading in iframe:", window.location.href);

// Khởi tạo các tính năng chính của Extension sau khi đồng bộ ngôn ngữ thành công
initLocale().then(() => {
  initFastHideUI();
  initAudioVisualizerBridge();
  initApiHandlers();
  initCrowdsourcing();
});
