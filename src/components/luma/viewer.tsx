import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useResolvedSrc } from "@/components/luma/ui";
import { useCircleData } from "@/components/luma/store";
import { peopleIndex } from "@/lib/luma/format";
import type { Post } from "@/lib/luma/types";
import { PayButton } from "@/components/luma/checkout";

export function Viewer({
  posts,
  startId,
  onClose,
}: {
  posts: Post[];
  startId: string;
  onClose: () => void;
}) {
  const start = Math.max(0, posts.findIndex((post) => post.id === startId));
  const [index, setIndex] = useState(start);
  const frame = useRef<HTMLDivElement>(null);
  const entered = useRef(false);
  const post = posts[index];

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const node = frame.current;
    node?.requestFullscreen?.().then(
      () => {
        entered.current = true;
      },
      () => undefined,
    );
    return () => {
      document.body.style.overflow = previous;
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    function onChange() {
      if (!document.fullscreenElement && entered.current) onClose();
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [onClose]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setIndex((current) => Math.min(posts.length - 1, current + 1));
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setIndex((current) => Math.max(0, current - 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, posts.length]);

  if (!post) return null;

  return (
    <div
      ref={frame}
      className="fixed inset-0 z-50 bg-bg text-fg"
      role="dialog"
      aria-modal="true"
      aria-label="Media"
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest("button, a, input")) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (bounds.bottom - event.clientY < 72) return;
        event.currentTarget.dataset.x = String(event.clientX);
        event.currentTarget.dataset.y = String(event.clientY);
        event.currentTarget.dataset.pid = String(event.pointerId);
      }}
      onPointerUp={(event) => {
        const node = event.currentTarget;
        if (node.dataset.pid !== String(event.pointerId) || !node.dataset.y || !node.dataset.x) return;
        const dx = event.clientX - Number(node.dataset.x);
        const dy = event.clientY - Number(node.dataset.y);
        delete node.dataset.x;
        delete node.dataset.y;
        delete node.dataset.pid;
        if (Math.abs(dx) > Math.abs(dy)) return;
        if (Math.abs(dy) < 55) return;
        setIndex((current) => {
          const next = dy < 0 ? current + 1 : current - 1;
          return Math.max(0, Math.min(posts.length - 1, next));
        });
      }}
    >
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="text-sm tabular-nums text-muted">
          {index + 1} / {posts.length}
        </p>
        <button type="button" className="grid size-11 place-items-center" onClick={onClose} aria-label="Close">
          <X />
        </button>
      </div>
      <Stage post={post} />
      <p className="viewer-hint pointer-events-none absolute inset-x-0 bottom-28 text-center text-sm text-muted">
        Swipe up for next, down for previous
      </p>
      <div className="absolute top-1/2 right-3 hidden -translate-y-1/2 flex-col gap-2 sm:flex">
        <button
          type="button"
          className="grid size-11 place-items-center rounded-full bg-surface"
          aria-label="Next"
          disabled={index >= posts.length - 1}
          onClick={() => setIndex((current) => Math.min(posts.length - 1, current + 1))}
        >
          <ChevronUp />
        </button>
        <button
          type="button"
          className="grid size-11 place-items-center rounded-full bg-surface"
          aria-label="Previous"
          disabled={index <= 0}
          onClick={() => setIndex((current) => Math.max(0, current - 1))}
        >
          <ChevronDown />
        </button>
      </div>
    </div>
  );
}

function Stage({ post }: { post: Post }) {
  const { data } = useCircleData();
  const creator = peopleIndex(data).get(post.authorId);
  const [show, setShow] = useState(!post.warning);
  const src = useResolvedSrc(post.locked ? post.previewUrl : post.kind === "video" ? post.mediaUrl : post.mediaUrl);
  const poster = useResolvedSrc(post.posterUrl || post.previewUrl);

  return (
    <div className="flex h-full items-center justify-center px-4 pb-16">
      {!show ? (
        <div className="max-w-sm rounded-xl bg-surface p-3 text-center">
          <div className="rounded-md bg-bg px-4 py-8">
            <p className="text-sm text-muted">Content note</p>
            <p className="mt-2">{post.warning}</p>
            <button type="button" className="mt-6 h-11 rounded-md bg-accent px-4 text-sm font-medium text-accent-fg" onClick={() => setShow(true)}>
              Show post
            </button>
          </div>
        </div>
      ) : post.locked ? (
        <div className="relative max-h-full">
          {src ? <img src={src} alt="" className="max-h-[80dvh] rounded-lg object-contain" /> : null}
          <div className="absolute inset-x-6 bottom-6 rounded-md bg-surface p-4 text-center">
            <p className="font-medium">{creator?.displayName}</p>
            <p className="mt-1 text-sm text-muted">
              {post.access === "subscriber" ? "Members only" : "One-off unlock"}
            </p>
            <div className="mt-3">
              <PayButton post={post} creatorId={post.authorId} creatorName={creator?.displayName ?? "Creator"} />
            </div>
          </div>
        </div>
      ) : post.kind === "video" ? (
        src ? (
          <video
            key={post.id}
            src={src}
            poster={poster ?? undefined}
            controls
            autoPlay
            playsInline
            className="max-h-[86dvh] max-w-full rounded-lg"
          />
        ) : (
          <p className="max-w-sm text-center text-sm text-muted">
            This video is still on the device it was posted from.
          </p>
        )
      ) : src ? (
        <img src={src} alt={post.caption} className="max-h-[86dvh] max-w-full rounded-lg object-contain" />
      ) : (
        <p className="text-sm text-muted">Media unavailable.</p>
      )}
    </div>
  );
}
