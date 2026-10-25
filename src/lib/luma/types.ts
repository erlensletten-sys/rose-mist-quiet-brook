export type Access = "free" | "subscriber" | "unlock";
export type MediaKind = "image" | "video";
export type Safety = "clear" | "limited" | "held";
export type MessagesMode = "open" | "subscribers";
export type PayKind = "subscription" | "unlock" | "tip";

export type Person = {
  userId: string;
  handle: string;
  displayName: string;
  bio: string;
  pronouns: string;
  identities: string[];
  interests: string[];
  avatarUrl: string;
  bannerUrl: string;
  city: string;
  isCreator: boolean;
  isLive: boolean;
  liveViewers: number;
  subscriptionCents: number;
  promoteOk: boolean;
  messagesMode: MessagesMode;
  boundaries: string;
  verificationStatus: "none" | "submitted" | "approved";
};

export type Me = Person & {
  ageOk: boolean;
  tuned: boolean;
  birthYear: number | null;
};

export type Post = {
  id: string;
  authorId: string;
  caption: string;
  warning: string;
  kind: MediaKind;
  access: Access;
  priceCents: number;
  mediaUrl: string | null;
  previewUrl: string;
  posterUrl: string;
  locked: boolean;
  promoteOk: boolean;
  safety: Safety;
  likeCount: number;
  tipCents: number;
  rankPenalty: boolean;
  durationLabel: string;
  tags: string[];
  publishedAt: string;
  scheduled: boolean;
  liked: boolean;
  commentCount: number;
};

export type Comment = {
  id: string;
  postId: string;
  userId: string;
  body: string;
  createdAt: string;
};

export type Note = {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string;
};

export type Msg = {
  id: string;
  threadId: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: string;
};

export type LiveLine = {
  id: string;
  roomId: string;
  userId: string;
  body: string;
  createdAt: string;
};

export type ReportRow = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  detail: string;
  status: string;
  createdAt: string;
};

export type LedgerRow = {
  id: string;
  userId: string;
  creatorId: string;
  kind: string;
  amountCents: number;
  ref: string;
  memo: string;
  createdAt: string;
};

export type CirclePayload = {
  me: Me;
  people: Person[];
  posts: Post[];
  comments: Comment[];
  follows: string[];
  subscriptions: string[];
  unlocks: string[];
  notifications: Note[];
  messages: Msg[];
  live: LiveLine[];
  reports: ReportRow[];
  ledger: LedgerRow[];
  blocks: string[];
  mutes: string[];
};

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export type PayRequest = {
  kind: PayKind;
  creatorId: string;
  postId?: string;
  title: string;
  amountCents?: number;
};

export const INTERESTS = [
  "Fashion",
  "Voice",
  "Illustration",
  "Fitness",
  "Music",
  "Makeup",
  "Food",
  "Outdoors",
  "Dance",
  "Poetry",
] as const;

export const IDENTITIES = [
  "Trans woman",
  "Trans man",
  "Trans femme",
  "Trans masc",
  "Nonbinary",
  "Genderfluid",
  "Agender",
  "Woman",
  "Man",
  "Pan",
  "Queer",
] as const;

export const REPORT_REASONS = [
  "Harassment",
  "Spam or scam",
  "Non-consensual content",
  "Someone may be under 18",
  "Hate or a threat",
  "Other",
] as const;
