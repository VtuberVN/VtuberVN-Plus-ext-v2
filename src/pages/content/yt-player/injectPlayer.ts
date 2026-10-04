import { ClientType, Innertube, UniversalCache } from "youtubei.js";
import { ProtoframeDescriptor, ProtoframePubsub } from "protoframe";
import type Format from "youtubei.js/dist/src/parser/classes/misc/Format";

if (!import.meta.env.DEV) {
  const _log = console.log;
  console.log = (
    ...args: Array<string | number | boolean | object | null | undefined>
  ) => {
    if (
      args.length > 0 &&
      typeof args[0] === "string" &&
      args[0].includes("[VtuberVN")
    ) {
      return;
    }
    _log(...args);
  };
}

// Fix YouTube player non-passive event listener warnings in console
try {
  const originalAdd = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (
    this: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ) {
    let opt: boolean | AddEventListenerOptions | undefined = options;
    if (
      type === "touchstart" ||
      type === "touchmove" ||
      type === "wheel" ||
      type === "mousewheel"
    ) {
      if (typeof opt === "boolean") {
        opt = { capture: opt, passive: true };
      } else if (typeof opt === "object" && opt !== null) {
        if (opt.passive === undefined) {
          opt = { ...opt, passive: true };
        }
      } else {
        opt = { passive: true };
      }
    }
    return originalAdd.call(this, type, listener, opt);
  };
} catch (e) {
  void e;
}

if (import.meta.env.DEV) {
  console.log("[VtuberVN+]", "Initializing");
}

interface YTFFormat extends Format {}

const ytAudioDLProtocol: ProtoframeDescriptor<{
  fetchAudio: {
    body: { videoId?: string };
    response: { state: "ok" | "failed"; msg: string; format?: YTFFormat };
  };
  progress: {
    body: { percentage: number; total: number };
  };
  fetchAudioComplete: {
    body: { audio: Uint8Array; format: YTFFormat };
  };
}> = { type: "audio_dl" };

function b64ToU8(base64: string) {
  const str = atob(base64);
  const len = str.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes;
}

function u8ToB64(u8: Uint8Array, urlSafe = false) {
  const buf = String.fromCharCode(...u8);
  const base64 = btoa(buf);
  return urlSafe ? base64.replace(/\//g, "_").replace(/\+/g, "-") : base64;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- legacy cipher: Raw input can be a string or a custom obfuscated array structure from YouTube.
function computeHash(input: string | any[], start = 0, end = input.length) {
  let hash = 0;
  for (let i = start; i < end; i++) {
    const code = typeof input === "string" ? input.charCodeAt(i) : input[i];
    hash = (Math.imul(31, hash) + code) | 0;
  }
  return hash;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- legacy cipher: Key material input can be an obfuscated array structure representing visitors data.
function generateKeyPair(keyMaterial: string | any[]) {
  const mid = keyMaterial.length >> 1;
  return [computeHash(keyMaterial, 0, mid), computeHash(keyMaterial, mid)];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- legacy cipher: Key material input is decoded as an obfuscated array structure.
function transformData(data: Uint8Array, keyMaterial: string | any[]) {
  const [key1, key2] = generateKeyPair(keyMaterial);
  const data32 = new Uint32Array(data.buffer);
  const firstWord = data32[0];

  for (let i = 1; i < data32.length; i += 2) {
    let a = firstWord;
    let b = i;
    let c = key1;
    let d = key2;

    for (let round = 0; round < 22; round++) {
      b = ((b >>> 8) | (b << 24)) + a;
      b ^= c + 38293;
      a = ((a << 3) | (a >>> 29)) ^ b;

      d = ((d >>> 8) | (d << 24)) + c;
      d ^= round + 38293;
      c = ((c << 3) | (c >>> 29)) ^ d;
    }

    data32[i] ^= a;
    if (i + 1 < data32.length) {
      data32[i + 1] ^= b;
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- legacy cipher: YouTube visitor identifier structure varies and is parsed as any array.
function decodeCachedPoToken(
  identifier: string | any[],
  encodedPoToken: string | null,
) {
  const data = b64ToU8(
    typeof encodedPoToken === "string" ? encodedPoToken : "",
  );
  transformData(data, identifier);

  let index = 4;
  while (index < 7 && data[index] === 0) index++;

  // Not sure if these ever change, they're hardcoded in the original code. It's obviously for some kind of validation.
  const VALIDATION_BYTES = [196, 200, 224, 18];

  for (let i = 0; i < VALIDATION_BYTES.length; i++) {
    if (data[index++] !== VALIDATION_BYTES[i])
      throw new Error("Validation failed");
  }

  const timestamp = new DataView(data.buffer).getUint32(index);
  index += 4;

  const poToken = u8ToB64(new Uint8Array(data.buffer, index), true);

  return {
    expires: new Date(timestamp * 1000),
    poToken,
  };
}

const manager = ProtoframePubsub.iframe(ytAudioDLProtocol);

manager.handleAsk(
  "fetchAudio",
  async (
    body,
  ): Promise<{ state: "ok" | "failed"; msg: string; format?: YTFFormat }> => {
    if (!body.videoId) {
      console.error("[VtuberVN+] No video ID");
      return Promise.resolve({
        state: "failed",
        msg: "No Video ID provided",
        format: undefined,
      });
    }
    try {
      // access sessionstorage
      const ytGlobal = (
        window as Window & {
          yt?: { config_?: Record<string, string | undefined> };
        }
      ).yt;
      const visitorData =
        ytGlobal?.config_?.["DATASYNC_ID"] ||
        ytGlobal?.config_?.["VISITOR_DATA"];
      const potKey = window.sessionStorage.getItem("iU5q-!O9@$");
      console.log(potKey);
      const potValue = window.sessionStorage.getItem(
        (potKey ?? "_").split(",")[1],
      );

      // The first value should be either the user's visitor data or their datasync id (if they're logged in).
      console.log(visitorData, potValue);
      const potToken = decodeCachedPoToken(visitorData || "", potValue);
      console.log(potToken);

      const innertube = await Innertube.create({
        cache: new UniversalCache(false),
        generate_session_locally: false,
        visitor_data: visitorData,
        po_token: potToken.poToken,
        client_type: ClientType.WEB_EMBEDDED,
        fetch: async (url, options) => {
          console.log(`Fetching: ${url}, options: ${JSON.stringify(options)}`);
          let response = await window.fetch(url, {
            ...options,
            // redirect: "manual",
          });

          // Handle manual redirect
          if (response.status === 301 || response.status === 302) {
            const redirectedUrl = response.headers.get("Location");
            if (redirectedUrl) {
              console.log(`Redirected to: ${redirectedUrl}`);
              // Make a new request to the redirected URL, including headers if needed
              response = await window.fetch(redirectedUrl, {
                ...options,
                headers: {
                  ...options?.headers,
                  // Set any additional headers needed for the redirected request
                  Origin: location.origin,
                },
              });
            }
          }

          return response;
        },
      });

      const info = await innertube.getInfo(body.videoId, "WEB");
      console.log(info);
      const format = info.chooseFormat({
        type: "audio", // audio, video or video+audio
        quality: "bestefficiency", // best, bestefficiency, 144p, 240p, 480p, 720p and so on.
        format: "opus", // media container format
      });
      const totalBytes = format.content_length || -1;

      return await new Promise((resolve) => {
        info
          .download({
            // client: "WEB",
            type: "audio", // audio, video or video+audio
            quality: "bestefficiency", // best, bestefficiency, 144p, 240p, 480p, 720p and so on.
            format: "opus", // media container format
          })
          .then(
            async (rstream) => {
              resolve({ state: "ok", msg: "in progress...", format: format });
              const chunks: Uint8Array[] = [];
              let downloadedBytes = 0;

              const reader = rstream.getReader();
              let isDone = false;
              while (!isDone) {
                const x = await reader.read();

                if (x.done) {
                  isDone = true;
                  break;
                }

                chunks.push(x.value);
                downloadedBytes += x.value.length;
                if (totalBytes < 0) {
                  manager.tell("progress", {
                    percentage: -1,
                    total: downloadedBytes,
                  });
                } else {
                  const progress = Math.round(
                    (downloadedBytes / totalBytes) * 100,
                  );
                  manager.tell("progress", {
                    percentage: progress * 0.95,
                    total: totalBytes,
                  });
                }
              }
              const result = new Uint8Array(downloadedBytes);
              let offset = 0;

              for (const chunk of chunks) {
                result.set(chunk, offset);
                offset += chunk.length;
              }
              manager.tell("progress", { percentage: 100, total: totalBytes });
              manager.tell("fetchAudioComplete", {
                audio: result,
                format: format,
              });
            },
            (reason) => {
              resolve({
                state: "failed",
                msg: "Error occured: " + String(reason || "???"),
                format: undefined,
              });
            },
          );
      });
    } catch (e) {
      console.error(e);
      console.error("Failed to download from Youtube...?");
      return {
        state: "failed",
        msg: "Error occured: " + String(e || "???"),
        format: undefined,
      };
    }
  },
);
