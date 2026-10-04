declare module "*.json" {
  const content: string;
  export default content;
}

import type { ProtocolWithReturn } from "webext-bridge";

declare module "webext-bridge" {
  export interface ProtocolMap {
    requestScriptInjection: { scriptType: "YT_CHAT_INJECT" | "YT_PLAYER_INJECT" | "YT_WATCH_INJECT" | "TLSYNC_INJECT" };
    bar: ProtocolWithReturn<CustomDataType, CustomReturnType>;
  }
}

