import { Options, loadSVGElement } from "@utils";
import { runtime, storage } from "webextension-polyfill";
import logoRaw from "@assets/img/logo.svg?raw";
import outlineRaw from "@assets/img/outline.svg?raw";

if (!import.meta.env.DEV) {
  console.log = () => {};
  console.debug = () => {};
}

// VtuberVN button injected into YouTube pages (Reactive & Toggleable)
(async () => {
  let isEnabled = (await Options.get("vtubervnButtonInYoutube")) ?? true;
  console.log("[VtuberVN+] yt-watch script loaded, isEnabled:", isEnabled);

  const logo = loadSVGElement(logoRaw);
  const outline = loadSVGElement(outlineRaw);

  let pageUrl: string = window.location.href;
  let pageType: string = window.location.pathname.startsWith("/shorts") ? "shorts" : "watch";
  let activeObserver: MutationObserver | null = null;

  const selectors = {
    shorts: "ytd-reel-video-renderer[is-active] #actions reel-action-bar-view-model, ytd-reel-video-renderer[is-active] #actions",
    watch: "#actions #top-level-buttons-computed, #top-level-buttons-computed, ytd-watch-metadata #actions #top-level-buttons-computed, ytd-menu-renderer[class*='watch'] #top-level-buttons-computed",
    buttonID: "#vtubervn-button",
    button: () => (pageType === "shorts" ? selectors.shorts : selectors.watch),
  };

  function removeButton() {
    const existing = document.querySelectorAll(selectors.buttonID);
    existing.forEach((node) => node.remove());
  }

  function ytButton_Click(e: MouseEvent) {
    e.stopPropagation();
    const isMultiview = e.ctrlKey || e.metaKey;
    runtime.sendMessage({
      pageUrl: pageUrl || window.location.href,
      greeting: "ytButton_Click",
      isMultiview,
    });
    console.debug("[VtuberVN+] yt button clicked, isMultiview:", isMultiview);
  }

  function createButton(target: Element): HTMLElement {
    const host = document.createElement("yt-button-view-model");
    host.id = "vtubervn-button";
    host.className = "ytd-menu-renderer";
    host.style.cssText = "display: inline-flex; align-items: center; margin-left: 8px; vertical-align: middle;";

    const viewModel = document.createElement("button-view-model");
    viewModel.className = "ytSpecButtonViewModelHost style-scope ytd-menu-renderer";
    viewModel.style.cssText = "display: inline-flex; align-items: center;";

    const btn = document.createElement("button");
    btn.className = "ytSpecButtonShapeNextHost ytSpecButtonShapeNextTonal ytSpecButtonShapeNextMono ytSpecButtonShapeNextSizeM ytSpecButtonShapeNextIconLeading ytSpecButtonShapeNextEnableBackdropFilterExperiment ytSpecButtonShapeNextMainstageIconSize ytSpecButtonShapeNextMainstagePadding vtubervn-yt-btn";
    btn.setAttribute("aria-label", "Mở trên VtuberVN (Ctrl + Click để mở Multiview)");
    btn.title = "Mở trên VtuberVN (Ctrl + Click để mở Multiview)";
    btn.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      position: relative;
      box-sizing: border-box;
      height: 40px;
      padding: 0 16px 0 12px;
      border-radius: 20px;
      font-family: "Roboto", "Arial", sans-serif;
      font-size: 14px;
      font-weight: 500;
      line-height: 40px;
      border: none;
      cursor: pointer;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.10) 0%, rgba(255, 255, 255, 0.07) 100%);
      box-shadow: none;
      color: var(--yt-spec-text-primary, #f1f1f1);
      transition: background 0.2s ease, color 0.2s ease, transform 0.1s ease;
      overflow: hidden;
    `;

    const iconDiv = document.createElement("div");
    iconDiv.setAttribute("aria-hidden", "true");
    iconDiv.className = "ytSpecButtonShapeNextIcon ytSpecButtonShapeNextElevatedContent";
    iconDiv.style.cssText = "margin-right: 6px; display: inline-flex; align-items: center; justify-content: center;";

    const iconWrapper = document.createElement("span");
    iconWrapper.className = "ytIconWrapperHost";
    iconWrapper.style.cssText = "width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center;";

    const iconShape = document.createElement("span");
    iconShape.className = "yt-icon-shape ytSpecIconShapeHost";
    iconShape.style.cssText = "display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;";

    const svgWrap = document.createElement("div");
    svgWrap.style.cssText = "width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; fill: currentColor;";
    svgWrap.appendChild(outline.cloneNode(true));

    iconShape.appendChild(svgWrap);
    iconWrapper.appendChild(iconShape);
    iconDiv.appendChild(iconWrapper);

    const textDiv = document.createElement("div");
    textDiv.className = "ytSpecButtonShapeNextButtonTextContent ytSpecButtonShapeNextElevatedContent";
    textDiv.textContent = "VtuberVN";

    const touchFeedback = document.createElement("yt-touch-feedback-shape");
    touchFeedback.setAttribute("aria-hidden", "true");
    touchFeedback.className = "ytSpecTouchFeedbackShapeHost ytSpecTouchFeedbackShapeTouchResponse";
    const tfStroke = document.createElement("div");
    tfStroke.className = "ytSpecTouchFeedbackShapeStroke";
    const tfFill = document.createElement("div");
    tfFill.className = "ytSpecTouchFeedbackShapeFill";
    touchFeedback.appendChild(tfStroke);
    touchFeedback.appendChild(tfFill);

    const lightShape = document.createElement("yt-light-shape");
    lightShape.setAttribute("aria-hidden", "true");
    lightShape.className = "contribYtLightShapeHost contribYtLightShapeStaticRimLightTonal contribYtLightShapeStaticRimLight";
    const washLight = document.createElement("div");
    washLight.className = "contribYtLightShapeStaticWashLight contribYtLightShapeStaticWashLightTonal";
    lightShape.appendChild(washLight);

    btn.appendChild(iconDiv);
    btn.appendChild(textDiv);
    btn.appendChild(touchFeedback);
    btn.appendChild(lightShape);

    btn.addEventListener("mouseenter", () => {
      btn.style.background = "linear-gradient(180deg, rgba(168, 85, 247, 0.25) 0%, rgba(168, 85, 247, 0.14) 100%)";
      btn.style.boxShadow = "none";
      btn.style.color = "#e9d5ff";
      svgWrap.innerHTML = "";
      svgWrap.appendChild(logo.cloneNode(true));
    });

    btn.addEventListener("mouseleave", () => {
      btn.style.background = "linear-gradient(180deg, rgba(255, 255, 255, 0.10) 0%, rgba(255, 255, 255, 0.07) 100%)";
      btn.style.boxShadow = "none";
      btn.style.color = "var(--yt-spec-text-primary, #f1f1f1)";
      svgWrap.innerHTML = "";
      svgWrap.appendChild(outline.cloneNode(true));
    });

    btn.addEventListener("click", ytButton_Click);
    btn.addEventListener("auxclick", (e: MouseEvent) => {
      if (e.button === 1) ytButton_Click(e);
    });

    viewModel.appendChild(btn);
    host.appendChild(viewModel);
    return host;
  }

  async function renderButton() {
    if (!isEnabled) {
      removeButton();
      return;
    }

    if (pageType !== "shorts" && pageType !== "watch") return;
    if (document.querySelector(selectors.buttonID)) return;

    const target = document.querySelector(selectors.button());
    if (!target) return;

    console.debug("[VtuberVN+] Rendering VtuberVN button in target:", target);
    removeButton();

    const container = createButton(target);

    if (pageType === "shorts") {
      target.insertBefore(container, target.firstChild);
    } else {
      const refNode = target.querySelector("yt-button-view-model, ytd-button-renderer");
      if (refNode && refNode.nextSibling) {
        target.insertBefore(container, refNode.nextSibling);
      } else {
        target.appendChild(container);
      }
    }
  }

  function startObserver() {
    if (!isEnabled) {
      removeButton();
      return;
    }
    renderButton();

    if (activeObserver) return;
    const ytdApp = document.querySelector("ytd-app") || document.body;
    if (!ytdApp) return;

    activeObserver = new MutationObserver(() => {
      if (!isEnabled) {
        removeButton();
        return;
      }
      if (!document.querySelector(selectors.buttonID)) {
        renderButton();
      }
    });

    activeObserver.observe(ytdApp, { childList: true, subtree: true });
  }

  function stopObserver() {
    if (activeObserver) {
      activeObserver.disconnect();
      activeObserver = null;
    }
    removeButton();
  }

  // Listen for option changes from Options Popup / Storage in real time
  storage.onChanged.addListener((changes, area) => {
    if (area === "local" && "vtubervnButtonInYoutube" in changes) {
      const val = Boolean(changes.vtubervnButtonInYoutube.newValue);
      isEnabled = val;
      console.log("[VtuberVN+] vtubervnButtonInYoutube changed to:", val);
      if (val) {
        startObserver();
      } else {
        stopObserver();
      }
    }
  });

  document.addEventListener("yt-navigate-finish", (evt: any) => {
    console.debug("[VtuberVN+] yt-navigate-finish event.detail:", evt.detail);
    if (evt.detail?.response?.url) {
      pageUrl = "https://www.youtube.com" + evt.detail.response.url;
    } else {
      pageUrl = window.location.href;
    }
    pageType = evt.detail?.pageType || (window.location.pathname.startsWith("/shorts") ? "shorts" : "watch");

    if (isEnabled) {
      setTimeout(renderButton, 300);
      setTimeout(renderButton, 1200);
    }
  });

  if (isEnabled) {
    startObserver();
    setTimeout(renderButton, 500);
  }
})();
