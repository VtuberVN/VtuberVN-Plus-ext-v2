let fastHideTimer: ReturnType<typeof setTimeout> | null = null;
const FAST_HIDE_DELAY = 800; // ms

function forceHideUI() {
  // Desktop layout
  const player = document.querySelector(".html5-video-player");
  if (player) {
    player.classList.add("ytp-autohide");
  }

  // Mobile/Embed layout (ytm / ytw)
  const overlay = document.querySelector("#player-control-overlay");
  if (overlay) {
    overlay.classList.remove("fadein");
    overlay.classList.add("fadeout");

    const progressBar = document.querySelector("yt-progress-bar");
    if (progressBar) {
      (progressBar as HTMLElement).style.opacity = "0";
      (progressBar as HTMLElement).style.transition =
        "opacity 0.5s ease-in-out";
    }
  }
}

function resetFastHide() {
  if (fastHideTimer) clearTimeout(fastHideTimer);

  // Restore UI visibility
  const overlay = document.querySelector("#player-control-overlay");
  if (overlay) {
    overlay.classList.remove("fadeout");
    overlay.classList.add("fadein");

    const progressBar = document.querySelector("yt-progress-bar");
    if (progressBar) {
      (progressBar as HTMLElement).style.opacity = "1";
    }
  }

  const video = document.querySelector("video");
  // Do not auto-hide if video is paused
  if (video && !video.paused) {
    fastHideTimer = setTimeout(forceHideUI, FAST_HIDE_DELAY);
  }
}

export function initFastHideUI(): void {
  // Listen on document capturing phase to catch pointer events early
  document.addEventListener(
    "mousemove",
    (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && typeof target.closest === "function") {
        // If cursor is over playback controls (progress bar, buttons) -> do not hide
        if (
          target.closest(
            ".ytp-chrome-bottom, .ytp-chrome-top, player-top-controls, player-middle-controls, player-bottom-controls, yt-progress-bar, .player-controls-bottom, .player-controls-top",
          )
        ) {
          if (fastHideTimer) clearTimeout(fastHideTimer);

          const overlay = document.querySelector("#player-control-overlay");
          if (overlay) {
            overlay.classList.remove("fadeout");
            overlay.classList.add("fadein");
            const progressBar = document.querySelector("yt-progress-bar");
            if (progressBar) {
              (progressBar as HTMLElement).style.opacity = "1";
            }
          }
          return;
        }
      }

      // If mouse moves in video viewport, reset fast-hide timer (800ms)
      resetFastHide();
    },
    { capture: true, passive: true },
  );

  document.addEventListener(
    "mouseleave",
    () => {
      if (fastHideTimer) clearTimeout(fastHideTimer);
      const video = document.querySelector("video");
      if (video && !video.paused) {
        // Mouse leaves iframe -> hide immediately after 150ms
        fastHideTimer = setTimeout(forceHideUI, 150);
      }
    },
    { capture: true, passive: true },
  );

  document.addEventListener("play", resetFastHide, { capture: true });
  document.addEventListener("playing", resetFastHide, { capture: true });
  document.addEventListener("pause", resetFastHide, { capture: true });
}
