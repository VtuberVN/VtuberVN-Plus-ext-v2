import { storage } from "webextension-polyfill";

// To add something to options, just add it to `schema`
const schema = {
  // key: default-value
  vtubervnButtonInYoutube: true,
  visualizerMaxFps: 60,
  enableCrowdsourcing: false,
};
export type Schema = typeof schema;

type TranslationSchema = {
  title: string;
  subtitle: string;
  vtubervnButtonInYoutube: { name: string; description: string };
  visualizerMaxFps: { name: string; description: string };
  enableCrowdsourcing: { name: string; description: string };
  ytPlayer: Record<string, string>;
  popup: Record<string, string>;
};

export type Locale = "vi" | "en";

export const translations: Record<Locale, TranslationSchema> = {
  vi: {
    title: "VtuberVN Star",
    subtitle: "Tùy chỉnh tiện ích",
    vtubervnButtonInYoutube: {
      name: "Nút VtuberVN trên YouTube",
      description:
        "Thêm nút 'Xem trên VtuberVN' bên dưới video YouTube để truy cập nhanh",
    },
    visualizerMaxFps: {
      name: "FPS sóng nhạc",
      description: "Cài đặt giới hạn FPS sóng nhạc (10 - 60)",
    },
    enableCrowdsourcing: {
      name: "Đóng góp dữ liệu",
      description:
        "Bật tính năng này sẽ kích hoạt chức năng đóng góp dữ liệu cho VtuberVN. Extension sẽ lấy số View, CCV, Like thực tế của video / Livestream đang xem và gửi về hệ thống VtuberVN để hiển thị cho video / livestream tương ứng.",
    },
    ytPlayer: {
      newMember: "Mới tham gia",
      videoLiked: "Đã thích video!",
      videoLikeFailed: "Thích video thất bại.",
      errorGettingYtLikeData:
        "[VtuberVN Star] Không lấy được ytLikeData (chưa đăng nhập?)",
      errorSendingLike: "[VtuberVN Star] Lỗi khi thực hiện thích video.",
      errorSubscribing: "[VtuberVN Star] Lỗi khi thực hiện đăng ký kênh.",
      errorUnsubscribing: "[VtuberVN Star] Lỗi khi thực hiện hủy đăng ký kênh.",
      errorReplyingComment: "[VtuberVN Star] Lỗi khi phản hồi bình luận.",
      errorFetchingComments: "[VtuberVN Star] Lỗi khi tải bình luận.",
      errorPostingComment: "[VtuberVN Star] Lỗi khi đăng bình luận.",
      errorEditingComment: "[VtuberVN Star] Lỗi khi chỉnh sửa bình luận.",
      errorLikingComment: "[VtuberVN Star] Lỗi khi thích bình luận.",
      errorHeartingComment: "[VtuberVN Star] Lỗi khi thả tim bình luận.",
      errorDeletingComment: "[VtuberVN Star] Lỗi khi xóa bình luận.",
      errorFlaggingComment: "[VtuberVN Star] Lỗi khi báo cáo bình luận.",
      errorBlockingUser: "[VtuberVN Star] Lỗi khi ẩn người dùng khỏi kênh.",
      errorPinningComment: "[VtuberVN Star] Lỗi khi ghim bình luận.",
      errorUnpinningComment: "[VtuberVN Star] Lỗi khi bỏ ghim bình luận.",
      errorDeletingChatMessage: "[VtuberVN Star] Lỗi khi xóa tin nhắn chat.",
      errorTimingOutUser: "[VtuberVN Star] Lỗi khi tạm ẩn người dùng chat.",
      errorBanningUser: "[VtuberVN Star] Lỗi khi cấm người dùng chat.",
      errorSyncingHistory: "[VtuberVN Star] Lỗi khi đồng bộ lịch sử xem.",
      errorDetectingRole: "[VtuberVN Star] Lỗi khi nhận diện vai trò người dùng.",
    },
    popup: {
      nowPlaying: "Đang xem:",
      openOnVtuberVN: "Mở trên VtuberVN",
      liveNow: "Live now:",
      channels: "kênh",
      settings: "Cài đặt",
      noLive: "Không có kênh nào đang Live",
      loading: "Đang tải...",
      watchMusic: "Nghe nhạc",
    }
  },
  en: {
    title: "VtuberVN Star",
    subtitle: "Extension Options",
    vtubervnButtonInYoutube: {
      name: "VtuberVN Button on YouTube",
      description:
        "Adds a 'Watch on VtuberVN' button below YouTube videos for quick access",
    },
    visualizerMaxFps: {
      name: "Visualizer FPS",
      description: "Set the FPS limit for the audio visualizer (10 - 60)",
    },
    enableCrowdsourcing: {
      name: "Data Crowdsourcing",
      description:
        "Enabling this feature will activate the data contribution function for VtuberVN. The extension will retrieve the actual number of views, CCV, and likes of the video/livestream being watched and send them to the VtuberVN system to display for the corresponding video/livestream.",
    },
    ytPlayer: {
      newMember: "New Member",
      videoLiked: "Video liked!",
      videoLikeFailed: "Failed to like the video.",
      errorGettingYtLikeData:
        "[VtuberVN Star] Error getting ytLikeData (not logged in?)",
      errorSendingLike: "[VtuberVN Star] Error while sending video like.",
      errorSubscribing: "[VtuberVN Star] Error subscribing.",
      errorUnsubscribing: "[VtuberVN Star] Error unsubscribing.",
      errorReplyingComment: "[VtuberVN Star] Error replying to comment.",
      errorFetchingComments: "[VtuberVN Star] Error fetching comments.",
      errorPostingComment: "[VtuberVN Star] Error posting comment.",
      errorEditingComment: "[VtuberVN Star] Error editing comment.",
      errorLikingComment: "[VtuberVN Star] Error liking comment.",
      errorHeartingComment: "[VtuberVN Star] Error hearting comment.",
      errorDeletingComment: "[VtuberVN Star] Error deleting comment.",
      errorFlaggingComment: "[VtuberVN Star] Error flagging comment.",
      errorBlockingUser: "[VtuberVN Star] Error blocking user.",
      errorPinningComment: "[VtuberVN Star] Error pinning comment.",
      errorUnpinningComment: "[VtuberVN Star] Error unpinning comment.",
      errorDeletingChatMessage: "[VtuberVN Star] Error deleting chat message.",
      errorTimingOutUser: "[VtuberVN Star] Error timing out user.",
      errorBanningUser: "[VtuberVN Star] Error banning user.",
      errorSyncingHistory: "[VtuberVN Star] Error syncing watch history.",
      errorDetectingRole: "[VtuberVN Star] Error detecting user role.",
    },
    popup: {
      nowPlaying: "Now playing:",
      openOnVtuberVN: "Open on VtuberVN",
      liveNow: "Live now:",
      channels: "channels",
      settings: "Settings",
      noLive: "No channels currently live",
      loading: "Loading...",
      watchMusic: "Music",
    }
  },
};


export const Options = {
  /** Get the options storage schema */
  schema(): Schema {
    return { ...schema };
  },

  /** Get an option's description */
  name<K extends keyof Schema>(key: K, locale: Locale = "vi"): string | null {
    const translation = translations[locale][key as keyof Pick<TranslationSchema, keyof Schema>];
    return (translation as { name?: string })?.name ?? null;
  },

  /** Get an option's description */
  description<K extends keyof Schema>(
    key: K,
    locale: Locale = "vi",
  ): string | null {
    const translation = translations[locale][key as keyof Pick<TranslationSchema, keyof Schema>];
    return (translation as { description?: string })?.description ?? null;
  },

  /** Get an option */
  async get<K extends keyof Schema>(key: K): Promise<Schema[K] | null> {
    const result = await storage.local.get(key);
    return key in result ? result[key] : schema[key];
  },

  /** Set an option */
  async set<K extends keyof Schema>(key: K, value: Schema[K]): Promise<void> {
    await storage.local.set({ [key]: value });
  },
} as const;
