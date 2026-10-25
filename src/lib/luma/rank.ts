import type { CirclePayload, Me, Person, Post } from "@/lib/luma/types";

export type FeedTab = "discover" | "foryou" | "following";

function overlap(a: string[], b: string[]): number {
  const set = new Set(a.map((item) => item.toLowerCase()));
  return b.reduce((n, item) => n + (set.has(item.toLowerCase()) ? 1 : 0), 0);
}

function recency(iso: string): number {
  const hours = Math.max(1, (Date.now() - new Date(iso).getTime()) / 36e5);
  return 1 / Math.pow(hours, 0.38);
}

function engagement(post: Post): number {
  return Math.log1p(post.likeCount + post.commentCount * 2 + post.tipCents / 100);
}

export function scorePost(
  tab: FeedTab,
  post: Post,
  me: Me,
  creator: Person | undefined,
  followed: boolean,
): number {
  if (!creator) return -1;
  if (post.scheduled || post.safety === "held") return -1;
  const safety = post.safety === "limited" ? 0.42 : 1;
  const penalty = post.rankPenalty ? 0.25 : 1;
  const video = post.kind === "video" ? 1.12 : 1;
  const interest = 1 + overlap(me.interests, [...creator.interests, ...post.tags]) * 0.28;
  const base = (1.4 + engagement(post)) * recency(post.publishedAt) * safety * penalty * video;

  if (tab === "discover") {
    if (!post.promoteOk || !creator.promoteOk) return -1;
    if (post.access !== "free" && !post.previewUrl) return -1;
    return base * interest;
  }

  const followBoost = followed ? 1.35 : 1;
  return base * (1 + overlap(me.interests, [...creator.interests, ...post.tags]) * 0.45) * followBoost;
}

export function postsForTab(tab: FeedTab, data: CirclePayload): Post[] {
  const blocked = new Set(data.blocks);
  const muted = new Set(data.mutes);
  const followed = new Set([...data.follows, ...data.subscriptions]);
  const people = new Map(data.people.map((person) => [person.userId, person]));
  people.set(data.me.userId, data.me);

  const visible = data.posts.filter(
    (post) =>
      !post.scheduled &&
      post.safety !== "held" &&
      !blocked.has(post.authorId) &&
      !muted.has(post.authorId),
  );

  if (tab === "following") {
    return visible
      .filter((post) => followed.has(post.authorId))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  }

  return visible
    .map((post) => ({
      post,
      score: scorePost(tab, post, data.me, people.get(post.authorId), followed.has(post.authorId)),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.post);
}
