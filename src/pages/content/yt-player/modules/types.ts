export interface YtLikeData {
  apiKey: string;
  context: {
    client: {
      visitorData: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  ytClientName: string;
  ytClientVersion: string;
  pageId?: string;
  likeParams?: string;
  removeLikeParams?: string;
  PAPISID: string;
  likeStatus?: string;
  resumeTime?: number;
  isSubscribed?: boolean;
}

export interface EmojiItem {
  shortcut: string;
  src: string;
  alt: string;
  isCustom: boolean;
}

export interface EmojiCategory {
  category: string;
  categoryImage: string;
  emojis: EmojiItem[];
}

export interface SponsorBadgeRenderer {
  customBadge?: {
    image?: {
      thumbnails?: Array<{ url: string }>;
    };
  };
  image?: {
    thumbnails?: Array<{ url: string }>;
  };
  tooltip?: string;
  iconTooltip?: string;
}
