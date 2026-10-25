import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { BadgeCheck, Heart, Lock, MessageCircle, MoreHorizontal, Play } from "lucide-react";
import { addComment, removePost, reportContent, setBlock, setMute, toggleLike } from "@/lib/luma/api";
import { ago, money, peopleIndex } from "@/lib/luma/format";
import { REPORT_REASONS, type Post } from "@/lib/luma/types";
import { PayButton, TipButton } from "@/components/luma/checkout";
import { useCircleData } from "@/components/luma/store";
import { Avatar, Button } from "@/components/luma/ui";
import { Viewer } from "@/components/luma/viewer";
import { cn } from "@/lib/utils";

function cardSrc(post: Post, tease: boolean): string {
  if ((tease && post.access !== "free") || post.locked) return post.previewUrl;
  if (post.kind === "video") return post.posterUrl || post.previewUrl;
  return post.mediaUrl || post.previewUrl;
}

export function PostCard({
  post,
  tease,
  revealed,
  onReveal,
  onOpen,
}: {
  post: Post;
  tease: boolean;
  revealed: boolean;
  onReveal: () => void;
  onOpen: () => void;
}) {
  const { data, run } = useCircleData();
  const people = peopleIndex(data);
  const creator = people.get(post.authorId);
  const mine = post.authorId === data.me.userId;
  const [menu, setMenu] = useState<"closed" | "menu" | "report" | "block">("closed");
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [detail, setDetail] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [comment, setComment] = useState("");
  const [thread, setThread] = useState(false);
  const hidden = Boolean(post.warning) && !revealed;
  const src = cardSrc(post, tease);
  const comments = data.comments.filter((item) => item.postId === post.id).slice(0, 4);
  const access =
    post.access === "free" ? "Free" : post.access === "subscriber" ? "Members" : money(post.priceCents);

  return (
    <article className="rounded-xl bg-surface p-2">
      <header className="flex items-center gap-3 px-2 py-2">
        <Link to="/c/$handle" params={{ handle: creator?.handle ?? "" }} className="shrink-0">
          <Avatar src={creator?.avatarUrl} name={creator?.displayName ?? "Creator"} className="size-11 rounded-full" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate font-medium">
            <Link to="/c/$handle" params={{ handle: creator?.handle ?? "" }}>
              {creator?.displayName ?? "Creator"}
            </Link>
            {creator?.verificationStatus === "approved" ? <BadgeCheck className="size-4 text-muted" aria-label="Verified" /> : null}
          </p>
          <p className="text-xs text-muted">
            {creator?.pronouns ? `${creator.pronouns} · ` : ""}
            {ago(post.publishedAt)}
          </p>
        </div>
        <button type="button" className="grid size-11 place-items-center" aria-label="Post actions" onClick={() => setMenu(menu === "closed" ? "menu" : "closed")}>
          <MoreHorizontal className="size-5" />
        </button>
      </header>
      {menu !== "closed" ? (
        <div className="mx-2 mb-2 rounded-md bg-bg p-3 text-sm">
          {menu === "menu" ? (
            <div className="flex flex-col">
              {mine ? (
                <button type="button" className="h-11 text-left" onClick={() => void run(() => removePost({ data: { postId: post.id } }))}>
                  Remove post
                </button>
              ) : (
                <>
                  <button type="button" className="h-11 text-left" onClick={() => void run(() => setMute({ data: { targetId: post.authorId, mute: !data.mutes.includes(post.authorId) } }))}>
                    {data.mutes.includes(post.authorId) ? "Unmute" : "Mute"}
                  </button>
                  <button type="button" className="h-11 text-left" onClick={() => setMenu("block")}>
                    Block
                  </button>
                  <button type="button" className="h-11 text-left" onClick={() => setMenu("report")}>
                    Report
                  </button>
                </>
              )}
            </div>
          ) : null}
          {menu === "block" ? (
            <div>
              <p>Block {creator?.displayName}? They will not see you, and you will not see them.</p>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="danger"
                  onClick={() =>
                    void run(() => setBlock({ data: { targetId: post.authorId, block: true } })).then(() => setMenu("closed"))
                  }
                >
                  Block
                </Button>
                <Button variant="ghost" onClick={() => setMenu("closed")}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
          {menu === "report" ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void run(() =>
                  reportContent({
                    data: { targetType: "post", targetId: post.id, reason, detail, urgent },
                  }),
                ).then((ok) => {
                  if (ok) setMenu("closed");
                });
              }}
            >
              <fieldset className="space-y-2">
                <legend className="mb-2 font-medium">Report this post</legend>
                {REPORT_REASONS.map((item) => (
                  <label key={item} className="flex items-center gap-2">
                    <input type="radio" name={`reason-${post.id}`} checked={reason === item} onChange={() => setReason(item)} />
                    {item}
                  </label>
                ))}
              </fieldset>
              <textarea
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
                placeholder="What should a reviewer know?"
                className="mt-3 min-h-20 w-full rounded-md border border-line bg-surface px-3 py-2 text-base"
              />
              <label className="mt-3 flex items-start gap-2">
                <input type="checkbox" className="mt-1" checked={urgent} onChange={(event) => setUrgent(event.target.checked)} />
                Ask for a person tonight
              </label>
              <div className="mt-3 flex gap-2">
                <Button type="submit">Send report</Button>
                <Button type="button" variant="ghost" onClick={() => setMenu("closed")}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
      {post.caption ? <p className="px-2 pb-3 text-sm">{post.caption}</p> : null}
      {hidden ? (
        <div className="rounded-lg bg-bg px-4 py-10 text-center">
          <p className="text-sm text-muted">Content note</p>
          <p className="mt-2 text-sm">{post.warning}</p>
          <Button className="mt-4" type="button" onClick={onReveal}>
            Show post
          </Button>
        </div>
      ) : (
        <button
          type="button"
          className="relative block w-full overflow-hidden rounded-lg bg-bg text-left"
          onClick={onOpen}
          aria-label={post.kind === "video" ? `Play video by ${creator?.displayName ?? "creator"}` : `View photo by ${creator?.displayName ?? "creator"}`}
        >
          {src ? (
            <img src={src} alt="" className="aspect-[3/4] w-full object-cover" />
          ) : (
            <span className="grid aspect-[3/4] place-items-center text-muted">
              <Lock />
            </span>
          )}
          <span className="absolute top-3 left-3 rounded-sm bg-bg px-2 py-1 text-xs">{access}</span>
          {post.kind === "video" ? (
            <>
              <span className="absolute inset-0 grid place-items-center">
                <span className="grid size-12 place-items-center rounded-full bg-bg">
                  <Play className="size-5" />
                </span>
              </span>
              {post.durationLabel ? (
                <span className="absolute right-3 bottom-3 rounded-sm bg-bg px-2 py-1 text-xs tabular-nums">
                  {post.durationLabel}
                </span>
              ) : null}
            </>
          ) : null}
          {post.locked ? (
            <span className="absolute inset-x-3 bottom-3 rounded-md bg-surface px-3 py-3 text-sm">
              <span className="flex items-center gap-2 font-medium">
                <Lock className="size-4" />
                {post.access === "subscriber" ? "Members only" : `Unlock ${money(post.priceCents)}`}
              </span>
              {tease && !post.locked ? null : (
                <span className="mt-1 block text-muted">Opens the teaser. The full post stays behind the paywall.</span>
              )}
            </span>
          ) : null}
          {tease && post.access !== "free" && !post.locked ? (
            <span className="absolute inset-x-3 bottom-3 rounded-md bg-surface px-3 py-2 text-xs text-muted">
              Discover teaser. You can open the full post.
            </span>
          ) : null}
        </button>
      )}
      <footer className={cn("flex items-center px-1", hidden && "hidden")}>
        {!post.locked ? (
          <button
            type="button"
            className={cn("inline-flex h-11 items-center gap-1 px-2 text-sm", post.liked && "text-danger")}
            aria-pressed={post.liked}
            onClick={() => void run(() => toggleLike({ data: { postId: post.id } }))}
          >
            <Heart className="size-4" fill={post.liked ? "currentColor" : "none"} />
            <span className="tabular-nums">{post.likeCount}</span>
          </button>
        ) : (
          <span className="px-2 text-sm text-muted tabular-nums">{post.likeCount}</span>
        )}
        <TipButton creatorId={post.authorId} creatorName={creator?.displayName ?? "Creator"} postId={post.id} />
        <button type="button" className="inline-flex h-11 items-center gap-1 px-2 text-sm text-muted" onClick={() => setThread((value) => !value)}>
          <MessageCircle className="size-4" />
          <span className="tabular-nums">{post.commentCount}</span>
        </button>
        {post.locked ? (
          <span className="ml-auto">
            <PayButton post={post} creatorId={post.authorId} creatorName={creator?.displayName ?? "Creator"} />
          </span>
        ) : null}
      </footer>
      {thread ? (
        <div className="px-2 pb-2">
          <ul className="space-y-2 text-sm">
            {comments.map((item) => (
              <li key={item.id}>
                <span className="font-medium">{people.get(item.userId)?.displayName ?? "Member"} </span>
                <span className="text-muted">{item.body}</span>
              </li>
            ))}
          </ul>
          {post.locked ? (
            <p className="mt-2 text-sm text-muted">Join their circle to comment.</p>
          ) : (
            <form
              className="mt-2 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const body = comment.trim();
                if (!body) return;
                void run(() => addComment({ data: { postId: post.id, body } })).then((ok) => {
                  if (ok) setComment("");
                });
              }}
            >
              <input
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Add a comment"
                className="h-11 min-w-0 flex-1 rounded-md border border-line bg-bg px-3 text-base"
              />
              <Button type="submit" variant="secondary">
                Send
              </Button>
            </form>
          )}
        </div>
      ) : null}
    </article>
  );
}

export function PostList({ posts, tease }: { posts: Post[]; tease: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const [shown, setShown] = useState<Record<string, boolean>>({});
  return (
    <>
      <div className="space-y-5">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            tease={tease}
            revealed={shown[post.id] ?? false}
            onReveal={() => setShown((current) => ({ ...current, [post.id]: true }))}
            onOpen={() => setOpen(post.id)}
          />
        ))}
      </div>
      {open ? <Viewer posts={posts} startId={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
