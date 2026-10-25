import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import type {
  Access,
  ActionResult,
  CirclePayload,
  Comment,
  LedgerRow,
  LiveLine,
  Me,
  MediaKind,
  MessagesMode,
  Msg,
  Note,
  Person,
  Post,
  ReportRow,
  Safety,
} from "@/lib/luma/types";

const REPLIES: Record<string, string> = {
  "seed:solene": "Got this. I will write properly after rehearsal. Thank you for being gentle.",
  "seed:juniper": "Read. I am at the desk and will answer when the ink dries.",
  "seed:mateo": "Noted. I keep messages short between sets, but I do read them.",
  "seed:amari": "Heard. I will reply when I am off the mic.",
  "seed:ren": "Received. I answer about the work, and I am glad you wrote.",
  "seed:lior": "This landed. I will write back after the pan is washed.",
  "seed:nova": "Thank you. I am in counts right now and will reply after.",
  "seed:cass": "Got it on the trail. I will write when I am back in range.",
};

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function tags(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function record(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") throw new Error("Invalid request");
  return input as Record<string, unknown>;
}

function clip(value: unknown, max: number): string {
  return text(value).trim().slice(0, max);
}

function threadKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

function slug(name: string): string {
  const raw = name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16);
  return raw.length >= 3 ? raw : "member";
}

function adultEnough(date: string): { ok: true; year: number } | { ok: false } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return { ok: false };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1920) return { ok: false };
  const now = new Date();
  let age = now.getUTCFullYear() - year;
  const currentMonth = now.getUTCMonth() + 1;
  const currentDay = now.getUTCDate();
  if (currentMonth < month || (currentMonth === month && currentDay < day)) age -= 1;
  if (age < 18 || age > 110) return { ok: false };
  return { ok: true, year };
}

function isImageData(value: string): boolean {
  return value.startsWith("data:image/") && value.length < 1_800_000;
}

function safeMedia(value: string): string {
  if (value.startsWith("/media/")) return value;
  if (value.startsWith("data:image/") && value.length < 1_800_000) return value;
  if (/^idb:[0-9a-f-]{36}$/i.test(value)) return value;
  return "";
}

type ProfileRow = {
  user_id: string;
  handle: string;
  display_name: string;
  bio: string;
  pronouns: string;
  identities: string;
  interests: string;
  avatar_url: string;
  banner_url: string;
  city: string;
  is_creator: boolean;
  is_live: boolean;
  live_viewers: number;
  subscription_cents: number;
  promote_ok: boolean;
  messages_mode: string;
  boundaries: string;
  age_ok: boolean;
  birth_year: number | null;
  verification_status: string;
  tuned: boolean;
};

function toPerson(row: ProfileRow): Person {
  const status = row.verification_status;
  return {
    userId: row.user_id,
    handle: row.handle,
    displayName: row.display_name,
    bio: row.bio,
    pronouns: row.pronouns,
    identities: tags(row.identities),
    interests: tags(row.interests),
    avatarUrl: row.avatar_url,
    bannerUrl: row.banner_url,
    city: row.city,
    isCreator: Boolean(row.is_creator),
    isLive: Boolean(row.is_live),
    liveViewers: num(row.live_viewers),
    subscriptionCents: num(row.subscription_cents),
    promoteOk: Boolean(row.promote_ok),
    messagesMode: row.messages_mode === "subscribers" ? "subscribers" : "open",
    boundaries: row.boundaries,
    verificationStatus: status === "approved" || status === "submitted" ? status : "none",
  };
}

function toMe(row: ProfileRow): Me {
  return {
    ...toPerson(row),
    ageOk: Boolean(row.age_ok),
    tuned: Boolean(row.tuned),
    birthYear: row.birth_year == null ? null : num(row.birth_year),
  };
}

const PROFILE_FIELDS = `
  user_id, handle, display_name, bio, pronouns, identities, interests,
  avatar_url, banner_url, city, is_creator, is_live, live_viewers,
  subscription_cents, promote_ok, messages_mode, boundaries, age_ok,
  birth_year, verification_status, tuned
`;

async function uniqueHandle(sql: Sql, base: string): Promise<string> {
  let handle = base;
  for (let i = 0; i < 6; i += 1) {
    const rows = await sql<{ handle: string }>`select handle from profiles where handle = ${handle}`;
    if (!rows.length) return handle;
    handle = `${base}${Math.floor(Math.random() * 900 + 100)}`.slice(0, 20);
  }
  return `${base}${Date.now().toString().slice(-4)}`.slice(0, 20);
}

async function notify(
  sql: Sql,
  userId: string,
  kind: string,
  title: string,
  body: string,
  href: string,
) {
  await sql`
    insert into notifications (id, user_id, kind, title, body, href)
    values (${crypto.randomUUID()}, ${userId}, ${kind}, ${title}, ${body}, ${href})
  `;
}

async function book(sql: Sql, userId: string, creatorId: string, ref: string, gross: number, memo: string) {
  const fee = Math.round(gross * 0.2);
  const reserve = Math.round((gross - fee) * 0.1);
  const payable = gross - fee - reserve;
  const lines: Array<[string, number]> = [
    ["authorization", gross],
    ["capture", gross],
    ["tax", 0],
    ["platform_fee", fee],
    ["reserve", reserve],
    ["creator_payable", payable],
  ];
  for (const [kind, amount] of lines) {
    await sql`
      insert into ledger (id, user_id, creator_id, kind, amount_cents, ref, memo)
      values (${crypto.randomUUID()}, ${userId}, ${creatorId}, ${kind}, ${amount}, ${ref}, ${memo})
    `;
  }
  return { fee, reserve, payable };
}

type PostRow = {
  id: string;
  author_id: string;
  caption: string;
  warning: string;
  kind: string;
  access: string;
  price_cents: number;
  media_url: string;
  preview_url: string;
  poster_url: string;
  promote_ok: boolean;
  safety: string;
  like_count: number;
  tip_cents: number;
  rank_penalty: boolean;
  duration_label: string;
  tags: string;
  published_at: string;
};

function emptyCircle(me: Me): CirclePayload {
  return {
    me,
    people: [],
    posts: [],
    comments: [],
    follows: [],
    subscriptions: [],
    unlocks: [],
    notifications: [],
    messages: [],
    live: [],
    reports: [],
    ledger: [],
    blocks: [],
    mutes: [],
  };
}

export const ensureProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ displayName: clip(record(input).displayName, 40) }))
  .handler(async ({ context, data }): Promise<ActionResult> => {
    const sql = await getSql();
    const existing = await sql<{ user_id: string }>`
      select user_id from profiles where user_id = ${context.userId}
    `;
    if (existing.length) return { ok: true };
    const displayName = data.displayName || "New member";
    const handle = await uniqueHandle(sql, slug(displayName));
    const inserted = await sql<{ user_id: string }>`
      insert into profiles (user_id, handle, display_name, bio, is_creator, age_ok, tuned)
      values (${context.userId}, ${handle}, ${displayName}, '', false, false, false)
      on conflict (user_id) do nothing
      returning user_id
    `;
    if (!inserted.length) return { ok: true };
    await notify(
      sql,
      context.userId,
      "system",
      "You are in",
      "Discover is home. For you learns what you linger on. Following is only your circle.",
      "/",
    );
    const thread = threadKey(context.userId, "seed:juniper");
    await sql`
      insert into messages (id, thread_id, sender_id, recipient_id, body)
      values (
        ${crypto.randomUUID()},
        ${thread},
        ${"seed:juniper"},
        ${context.userId},
        ${"Glad you made it in. I will keep my notes short and kind."}
      )
    `;
    await notify(
      sql,
      context.userId,
      "message",
      "New message from Juniper Hale",
      "Glad you made it in. I will keep my notes short and kind.",
      "/inbox/juniper",
    );
    return { ok: true };
  });

export const getCircle = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<CirclePayload> => {
    const sql = await getSql();
    const meRows = await sql.query<ProfileRow>(
      `select ${PROFILE_FIELDS} from profiles where user_id = $1`,
      [context.userId],
    );
    const meRow = meRows[0];
    if (!meRow) throw new Error("Profile missing");
    const me = toMe(meRow);
    if (!me.ageOk) return emptyCircle(me);

    const peopleRows = await sql.query<ProfileRow>(
      `select ${PROFILE_FIELDS} from profiles where user_id <> $1 order by display_name asc`,
      [context.userId],
    );
    const blockRows = await sql<{ target_id: string }>`
      select target_id from blocks where user_id = ${context.userId}
    `;
    const muteRows = await sql<{ target_id: string }>`
      select target_id from mutes where user_id = ${context.userId}
    `;
    const blocks = blockRows.map((row) => row.target_id);
    const blockSet = new Set(blocks);
    const followRows = await sql<{ creator_id: string }>`
      select creator_id from follows where user_id = ${context.userId}
    `;
    const subRows = await sql<{ creator_id: string }>`
      select creator_id from subscriptions where user_id = ${context.userId} and status = 'active'
    `;
    const unlockRows = await sql<{ post_id: string }>`
      select post_id from unlocks where user_id = ${context.userId}
    `;
    const likeRows = await sql<{ post_id: string }>`
      select post_id from likes where user_id = ${context.userId}
    `;
    const follows = new Set(followRows.map((row) => row.creator_id));
    const subs = new Set(subRows.map((row) => row.creator_id));
    const unlocks = new Set(unlockRows.map((row) => row.post_id));
    const likes = new Set(likeRows.map((row) => row.post_id));

    const postRows = await sql<{
      id: string;
      author_id: string;
      caption: string;
      warning: string;
      kind: string;
      access: string;
      price_cents: number;
      media_url: string;
      preview_url: string;
      poster_url: string;
      promote_ok: boolean;
      safety: string;
      like_count: number;
      tip_cents: number;
      rank_penalty: boolean;
      duration_label: string;
      tags: string;
      published_at: string;
    }>`
      select id, author_id, caption, warning, kind, access, price_cents, media_url, preview_url,
             poster_url, promote_ok, safety, like_count, tip_cents, rank_penalty, duration_label, tags,
             to_char(published_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as published_at
      from posts
      where removed = false
        and (safety <> 'held' or author_id = ${context.userId})
        and (published_at <= now() or author_id = ${context.userId})
      order by published_at desc
    `;

    const countRows = await sql<{ post_id: string; n: number }>`
      select post_id, count(*)::int as n from comments group by post_id
    `;
    const commentCounts = new Map(countRows.map((row) => [row.post_id, num(row.n)]));
    const now = Date.now();
    const posts: Post[] = [];
    for (const row of postRows) {
      if (blockSet.has(row.author_id)) continue;
      const access: Access =
        row.access === "subscriber" || row.access === "unlock" ? row.access : "free";
      const kind: MediaKind = row.kind === "video" ? "video" : "image";
      const safety: Safety = row.safety === "limited" || row.safety === "held" ? row.safety : "clear";
      const publishedAt = text(row.published_at);
      const scheduled = new Date(publishedAt).getTime() > now;
      const locked =
        row.author_id !== context.userId &&
        access !== "free" &&
        !(access === "subscriber" && subs.has(row.author_id)) &&
        !(access === "unlock" && unlocks.has(row.id));
      posts.push({
        id: row.id,
        authorId: row.author_id,
        caption: row.caption,
        warning: row.warning,
        kind,
        access,
        priceCents: num(row.price_cents),
        mediaUrl: locked ? null : safeMedia(row.media_url),
        previewUrl: safeMedia(row.preview_url),
        posterUrl: safeMedia(row.poster_url),
        locked,
        promoteOk: Boolean(row.promote_ok),
        safety,
        likeCount: num(row.like_count),
        tipCents: num(row.tip_cents),
        rankPenalty: Boolean(row.rank_penalty),
        durationLabel: row.duration_label,
        tags: tags(row.tags),
        publishedAt,
        scheduled,
        liked: likes.has(row.id),
        commentCount: commentCounts.get(row.id) ?? 0,
      });
    }

    const commentRows = await sql<{
      id: string;
      post_id: string;
      user_id: string;
      body: string;
      created_at: string;
    }>`
      select id, post_id, user_id, body,
             to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
      from comments
      order by created_at desc
      limit 300
    `;
    const comments: Comment[] = commentRows
      .filter((row) => !blockSet.has(row.user_id))
      .map((row) => ({
        id: row.id,
        postId: row.post_id,
        userId: row.user_id,
        body: row.body,
        createdAt: text(row.created_at),
      }));

    const noteRows = await sql<{
      id: string;
      kind: string;
      title: string;
      body: string;
      href: string;
      read: boolean;
      created_at: string;
    }>`
      select id, kind, title, body, href, read,
             to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
      from notifications
      where user_id = ${context.userId}
      order by created_at desc
      limit 60
    `;
    const notifications: Note[] = noteRows.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      href: row.href,
      read: Boolean(row.read),
      createdAt: text(row.created_at),
    }));

    const messageRows = await sql<{
      id: string;
      thread_id: string;
      sender_id: string;
      recipient_id: string;
      body: string;
      created_at: string;
    }>`
      select id, thread_id, sender_id, recipient_id, body,
             to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
      from messages
      where sender_id = ${context.userId} or recipient_id = ${context.userId}
      order by created_at desc
      limit 300
    `;
    const messages: Msg[] = messageRows
      .filter((row) => {
        const other = row.sender_id === context.userId ? row.recipient_id : row.sender_id;
        return !blockSet.has(other);
      })
      .map((row) => ({
        id: row.id,
        threadId: row.thread_id,
        senderId: row.sender_id,
        recipientId: row.recipient_id,
        body: row.body,
        createdAt: text(row.created_at),
      }));

    const liveRows = await sql<{
      id: string;
      room_id: string;
      user_id: string;
      body: string;
      created_at: string;
    }>`
      select id, room_id, user_id, body,
             to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
      from live_chat
      order by created_at desc
      limit 80
    `;
    const live: LiveLine[] = liveRows.map((row) => ({
      id: row.id,
      roomId: row.room_id,
      userId: row.user_id,
      body: row.body,
      createdAt: text(row.created_at),
    }));

    const reportRows = await sql<{
      id: string;
      target_type: string;
      target_id: string;
      reason: string;
      detail: string;
      status: string;
      created_at: string;
    }>`
      select id, target_type, target_id, reason, detail, status,
             to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
      from reports
      where user_id = ${context.userId}
      order by created_at desc
      limit 40
    `;
    const reports: ReportRow[] = reportRows.map((row) => ({
      id: row.id,
      targetType: row.target_type,
      targetId: row.target_id,
      reason: row.reason,
      detail: row.detail,
      status: row.status,
      createdAt: text(row.created_at),
    }));

    const ledgerRows = await sql<{
      id: string;
      user_id: string;
      creator_id: string;
      kind: string;
      amount_cents: number;
      ref: string;
      memo: string;
      created_at: string;
    }>`
      select id, user_id, creator_id, kind, amount_cents, ref, memo,
             to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
      from ledger
      where user_id = ${context.userId} or creator_id = ${context.userId}
      order by created_at desc
      limit 200
    `;
    const ledger: LedgerRow[] = ledgerRows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      creatorId: row.creator_id,
      kind: row.kind,
      amountCents: num(row.amount_cents),
      ref: row.ref,
      memo: row.memo,
      createdAt: text(row.created_at),
    }));

    return {
      me,
      people: peopleRows.filter((row) => !blockSet.has(row.user_id)).map(toPerson),
      posts,
      comments,
      follows: [...follows],
      subscriptions: [...subs],
      unlocks: [...unlocks],
      notifications,
      messages,
      live,
      reports,
      ledger,
      blocks,
      mutes: muteRows.map((row) => row.target_id),
    };
  });

export const confirmAge = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ date: clip(record(input).date, 10) }))
  .handler(async ({ context, data }): Promise<ActionResult> => {
    const checked = adultEnough(data.date);
    if (!checked.ok) return { ok: false, error: "Luma is only for adults 18 and over." };
    const sql = await getSql();
    await sql`
      update profiles set age_ok = true, birth_year = ${checked.year}
      where user_id = ${context.userId}
    `;
    return { ok: true };
  });

export const tuneProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const body = record(input);
    const identities = Array.isArray(body.identities) ? body.identities.map((item) => clip(item, 24)).filter(Boolean).slice(0, 6) : [];
    const interests = Array.isArray(body.interests) ? body.interests.map((item) => clip(item, 24)).filter(Boolean).slice(0, 8) : [];
    return { pronouns: clip(body.pronouns, 32), identities, interests };
  })
  .handler(async ({ context, data }): Promise<ActionResult> => {
    const sql = await getSql();
    await sql`
      update profiles
      set pronouns = ${data.pronouns},
          identities = ${data.identities.join(",")},
          interests = ${data.interests.join(",")},
          tuned = true
      where user_id = ${context.userId}
    `;
    return { ok: true };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const body = record(input);
    const handle = clip(body.handle, 20).toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(handle)) throw new Error("Handles use 3–20 letters, numbers, or underscores.");
    const identities = Array.isArray(body.identities) ? body.identities.map((item) => clip(item, 24)).filter(Boolean).slice(0, 6) : [];
    const interests = Array.isArray(body.interests) ? body.interests.map((item) => clip(item, 24)).filter(Boolean).slice(0, 8) : [];
    const messagesMode: MessagesMode = body.messagesMode === "subscribers" ? "subscribers" : "open";
    const avatarUrl = text(body.avatarUrl);
    if (avatarUrl && !avatarUrl.startsWith("/media/") && !isImageData(avatarUrl)) {
      throw new Error("Try a smaller photo.");
    }
    const subscriptionCents = Math.round(num(body.subscriptionCents));
    if (subscriptionCents < 200 || subscriptionCents > 10000) {
      throw new Error("Membership price stays between $2 and $100.");
    }
    return {
      handle,
      displayName: clip(body.displayName, 40) || "Member",
      bio: clip(body.bio, 280),
      pronouns: clip(body.pronouns, 32),
      identities,
      interests,
      city: clip(body.city, 40),
      isCreator: Boolean(body.isCreator),
      subscriptionCents,
      promoteOk: Boolean(body.promoteOk),
      messagesMode,
      boundaries: clip(body.boundaries, 280),
      avatarUrl,
    };
  })
  .handler(async ({ context, data }): Promise<ActionResult> => {
    const sql = await getSql();
    const taken = await sql<{ user_id: string }>`
      select user_id from profiles where handle = ${data.handle} and user_id <> ${context.userId}
    `;
    if (taken.length) return { ok: false, error: "That handle is already taken." };
    await sql`
      update profiles set
        handle = ${data.handle},
        display_name = ${data.displayName},
        bio = ${data.bio},
        pronouns = ${data.pronouns},
        identities = ${data.identities.join(",")},
        interests = ${data.interests.join(",")},
        city = ${data.city},
        is_creator = ${data.isCreator},
        subscription_cents = ${data.subscriptionCents},
        promote_ok = ${data.promoteOk},
        messages_mode = ${data.messagesMode},
        boundaries = ${data.boundaries},
        avatar_url = ${data.avatarUrl},
        tuned = true
      where user_id = ${context.userId}
    `;
    return { ok: true };
  });

export const submitVerification = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<ActionResult> => {
    const sql = await getSql();
    await sql`
      update profiles
      set verification_status = 'submitted', is_creator = true
      where user_id = ${context.userId} and verification_status <> 'approved'
    `;
    await notify(
      sql,
      context.userId,
      "system",
      "Verification is with a reviewer",
      "ID, liveness, and payout ownership stay with the review team. Fans never see your legal name.",
      "/me",
    );
    return { ok: true };
  });

export const setFollow = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const body = record(input);
    return { creatorId: clip(body.creatorId, 80), follow: Boolean(body.follow) };
  })
  .handler(async ({ context, data }): Promise<ActionResult> => {
    if (!data.creatorId || data.creatorId === context.userId) {
      return { ok: false, error: "You cannot follow that profile." };
    }
    const sql = await getSql();
    const rows = await sql.query<ProfileRow>(`select ${PROFILE_FIELDS} from profiles where user_id = $1`, [
      data.creatorId,
    ]);
    const person = rows[0];
    if (!person) return { ok: false, error: "That profile is not here." };
    if (!data.follow) {
      await sql`delete from follows where user_id = ${context.userId} and creator_id = ${data.creatorId}`;
      return { ok: true };
    }
    await sql`
      insert into follows (user_id, creator_id) values (${context.userId}, ${data.creatorId})
      on conflict do nothing
    `;
    const latest = await sql<{ id: string; caption: string }>`
      select id, caption from posts
      where author_id = ${data.creatorId}
        and removed = false
        and safety <> 'held'
        and published_at <= now()
      order by published_at desc
      limit 1
    `;
    if (latest[0]) {
      await notify(
        sql,
        context.userId,
        "post",
        `New post from ${person.display_name}`,
        latest[0].caption.slice(0, 140),
        `/c/${person.handle}`,
      );
    }
    return { ok: true };
  });

async function entitled(sql: Sql, userId: string, post: PostRow, subs: boolean): Promise<boolean> {
  if (post.author_id === userId || post.access === "free") return true;
  if (post.access === "subscriber") return subs;
  const rows = await sql<{ ok: number }>`
    select 1 as ok from unlocks where user_id = ${userId} and post_id = ${post.id}
  `;
  return rows.length > 0;
}

export const toggleLike = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ postId: clip(record(input).postId, 80) }))
  .handler(async ({ context, data }): Promise<ActionResult> => {
    const sql = await getSql();
    const burst = await sql<{ n: number }>`
      select count(*)::int as n from engagement_log
      where user_id = ${context.userId}
        and kind = 'like'
        and created_at > now() - interval '2 minutes'
    `;
    if (num(burst[0]?.n) >= 10) {
      const open = await sql<{ id: string }>`
        select id from reports
        where user_id = ${context.userId}
          and target_type = 'engagement'
          and created_at > now() - interval '1 hour'
        limit 1
      `;
      if (!open.length) {
        await sql`
          insert into reports (id, user_id, target_type, target_id, reason, detail, status)
          values (
            ${crypto.randomUUID()},
            ${context.userId},
            'engagement',
            ${context.userId},
            'Rapid likes',
            'Burst of likes was not counted and is queued for a person to review.',
            'urgent'
          )
        `;
      }
      return {
        ok: false,
        error: "Those taps came in too fast, so they were not counted. A reviewer looks at bursts like that.",
      };
    }
    const posts = await sql<PostRow>`
      select id, author_id, caption, warning, kind, access, price_cents, media_url, preview_url, poster_url,
             promote_ok, safety, like_count, tip_cents, rank_penalty, duration_label, tags,
             to_char(published_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as published_at
      from posts where id = ${data.postId} and removed = false
    `;
    const post = posts[0];
    if (!post) return { ok: false, error: "That post is gone." };
    const sub = await sql<{ ok: number }>`
      select 1 as ok from subscriptions
      where user_id = ${context.userId} and creator_id = ${post.author_id} and status = 'active'
    `;
    if (!(await entitled(sql, context.userId, post, sub.length > 0))) {
      return { ok: false, error: "Unlock the post before liking it." };
    }
    const existing = await sql<{ post_id: string }>`
      select post_id from likes where user_id = ${context.userId} and post_id = ${data.postId}
    `;
    await sql`
      insert into engagement_log (id, user_id, post_id, kind)
      values (${crypto.randomUUID()}, ${context.userId}, ${data.postId}, 'like')
    `;
    if (existing.length) {
      await sql`delete from likes where user_id = ${context.userId} and post_id = ${data.postId}`;
      await sql`update posts set like_count = greatest(like_count - 1, 0) where id = ${data.postId}`;
    } else {
      await sql`insert into likes (user_id, post_id) values (${context.userId}, ${data.postId})`;
      await sql`update posts set like_count = like_count + 1 where id = ${data.postId}`;
    }
    return { ok: true };
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const body = record(input);
    return { postId: clip(body.postId, 80), body: clip(body.body, 280) };
  })
  .handler(async ({ context, data }): Promise<ActionResult> => {
    if (!data.body) return { ok: false, error: "Write a comment first." };
    const sql = await getSql();
    const posts = await sql<PostRow>`
      select id, author_id, caption, warning, kind, access, price_cents, media_url, preview_url, poster_url,
             promote_ok, safety, like_count, tip_cents, rank_penalty, duration_label, tags,
             to_char(published_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as published_at
      from posts where id = ${data.postId} and removed = false
    `;
    const post = posts[0];
    if (!post) return { ok: false, error: "That post is gone." };
    const sub = await sql<{ ok: number }>`
      select 1 as ok from subscriptions
      where user_id = ${context.userId} and creator_id = ${post.author_id} and status = 'active'
    `;
    if (!(await entitled(sql, context.userId, post, sub.length > 0))) {
      return { ok: false, error: "Join their circle before commenting." };
    }
    await sql`
      insert into comments (id, post_id, user_id, body)
      values (${crypto.randomUUID()}, ${data.postId}, ${context.userId}, ${data.body})
    `;
    if (post.author_id !== context.userId) {
      const me = await sql<{ display_name: string }>`
        select display_name from profiles where user_id = ${context.userId}
      `;
      await notify(
        sql,
        post.author_id,
        "comment",
        `Comment from ${me[0]?.display_name ?? "Someone"}`,
        data.body,
        `/c/${(await sql<{ handle: string }>`select handle from profiles where user_id = ${post.author_id}`)[0]?.handle ?? ""}`,
      );
    }
    return { ok: true };
  });

export const publishPost = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const body = record(input);
    const kind: MediaKind | "" = body.kind === "video" ? "video" : body.kind === "image" ? "image" : "";
    if (!kind) throw new Error("Choose an image or a video.");
    const access: Access =
      body.access === "subscriber" || body.access === "unlock" ? body.access : "free";
    const priceCents = access === "unlock" ? Math.round(num(body.priceCents)) : 0;
    if (access === "unlock" && (priceCents < 100 || priceCents > 10000)) {
      throw new Error("One-off price stays between $1 and $100.");
    }
    const id = clip(body.id, 40);
    const mediaUrl = text(body.mediaUrl);
    const previewUrl = text(body.previewUrl);
    const posterUrl = text(body.posterUrl);
    if (kind === "image" && !isImageData(mediaUrl)) throw new Error("That image is too large or unreadable.");
    if (kind === "video" && !/^idb:[0-9a-f-]{36}$/i.test(mediaUrl)) throw new Error("Save the video on this device first.");
    if (previewUrl && !isImageData(previewUrl) && !previewUrl.startsWith("/media/")) {
      throw new Error("Teaser image was not readable.");
    }
    if (posterUrl && !isImageData(posterUrl) && !posterUrl.startsWith("/media/")) {
      throw new Error("Poster image was not readable.");
    }
    return {
      id: /^[0-9a-f-]{36}$/i.test(id) ? id : crypto.randomUUID(),
      kind,
      access,
      priceCents,
      caption: clip(body.caption, 500),
      warning: clip(body.warning, 80),
      mediaUrl,
      previewUrl,
      posterUrl,
      promoteOk: Boolean(body.promoteOk),
      durationLabel: clip(body.durationLabel, 12),
      publishAt: clip(body.publishAt, 40),
      tags: Array.isArray(body.tags) ? body.tags.map((item) => clip(item, 24)).filter(Boolean).slice(0, 6) : [],
    };
  })
  .handler(async ({ context, data }): Promise<ActionResult> => {
    const sql = await getSql();
    const recent = await sql<{ n: number }>`
      select count(*)::int as n from posts
      where author_id = ${context.userId} and created_at > now() - interval '1 hour'
    `;
    if (num(recent[0]?.n) >= 10) return { ok: false, error: "That is enough posts for this hour." };
    const me = await sql<{ display_name: string; handle: string; age_ok: boolean }>`
      select display_name, handle, age_ok from profiles where user_id = ${context.userId}
    `;
    if (!me[0]?.age_ok) return { ok: false, error: "Confirm your age first." };
    let published = "now()";
    let when: string | null = null;
    if (data.publishAt) {
      const time = new Date(data.publishAt);
      if (Number.isNaN(time.getTime())) return { ok: false, error: "That schedule is not a real time." };
      if (time.getTime() > Date.now() + 1000 * 60 * 60 * 24 * 30) {
        return { ok: false, error: "Schedule stays inside the next 30 days." };
      }
      if (time.getTime() > Date.now() + 30_000) {
        published = "scheduled";
        when = time.toISOString();
      }
    }
    if (published === "scheduled" && when) {
      await sql`
        insert into posts (
          id, author_id, caption, warning, kind, access, price_cents, media_url, preview_url, poster_url,
          promote_ok, duration_label, tags, published_at
        ) values (
          ${data.id}, ${context.userId}, ${data.caption}, ${data.warning}, ${data.kind}, ${data.access},
          ${data.priceCents}, ${data.mediaUrl}, ${data.previewUrl}, ${data.posterUrl}, ${data.promoteOk},
          ${data.durationLabel}, ${data.tags.join(",")}, ${when}
        )
      `;
    } else {
      await sql`
        insert into posts (
          id, author_id, caption, warning, kind, access, price_cents, media_url, preview_url, poster_url,
          promote_ok, duration_label, tags
        ) values (
          ${data.id}, ${context.userId}, ${data.caption}, ${data.warning}, ${data.kind}, ${data.access},
          ${data.priceCents}, ${data.mediaUrl}, ${data.previewUrl}, ${data.posterUrl}, ${data.promoteOk},
          ${data.durationLabel}, ${data.tags.join(",")}
        )
      `;
      const followers = await sql<{ user_id: string }>`
        select user_id from follows where creator_id = ${context.userId}
        union
        select user_id from subscriptions where creator_id = ${context.userId} and status = 'active'
      `;
      for (const follower of followers) {
        if (follower.user_id === context.userId) continue;
        await notify(
          sql,
          follower.user_id,
          "post",
          `New post from ${me[0]?.display_name ?? "A creator"}`,
          data.caption.slice(0, 140) || "A new post is up.",
          `/c/${me[0]?.handle ?? ""}`,
        );
      }
    }
    await sql`update profiles set is_creator = true where user_id = ${context.userId}`;
    return { ok: true, id: data.id };
  });

export const removePost = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ postId: clip(record(input).postId, 80) }))
  .handler(async ({ context, data }): Promise<ActionResult> => {
    const sql = await getSql();
    const rows = await sql<{ id: string }>`
      update posts set removed = true
      where id = ${data.postId} and author_id = ${context.userId}
      returning id
    `;
    if (!rows.length) return { ok: false, error: "That post is not yours." };
    return { ok: true };
  });

export const checkout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const body = record(input);
    const kind = body.kind === "subscription" || body.kind === "unlock" || body.kind === "tip" ? body.kind : "";
    if (!kind) throw new Error("Choose what you are paying for.");
    return {
      kind,
      creatorId: clip(body.creatorId, 80),
      postId: clip(body.postId, 80),
      amountCents: Math.round(num(body.amountCents)),
    };
  })
  .handler(async ({ context, data }): Promise<ActionResult> => {
    if (data.creatorId === context.userId) return { ok: false, error: "That is your own page." };
    const sql = await getSql();
    const me = await sql<{ age_ok: boolean; display_name: string }>`
      select age_ok, display_name from profiles where user_id = ${context.userId}
    `;
    if (!me[0]?.age_ok) return { ok: false, error: "Confirm your age first." };
    const creators = await sql.query<ProfileRow>(`select ${PROFILE_FIELDS} from profiles where user_id = $1`, [
      data.creatorId,
    ]);
    const creator = creators[0];
    if (!creator) return { ok: false, error: "That creator is not here." };
    const ref = crypto.randomUUID();
    if (data.kind === "subscription") {
      if (!creator.is_creator) return { ok: false, error: "They are not offering a membership." };
      const price = num(creator.subscription_cents);
      await book(sql, context.userId, creator.user_id, ref, price, "subscription:");
      const existing = await sql<{ status: string }>`
        select status from subscriptions where user_id = ${context.userId} and creator_id = ${creator.user_id}
      `;
      if (existing.length) {
        await sql`
          update subscriptions
          set status = 'active', price_cents = ${price}, renews_at = now() + interval '30 days'
          where user_id = ${context.userId} and creator_id = ${creator.user_id}
        `;
      } else {
        await sql`
          insert into subscriptions (user_id, creator_id, status, price_cents, renews_at)
          values (${context.userId}, ${creator.user_id}, 'active', ${price}, now() + interval '30 days')
        `;
      }
      await notify(
        sql,
        creator.user_id,
        "subscribe",
        "New subscriber",
        `${me[0]?.display_name ?? "Someone"} joined your membership.`,
        "/me",
      );
      return { ok: true, id: ref };
    }
    if (data.kind === "unlock") {
      const posts = await sql<{ id: string; author_id: string; access: string; price_cents: number; caption: string }>`
        select id, author_id, access, price_cents, caption from posts
        where id = ${data.postId} and removed = false
      `;
      const post = posts[0];
      if (!post || post.author_id !== creator.user_id || post.access !== "unlock") {
        return { ok: false, error: "That post is not for sale." };
      }
      const already = await sql<{ ok: number }>`
        select 1 as ok from unlocks where user_id = ${context.userId} and post_id = ${post.id}
      `;
      if (already.length) return { ok: false, error: "You already unlocked this." };
      const price = num(post.price_cents);
      await book(sql, context.userId, creator.user_id, ref, price, `unlock:${post.id}`);
      await sql`
        insert into unlocks (user_id, post_id, price_cents) values (${context.userId}, ${post.id}, ${price})
      `;
      await notify(
        sql,
        creator.user_id,
        "unlock",
        "Post unlocked",
        `${me[0]?.display_name ?? "Someone"} unlocked a post.`,
        `/c/${creator.handle}`,
      );
      return { ok: true, id: ref };
    }
    const amount = data.amountCents;
    if (amount < 100 || amount > 20000) return { ok: false, error: "Tips stay between $1 and $200." };
    const postId = data.postId;
    await book(sql, context.userId, creator.user_id, ref, amount, `tip:${postId}`);
    if (postId) {
      await sql`update posts set tip_cents = tip_cents + ${amount} where id = ${postId} and author_id = ${creator.user_id}`;
    }
    await notify(
      sql,
      creator.user_id,
      "tip",
      "New tip",
      `${me[0]?.display_name ?? "Someone"} sent $${(amount / 100).toFixed(2)}.`,
      "/me",
    );
    return { ok: true, id: ref };
  });

export const refundPurchase = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ ref: clip(record(input).ref, 80) }))
  .handler(async ({ context, data }): Promise<ActionResult> => {
    const sql = await getSql();
    const rows = await sql<{ kind: string; amount_cents: number; creator_id: string; memo: string }>`
      select kind, amount_cents, creator_id, memo from ledger
      where ref = ${data.ref} and user_id = ${context.userId}
    `;
    if (!rows.length) return { ok: false, error: "That purchase is not on your ledger." };
    if (rows.some((row) => row.kind === "refund")) return { ok: false, error: "Already refunded." };
    const auth = rows.find((row) => row.kind === "authorization");
    const fee = rows.find((row) => row.kind === "platform_fee");
    const reserve = rows.find((row) => row.kind === "reserve");
    const payable = rows.find((row) => row.kind === "creator_payable");
    if (!auth) return { ok: false, error: "That purchase is not on your ledger." };
    const creatorId = auth.creator_id;
    const memo = auth.memo;
    const lines: Array<[string, number]> = [
      ["refund", num(auth.amount_cents)],
      ["platform_fee", -num(fee?.amount_cents)],
      ["reserve", -num(reserve?.amount_cents)],
      ["creator_payable", -num(payable?.amount_cents)],
    ];
    for (const [kind, amount] of lines) {
      await sql`
        insert into ledger (id, user_id, creator_id, kind, amount_cents, ref, memo)
        values (${crypto.randomUUID()}, ${context.userId}, ${creatorId}, ${kind}, ${amount}, ${data.ref}, ${memo})
      `;
    }
    if (memo.startsWith("subscription")) {
      await sql`
        update subscriptions set status = 'canceled'
        where user_id = ${context.userId} and creator_id = ${creatorId}
      `;
    } else if (memo.startsWith("unlock:")) {
      const postId = memo.slice("unlock:".length);
      await sql`delete from unlocks where user_id = ${context.userId} and post_id = ${postId}`;
    } else if (memo.startsWith("tip:")) {
      const postId = memo.slice("tip:".length);
      if (postId) {
        await sql`
          update posts set tip_cents = greatest(tip_cents - ${num(auth.amount_cents)}, 0)
          where id = ${postId}
        `;
      }
    }
    return { ok: true };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const body = record(input);
    return { recipientId: clip(body.recipientId, 80), body: clip(body.body, 500) };
  })
  .handler(async ({ context, data }): Promise<ActionResult> => {
    if (!data.body) return { ok: false, error: "Write a message first." };
    if (data.recipientId === context.userId) return { ok: false, error: "That is you." };
    const sql = await getSql();
    const burst = await sql<{ n: number }>`
      select count(*)::int as n from messages
      where sender_id = ${context.userId} and created_at > now() - interval '10 minutes'
    `;
    if (num(burst[0]?.n) >= 20) return { ok: false, error: "Slow down a little. Messages are limited for a few minutes." };
    const blocked = await sql<{ ok: number }>`
      select 1 as ok from blocks
      where (user_id = ${context.userId} and target_id = ${data.recipientId})
         or (user_id = ${data.recipientId} and target_id = ${context.userId})
    `;
    if (blocked.length) return { ok: false, error: "Messaging is closed between you." };
    const people = await sql.query<ProfileRow>(
      `select ${PROFILE_FIELDS} from profiles where user_id = $1 or user_id = $2`,
      [context.userId, data.recipientId],
    );
    const recipient = people.find((row) => row.user_id === data.recipientId);
    const me = people.find((row) => row.user_id === context.userId);
    if (!recipient || !me) return { ok: false, error: "That person is not here." };
    if (recipient.messages_mode === "subscribers") {
      const sub = await sql<{ ok: number }>`
        select 1 as ok from subscriptions
        where user_id = ${context.userId} and creator_id = ${recipient.user_id} and status = 'active'
      `;
      if (!sub.length) return { ok: false, error: "Subscribe to message them." };
    }
    const thread = threadKey(context.userId, recipient.user_id);
    await sql`
      insert into messages (id, thread_id, sender_id, recipient_id, body)
      values (${crypto.randomUUID()}, ${thread}, ${context.userId}, ${recipient.user_id}, ${data.body})
    `;
    await notify(
      sql,
      recipient.user_id,
      "message",
      `New message from ${me.display_name}`,
      data.body.slice(0, 140),
      `/inbox/${me.handle}`,
    );
    const prior = await sql<{ id: string }>`
      select id from messages where sender_id = ${recipient.user_id} and recipient_id = ${context.userId} limit 1
    `;
    const reply = REPLIES[recipient.user_id];
    if (reply && !prior.length) {
      await sql`
        insert into messages (id, thread_id, sender_id, recipient_id, body)
        values (${crypto.randomUUID()}, ${thread}, ${recipient.user_id}, ${context.userId}, ${reply})
      `;
      await notify(
        sql,
        context.userId,
        "message",
        `New message from ${recipient.display_name}`,
        reply,
        `/inbox/${recipient.handle}`,
      );
    }
    return { ok: true };
  });

export const markNotesRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const body = record(input);
    const raw = Array.isArray(body.ids) ? body.ids : [];
    return { ids: raw.map((item) => clip(item, 80)).filter(Boolean).slice(0, 60) };
  })
  .handler(async ({ context, data }): Promise<ActionResult> => {
    const sql = await getSql();
    if (!data.ids.length) {
      await sql`update notifications set read = true where user_id = ${context.userId}`;
      return { ok: true };
    }
    for (const id of data.ids) {
      await sql`update notifications set read = true where id = ${id} and user_id = ${context.userId}`;
    }
    return { ok: true };
  });

export const sendLive = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const body = record(input);
    return { roomId: clip(body.roomId, 80), body: clip(body.body, 200) };
  })
  .handler(async ({ context, data }): Promise<ActionResult> => {
    if (!data.body) return { ok: false, error: "Write a line first." };
    const sql = await getSql();
    const room = await sql<{ is_live: boolean }>`
      select is_live from profiles where user_id = ${data.roomId}
    `;
    if (!room[0]?.is_live && data.roomId !== context.userId) {
      return { ok: false, error: "That room is quiet." };
    }
    await sql`
      insert into live_chat (id, room_id, user_id, body)
      values (${crypto.randomUUID()}, ${data.roomId}, ${context.userId}, ${data.body})
    `;
    return { ok: true };
  });

export const reportContent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const body = record(input);
    const targetType = body.targetType === "person" ? "person" : "post";
    return {
      targetType,
      targetId: clip(body.targetId, 80),
      reason: clip(body.reason, 80) || "Other",
      detail: clip(body.detail, 500),
      urgent: Boolean(body.urgent),
    };
  })
  .handler(async ({ context, data }): Promise<ActionResult> => {
    const sql = await getSql();
    const underage = /under 18/i.test(data.reason);
    const status = data.urgent || underage ? "urgent" : "open";
    await sql`
      insert into reports (id, user_id, target_type, target_id, reason, detail, status)
      values (
        ${crypto.randomUUID()},
        ${context.userId},
        ${data.targetType},
        ${data.targetId},
        ${data.reason},
        ${data.detail},
        ${status}
      )
    `;
    if (data.targetType === "post" && underage) {
      await sql`update posts set safety = 'held' where id = ${data.targetId}`;
    } else if (data.targetType === "post" && data.urgent) {
      await sql`update posts set rank_penalty = true where id = ${data.targetId}`;
    }
    await notify(
      sql,
      context.userId,
      "system",
      status === "urgent" ? "A person has this now" : "Report received",
      status === "urgent"
        ? "Urgent reports, including anyone who may be under 18, are escalated to a human reviewer around the clock."
        : "A reviewer will read this. You can appeal a decision from your profile.",
      "/me",
    );
    return { ok: true };
  });

export const fileAppeal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ({ detail: clip(record(input).detail, 500) }))
  .handler(async ({ context, data }): Promise<ActionResult> => {
    if (data.detail.length < 8) return { ok: false, error: "Tell us what you want reviewed." };
    const sql = await getSql();
    await sql`
      insert into reports (id, user_id, target_type, target_id, reason, detail, status)
      values (
        ${crypto.randomUUID()},
        ${context.userId},
        'appeal',
        ${context.userId},
        'Appeal',
        ${data.detail},
        'open'
      )
    `;
    return { ok: true };
  });

export const setBlock = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const body = record(input);
    return { targetId: clip(body.targetId, 80), block: Boolean(body.block) };
  })
  .handler(async ({ context, data }): Promise<ActionResult> => {
    if (!data.targetId || data.targetId === context.userId) return { ok: false, error: "You cannot block that profile." };
    const sql = await getSql();
    if (!data.block) {
      await sql`delete from blocks where user_id = ${context.userId} and target_id = ${data.targetId}`;
      return { ok: true };
    }
    await sql`
      insert into blocks (user_id, target_id) values (${context.userId}, ${data.targetId})
      on conflict do nothing
    `;
    await sql`
      delete from follows
      where (user_id = ${context.userId} and creator_id = ${data.targetId})
         or (user_id = ${data.targetId} and creator_id = ${context.userId})
    `;
    await sql`
      update subscriptions set status = 'canceled'
      where (user_id = ${context.userId} and creator_id = ${data.targetId})
         or (user_id = ${data.targetId} and creator_id = ${context.userId})
    `;
    return { ok: true };
  });

export const setMute = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const body = record(input);
    return { targetId: clip(body.targetId, 80), mute: Boolean(body.mute) };
  })
  .handler(async ({ context, data }): Promise<ActionResult> => {
    if (!data.targetId || data.targetId === context.userId) return { ok: false, error: "You cannot mute that profile." };
    const sql = await getSql();
    if (!data.mute) {
      await sql`delete from mutes where user_id = ${context.userId} and target_id = ${data.targetId}`;
      return { ok: true };
    }
    await sql`
      insert into mutes (user_id, target_id) values (${context.userId}, ${data.targetId})
      on conflict do nothing
    `;
    return { ok: true };
  });
