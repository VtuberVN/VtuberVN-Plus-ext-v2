/**
 * [VtuberVN+] Audio Capture & Visualizer Bridge
 *
 * Runs inside YouTube embed iframe (injected into page context).
 * Does not start automatically — only captures when receiving
 * VTUBERVN_AUDIO_CAPTURE_START message from the main application.
 *
 * Each instance maintains its own sessionId so the host application
 * can differentiate between music player iframes and live/video streams.
 *
 * Flow:
 *   Main app sends START (with sessionId) -> targeted music iframe receives
 *   -> captureStream() + AnalyserNode -> emits FFT data with sessionId
 *   -> Main app filters by sessionId -> renders visualizer canvas
 */

console.log('[VtuberVN+] Audio Capture: Loaded (standby mode)');

const FFT_SIZE = 512;          // 256 frequency bins — balanced and smooth for visualizer
const DEFAULT_ACTIVE_FPS = 60; // Default active visualizer frame rate
let activeFps = DEFAULT_ACTIVE_FPS; // Configurable FPS limit from settings
const BACKGROUND_FPS = 5;      // When tab/window is hidden or minimized (CPU saving)
const HEARTBEAT_INTERVAL = 5000; // Send heartbeat ping every 5 seconds

// Viewport visibility state to apply adaptive FPS throttling based on document visibility
let isDocumentVisible = document.visibilityState === 'visible';

document.addEventListener('visibilitychange', () => {
  isDocumentVisible = document.visibilityState === 'visible';
});

function getIsVisible() {
  return isDocumentVisible;
}

let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let captureLoopTimer: ReturnType<typeof setTimeout> | null = null;
let animationFrameId: number | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let lastFrameTime = 0;
let isCapturing = false;
let currentSessionId: string | null = null;
let capturedVideo: HTMLVideoElement | null = null;

interface CustomWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

const userGestures = ['click', 'mousedown', 'keydown', 'touchstart'];

const resumeOnGesture = () => {
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume().then(() => {
      console.log('[VtuberVN+] Audio Capture: AudioContext resumed via user gesture');
      removeGestureListeners();
    }).catch((err) => {
      console.warn('[VtuberVN+] Audio Capture: Resume failed via user gesture -', err);
    });
  } else if (audioContext && audioContext.state === 'running') {
    removeGestureListeners();
  }
};

const removeGestureListeners = () => {
  userGestures.forEach(gesture => {
    document.removeEventListener(gesture, resumeOnGesture);
  });
};

const addGestureListeners = () => {
  userGestures.forEach(gesture => {
    document.addEventListener(gesture, resumeOnGesture, { passive: true });
  });
};

/**
 * Locate <video> element inside YouTube embed player.
 */
function findVideoElement(): HTMLVideoElement | null {
  const video = document.querySelector('video.html5-main-video') as HTMLVideoElement | null;
  if (video) return video;
  return document.querySelector('video') as HTMLVideoElement | null;
}

/**
 * Configure AudioContext + AnalyserNode from video element.
 * Guard: if sourceNode already exists for this video -> reuse, do not recreate.
 * createMediaElementSource() must only be called once per video element.
 */
function setupAudioCapture(video: HTMLVideoElement): boolean {
  // Already configured for this video element and nodes are alive -> reuse
  if (capturedVideo === video && audioContext && analyser && sourceNode) {
    isCapturing = true;
    return true;
  }

  try {
    // Create AudioContext if not initialized or previously closed
    if (!audioContext || audioContext.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as CustomWindow).webkitAudioContext;
      if (!AudioCtx) {
        throw new Error('AudioContext is not supported in this browser');
      }
      audioContext = new AudioCtx();
    }

    if (!analyser) {
      analyser = audioContext.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.8;
    }

    // Only create new sourceNode when video changes or not yet initialized
    // Avoid calling createMediaElementSource twice on same video -> InvalidStateError
    if (capturedVideo !== video || !sourceNode) {
      if (sourceNode) {
        try { sourceNode.disconnect(); } catch (_) {}
        sourceNode = null;
      }
      sourceNode = audioContext.createMediaElementSource(video);
      sourceNode.connect(analyser);
      analyser.connect(audioContext.destination);
      capturedVideo = video;

      // Automatically resume AudioContext when video plays
      const resumeContext = () => {
        if (audioContext && audioContext.state === 'suspended') {
          audioContext.resume().then(() => {
            console.log('[VtuberVN+] Audio Capture: AudioContext resumed via video event');
            removeGestureListeners();
          }).catch((err) => {
            console.warn('[VtuberVN+] Audio Capture: Resume failed via video event -', err);
            // If resume via autoplay fails, listen for user gestures
            addGestureListeners();
          });
        }
      };

      video.addEventListener('play', resumeContext);
      video.addEventListener('playing', resumeContext);
      video.addEventListener('timeupdate', resumeContext, { once: true });
    }

    isCapturing = true;
    console.log('[VtuberVN+] Audio Capture: Attached to video element', video);
    return true;
  } catch (err) {
    console.warn('[VtuberVN+] Audio Capture: Setup failed -', err);
    // DO NOT invoke cleanup() here — reset isCapturing flag only
    isCapturing = false;
    return false;
  }
}

/**
 * Dispatch frequency data loop to parent window.
 * Adaptive FPS based on tab visibility state:
 * - Always use setTimeout instead of requestAnimationFrame because hidden iframes
 *   (set to visibility: hidden) may have rAF throttled or paused by the browser.
 * - Runs at ACTIVE_FPS (60 FPS) when tab is visible, or BACKGROUND_FPS (5 FPS) when tab is hidden.
 * Each message includes sessionId for client-side stream routing.
 */
function sendAudioData() {
  if (captureLoopTimer !== null) {
    clearTimeout(captureLoopTimer);
    captureLoopTimer = null;
  }
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  const visible = getIsVisible();
  const currentFps = visible ? activeFps : BACKGROUND_FPS;
  const frameInterval = 1000 / currentFps;

  // Always use setTimeout to prevent rAF pause in hidden iframes
  captureLoopTimer = setTimeout(sendAudioData, frameInterval);

  const timestamp = performance.now();
  if (timestamp - lastFrameTime < frameInterval - 5) return;
  lastFrameTime = timestamp;

  // Periodically verify if video element was replaced by YouTube DOM re-render
  const currentVideo = findVideoElement();
  if (currentVideo && currentVideo !== capturedVideo) {
    console.log('[VtuberVN+] Audio Capture: Video element replaced, re-attaching...');
    setupAudioCapture(currentVideo);
  }

  if (!analyser || !audioContext || !currentSessionId) return;

  if (audioContext.state === 'suspended') {
    // Do not aggressively resume in loop to avoid autoplay policy console warnings.
    // AudioContext is resumed via video play events or user gesture listeners.
    return;
  }

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteFrequencyData(dataArray);

  try {
    window.parent.postMessage({
      type: 'VTUBERVN_AUDIO_DATA',
      sessionId: currentSessionId,
      frequencyData: Array.from(dataArray),
      bufferLength,
    }, '*');
  } catch (_) {
    // Cross-origin — ignore
  }
}

function startCapture(sessionId: string) {
  // Skip if same session is already active
  if (captureLoopTimer !== null && currentSessionId === sessionId) return;

  // Stop previous loop & heartbeat while keeping AudioContext/sourceNode intact
  if (captureLoopTimer !== null) {
    clearTimeout(captureLoopTimer);
    captureLoopTimer = null;
  }
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  currentSessionId = sessionId;
  lastFrameTime = 0;

  // Resume AudioContext if suspended (track change / autoplay policy)
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }

  const video = findVideoElement();
  if (!video) {
    console.warn('[VtuberVN+] Audio Capture: No video element found');
    waitForVideoThenStart(sessionId);
    return;
  }

  // setupAudioCapture checks isCapturing -> returns true if already configured
  if (setupAudioCapture(video)) {
    sendAudioData();
    startHeartbeat(sessionId);
    console.log(`[VtuberVN+] Audio Capture: ${isCapturing ? 'Restarted' : 'Started'} (session: ${sessionId})`);

    try {
      window.parent.postMessage({
        type: 'VTUBERVN_AUDIO_CAPTURE_ACK',
        sessionId,
        status: 'started',
      }, '*');
    } catch (_) {}
  }
}

function startHeartbeat(sessionId: string) {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    if (currentSessionId !== sessionId) {
      clearInterval(heartbeatTimer!);
      heartbeatTimer = null;
      return;
    }
    try {
      window.parent.postMessage({
        type: 'VTUBERVN_AUDIO_CAPTURE_HEARTBEAT',
        sessionId,
      }, '*');
    } catch (_) {}
  }, HEARTBEAT_INTERVAL);
}

function waitForVideoThenStart(sessionId: string) {
  const observer = new MutationObserver((_mutations, obs) => {
    const v = findVideoElement();
    if (v) {
      obs.disconnect();
      const handleReady = () => {
        if (currentSessionId === sessionId) {
          if (setupAudioCapture(v)) {
            sendAudioData();
            console.log(`[VtuberVN+] Audio Capture: Started (delayed, session: ${sessionId})`);
            try {
              window.parent.postMessage({
                type: 'VTUBERVN_AUDIO_CAPTURE_ACK',
                sessionId,
                status: 'started',
              }, '*');
            } catch (_) {}
          }
        }
      };

      if (!v.paused && v.readyState >= 2) {
        handleReady();
      } else {
        v.addEventListener('playing', handleReady, { once: true });
      }
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 30000);
}

/**
 * Stop capture loop and heartbeat — PRESERVES AudioContext and sourceNode.
 * Called when user toggles off visualizer, or on STOP message.
 * When toggled back on, AudioContext + sourceNode are REUSED without recreation.
 */
function stopCapture() {
  if (captureLoopTimer !== null) {
    clearTimeout(captureLoopTimer);
    captureLoopTimer = null;
  }
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  currentSessionId = null;
  // DO NOT reset isCapturing — AudioContext + sourceNode remain alive
  // Prevents InvalidStateError on subsequent toggle
}

function cleanup() {
  stopCapture();
  removeGestureListeners();
  if (sourceNode) {
    try { sourceNode.disconnect(); } catch (_) {}
    sourceNode = null;
  }
  if (analyser) {
    try { analyser.disconnect(); } catch (_) {}
    analyser = null;
  }
  if (audioContext) {
    try { audioContext.close(); } catch (_) {}
    audioContext = null;
  }
  isCapturing = false;
  capturedVideo = null;
}

/**
 * Listen for START/STOP commands from host application.
 * STOP pauses loop — DOES NOT close AudioContext.
 * cleanup() (closing AudioContext) only occurs on beforeunload.
 */
window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin && event.origin !== 'https://www.youtube.com') return;

  if (event.data?.type === 'VTUBERVN_AUDIO_CAPTURE_START' && event.data?.sessionId) {
    if (typeof event.data?.maxFps === 'number') {
      activeFps = Math.max(10, Math.min(60, event.data.maxFps));
    }
    startCapture(event.data.sessionId);
  } else if (event.data?.type === 'VTUBERVN_AUDIO_CONFIG') {
    if (typeof event.data?.maxFps === 'number') {
      activeFps = Math.max(10, Math.min(60, event.data.maxFps));
      console.log(`[VtuberVN+] Audio Capture: Active FPS limit updated to ${activeFps}`);
    }
  } else if (event.data?.type === 'VTUBERVN_AUDIO_CAPTURE_STOP') {
    stopCapture();
    console.log('[VtuberVN+] Audio Capture: Paused (AudioContext preserved for reuse)');
  }
});

window.addEventListener('beforeunload', cleanup);

