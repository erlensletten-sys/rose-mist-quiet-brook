import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { UserButton } from "@/lib/auth/gates";
import {
  fileAppeal,
  markNotesRead,
  publishPost,
  refundPurchase,
  removePost,
  sendLive,
  sendMessage,
  setBlock,
  setFollow,
  setMute,
  submitVerification,
  updateProfile,
} from "@/lib/luma/api";
import { ago, findHandle, money, peopleIndex, threadKey } from "@/lib/luma/format";
import { capturePoster, compressImage, pixelate, saveMedia } from "@/lib/luma/media";
import { IDENTITIES, INTERESTS, type Access, type MediaKind } from "@/lib/luma/types";
import { PayButton } from "@/components/luma/checkout";
import { PostList } from "@/components/luma/post-card";
import { useCircleData } from "@/components/luma/store";
import { Avatar, Button, Chip, Panel, TextArea, TextField, useResolvedSrc } from "@/components/luma/ui";

export function SearchPage() {
  const { data } = useCircleData();
  const [query, setQuery] = useState("");
  const [interest, setInterest] = useState("");
  const q = query.trim().toLowerCase();
  const people = data.people.filter((person) => {
    const blob = `${person.displayName} ${person.handle} ${person.bio} ${person.identities.join(" ")} ${person.interests.join(" ")}`.toLowerCase();
    if (interest && !person.interests.includes(interest) && !person.identities.includes(interest)) return false;
    return !q || blob.includes(q);
  });
  const posts = data.posts.filter((post) => {
    if (post.scheduled || post.safety === "held") return false;
    const creator = data.people.find((person) => person.userId === post.authorId);
    const blob = `${post.caption} ${post.tags.join(" ")} ${creator?.displayName ?? ""}`.toLowerCase();
    if (interest && !post.tags.includes(interest) && !creator?.interests.includes(interest)) return false;
    return !q || blob.includes(q);
  });

  return (
    <section className="pt-4 lg:pt-6">
      <h1 className="font-display text-4xl">Search</h1>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Names, crafts, cities of work"
        className="mt-4 h-11 w-full rounded-md border border-line bg-surface px-3 text-base"
        aria-label="Search"
      />
      <div className="scroll-row mt-3 flex gap-2 overflow-x-auto pb-2">
        <Chip pressed={!interest} onClick={() => setInterest("")}>
          All
        </Chip>
        {INTERESTS.map((item) => (
          <Chip key={item} pressed={interest === item} onClick={() => setInterest(item)}>
            {item}
          </Chip>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {people.slice(0, 8).map((person) => (
          <Link key={person.userId} to="/c/$handle" params={{ handle: person.handle }} className="flex items-center gap-3 rounded-xl bg-surface p-3">
            <Avatar src={person.avatarUrl} name={person.displayName} className="size-12 rounded-md" />
            <span className="min-w-0">
              <span className="block truncate font-medium">{person.displayName}</span>
              <span className="block truncate text-sm text-muted">
                {person.pronouns}
                {person.identities.length ? ` · ${person.identities.join(", ")}` : ""}
              </span>
            </span>
          </Link>
        ))}
      </div>
      <div className="mt-6">
        <PostList posts={posts.slice(0, 12)} tease />
      </div>
    </section>
  );
}

export function AlertsPage() {
  const { data, run } = useCircleData();
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    const ids = data.notifications.filter((note) => !note.read).map((note) => note.id);
    if (ids.length) void run(() => markNotesRead({ data: { ids } }));
  }, [data.notifications, run]);
  return (
    <section className="pt-4 lg:pt-6">
      <h1 className="font-display text-4xl">Alerts</h1>
      <p className="mt-2 text-sm text-muted">New messages, new posts from people you follow, tips, and subscriptions.</p>
      <ul className="mt-5 space-y-2">
        {data.notifications.length === 0 ? <li className="text-sm text-muted">Nothing yet.</li> : null}
        {data.notifications.map((note) => (
          <li key={note.id}>
            <NoteLink href={note.href}>
              <span className="flex items-center justify-between gap-3">
                <span className="font-medium">{note.title}</span>
                <span className="text-xs text-muted">{ago(note.createdAt)}</span>
              </span>
              <span className="mt-1 block text-sm text-muted">{note.body}</span>
            </NoteLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NoteLink({ href, children }: { href: string; children: ReactNode }) {
  const className = "block rounded-xl bg-surface p-3";
  if (href.startsWith("/inbox/")) {
    return (
      <Link to="/inbox/$handle" params={{ handle: decodeURIComponent(href.slice("/inbox/".length)) }} className={className}>
        {children}
      </Link>
    );
  }
  if (href.startsWith("/c/")) {
    return (
      <Link to="/c/$handle" params={{ handle: decodeURIComponent(href.slice(3)) }} className={className}>
        {children}
      </Link>
    );
  }
  if (href.startsWith("/live/")) {
    return (
      <Link to="/live/$handle" params={{ handle: decodeURIComponent(href.slice(6)) }} className={className}>
        {children}
      </Link>
    );
  }
  if (href === "/me") {
    return (
      <Link to="/me" className={className}>
        {children}
      </Link>
    );
  }
  return (
    <Link to="/" className={className}>
      {children}
    </Link>
  );
}

export function InboxPage() {
  const { data } = useCircleData();
  const people = peopleIndex(data);
  const threads = useMemo(() => {
    const map = new Map<string, (typeof data.messages)[number]>();
    for (const message of data.messages) {
      const other = message.senderId === data.me.userId ? message.recipientId : message.senderId;
      const prev = map.get(other);
      if (!prev || prev.createdAt < message.createdAt) map.set(other, message);
    }
    return [...map.entries()].sort((a, b) => b[1].createdAt.localeCompare(a[1].createdAt));
  }, [data]);

  return (
    <section className="pt-4 lg:pt-6">
      <h1 className="font-display text-4xl">Inbox</h1>
      <ul className="mt-5 space-y-2">
        {threads.length === 0 ? <li className="text-sm text-muted">Messages from creators will land here.</li> : null}
        {threads.map(([id, message]) => {
          const person = people.get(id);
          return (
            <li key={id}>
              <Link to="/inbox/$handle" params={{ handle: person?.handle ?? id }} className="flex items-center gap-3 rounded-xl bg-surface p-3">
                <Avatar src={person?.avatarUrl} name={person?.displayName ?? "Member"} className="size-12 rounded-full" />
                <span className="min-w-0">
                  <span className="block font-medium">{person?.displayName ?? "Member"}</span>
                  <span className="block truncate text-sm text-muted">{message.body}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ThreadPage({ handle }: { handle: string }) {
  const { data, run } = useCircleData();
  const person = findHandle(data, handle);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  if (!person) return <p className="pt-8 text-sm text-muted">That conversation is not here.</p>;
  const messages = data.messages
    .filter((message) => message.threadId === threadKey(data.me.userId, person.userId) || message.senderId === person.userId || message.recipientId === person.userId)
    .slice()
    .reverse();
  const locked = person.messagesMode === "subscribers" && !data.subscriptions.includes(person.userId) && person.userId !== data.me.userId;

  return (
    <section className="flex min-h-[70dvh] flex-col pt-4 lg:pt-6">
      <Link to="/c/$handle" params={{ handle: person.handle }} className="flex items-center gap-3">
        <Avatar src={person.avatarUrl} name={person.displayName} className="size-11 rounded-full" />
        <span>
          <h1 className="font-display text-3xl">{person.displayName}</h1>
          <span className="text-sm text-muted">{person.messagesMode === "subscribers" ? "Members can message" : "Messages open"}</span>
        </span>
      </Link>
      <ul className="mt-5 flex-1 space-y-3">
        {messages.map((message) => {
          const mine = message.senderId === data.me.userId;
          return (
            <li key={message.id} className={mine ? "ml-10 text-right" : "mr-10"}>
              <p className={`inline-block rounded-md px-3 py-2 text-sm ${mine ? "bg-accent text-accent-fg" : "bg-surface"}`}>
                {message.body}
              </p>
            </li>
          );
        })}
      </ul>
      {locked ? (
        <div className="mt-4 rounded-xl bg-surface p-3">
          <p className="text-sm">Subscribe to message {person.displayName}.</p>
          <div className="mt-3">
            <PayButton creatorId={person.userId} creatorName={person.displayName} />
          </div>
        </div>
      ) : (
        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setPending(true);
            void run(() => sendMessage({ data: { recipientId: person.userId, body } })).then((ok) => {
              if (ok) setBody("");
              setPending(false);
            });
          }}
        >
          <input
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write a message"
            className="h-11 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-base"
          />
          <Button type="submit" disabled={pending}>
            Send
          </Button>
        </form>
      )}
    </section>
  );
}

export function CreatorPage({ handle }: { handle: string }) {
  const { data, run } = useCircleData();
  const person = findHandle(data, handle);
  if (!person) return <p className="pt-8 text-sm text-muted">That profile is not here.</p>;
  const posts = data.posts.filter((post) => post.authorId === person.userId && !post.scheduled && post.safety !== "held");
  const following = data.follows.includes(person.userId);
  const subscribed = data.subscriptions.includes(person.userId);
  const mine = person.userId === data.me.userId;

  return (
    <section className="pt-4 lg:pt-6">
      <div className="overflow-hidden rounded-xl bg-surface">
        <Avatar src={person.bannerUrl || person.avatarUrl} name={person.displayName} className="aspect-[5/2] w-full" />
        <div className="p-3">
          <div className="flex items-end gap-3">
            <Avatar src={person.avatarUrl} name={person.displayName} className="-mt-10 size-16 rounded-md border-2 border-surface" />
            <div>
              <h1 className="font-display text-3xl">{person.displayName}</h1>
              <p className="text-sm text-muted">
                @{person.handle}
                {person.pronouns ? ` · ${person.pronouns}` : ""}
                {person.city ? ` · ${person.city}` : ""}
              </p>
            </div>
          </div>
          {person.identities.length ? <p className="mt-3 text-sm">{person.identities.join(" · ")}</p> : null}
          <p className="mt-3 text-sm">{person.bio}</p>
          {person.boundaries ? (
            <p className="mt-3 rounded-md bg-bg px-3 py-3 text-sm text-muted">Boundaries: {person.boundaries}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {mine ? (
              <Link to="/me" className="inline-flex h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg">
                Edit profile
              </Link>
            ) : (
              <>
                <Button
                  variant={following ? "secondary" : "primary"}
                  onClick={() => void run(() => setFollow({ data: { creatorId: person.userId, follow: !following } }))}
                >
                  {following ? "Following" : "Follow"}
                </Button>
                {person.isCreator && !subscribed ? <PayButton creatorId={person.userId} creatorName={person.displayName} /> : null}
                {subscribed ? <span className="inline-flex h-11 items-center text-sm text-muted">Member</span> : null}
                <Link to="/inbox/$handle" params={{ handle: person.handle }} className="inline-flex h-11 items-center rounded-md border border-line px-4 text-sm">
                  Message
                </Link>
                {person.isLive ? (
                  <Link to="/live/$handle" params={{ handle: person.handle }} className="inline-flex h-11 items-center rounded-md border border-line px-4 text-sm">
                    Live
                  </Link>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
      <div className="mt-5">
        <PostList posts={posts} tease={false} />
      </div>
    </section>
  );
}

export function LivePage({ handle }: { handle: string }) {
  const { data, run } = useCircleData();
  const person = findHandle(data, handle);
  const [body, setBody] = useState("");
  const clip = data.posts.find((post) => post.authorId === person?.userId && post.kind === "video" && !post.locked && post.mediaUrl);
  const src = useResolvedSrc(clip?.mediaUrl);
  if (!person) return <p className="pt-8 text-sm text-muted">That room is not here.</p>;
  const lines = data.live.filter((line) => line.roomId === person.userId).slice().reverse();
  const people = peopleIndex(data);

  return (
    <section className="pt-4 lg:pt-6">
      <p className="text-sm text-danger">Live</p>
      <h1 className="font-display text-4xl">{person.displayName}</h1>
      <p className="mt-1 text-sm text-muted tabular-nums">{person.liveViewers} watching</p>
      <div className="mt-4 overflow-hidden rounded-xl bg-surface">
        {src ? (
          <video src={src} poster={person.avatarUrl} autoPlay muted loop playsInline controls className="aspect-[3/4] w-full object-cover" />
        ) : (
          <Avatar src={person.avatarUrl} name={person.displayName} className="aspect-[3/4] w-full" />
        )}
      </div>
      {!person.isLive ? <p className="mt-3 text-sm text-muted">They are not live right now. This is their latest clip.</p> : null}
      <ul className="mt-4 space-y-2">
        {lines.map((line) => (
          <li key={line.id} className="text-sm">
            <span className="font-medium">{people.get(line.userId)?.displayName ?? "Member"} </span>
            <span className="text-muted">{line.body}</span>
          </li>
        ))}
      </ul>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const text = body.trim();
          if (!text) return;
          void run(() => sendLive({ data: { roomId: person.userId, body: text } })).then((ok) => {
            if (ok) setBody("");
          });
        }}
      >
        <input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Say something kind"
          className="h-11 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-base"
        />
        <Button type="submit">Send</Button>
      </form>
    </section>
  );
}

export function CreatePage() {
  const { data, run } = useCircleData();
  const [kind, setKind] = useState<MediaKind>("image");
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [warning, setWarning] = useState("");
  const [access, setAccess] = useState<Access>("free");
  const [price, setPrice] = useState("4");
  const [promote, setPromote] = useState(true);
  const [teaser, setTeaser] = useState(true);
  const [schedule, setSchedule] = useState(false);
  const [when, setWhen] = useState("");
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState("");
  const mine = data.posts.filter((post) => post.authorId === data.me.userId);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setLocalError("Choose an image or a video.");
      return;
    }
    setPending(true);
    setLocalError("");
    try {
      const id = crypto.randomUUID();
      let mediaUrl = "";
      let previewUrl = "";
      let posterUrl = "";
      let durationLabel = "";
      if (kind === "image") {
        const full = await compressImage(file);
        mediaUrl = full;
        posterUrl = full;
        previewUrl = access === "free" || !teaser ? (access === "free" ? full : "") : await pixelate(full);
        if (access !== "free" && teaser) previewUrl = await pixelate(full);
      } else {
        if (file.size > 40 * 1024 * 1024) throw new Error("That video is over 40MB.");
        await saveMedia(id, file);
        const shot = await capturePoster(file);
        mediaUrl = `idb:${id}`;
        posterUrl = shot.poster;
        durationLabel = shot.duration;
        previewUrl = access !== "free" && teaser ? await pixelate(shot.poster) : shot.poster;
        if (access !== "free" && !teaser) previewUrl = "";
      }
      const ok = await run(() =>
        publishPost({
          data: {
            id,
            kind,
            access,
            priceCents: Math.round(Number(price) * 100) || 0,
            caption,
            warning,
            mediaUrl,
            previewUrl,
            posterUrl,
            promoteOk: promote && (access === "free" || teaser),
            durationLabel,
            publishAt: schedule ? when : "",
            tags: data.me.interests,
          },
        }),
      );
      if (ok) {
        setCaption("");
        setWarning("");
        setFile(null);
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not publish.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="pt-4 lg:pt-6">
      <h1 className="font-display text-4xl">New post</h1>
      <p className="mt-2 max-w-md text-sm text-muted">
        Images stay with your account. Videos in this preview stay on this device. Paid posts can show a pixel teaser on Discover.
      </p>
      <form className="mt-5 rounded-xl bg-surface p-3" onSubmit={(event) => void onSubmit(event)}>
        <div className="rounded-md bg-bg p-3">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={`h-11 rounded-md text-sm ${kind === "image" ? "bg-accent text-accent-fg" : "bg-surface"}`} onClick={() => setKind("image")}>
              Image
            </button>
            <button type="button" className={`h-11 rounded-md text-sm ${kind === "video" ? "bg-accent text-accent-fg" : "bg-surface"}`} onClick={() => setKind("video")}>
              Video
            </button>
          </div>
          <label className="mt-4 flex h-28 cursor-pointer items-center justify-center rounded-md border border-dashed border-line text-sm text-muted">
            {file ? file.name : kind === "image" ? "Choose an image" : "Choose a video"}
            <input
              type="file"
              accept={kind === "image" ? "image/*" : "video/mp4,video/webm,video/quicktime"}
              className="sr-only"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <div className="mt-4">
            <TextArea label="Caption" name="caption" value={caption} onChange={(event) => setCaption(event.target.value)} />
          </div>
          <div className="mt-4">
            <TextField label="Content note" name="warning" value={warning} onChange={(event) => setWarning(event.target.value)} hint="Optional. Viewers confirm before the media opens." />
          </div>
          <fieldset className="mt-4">
            <legend className="text-sm font-medium">Who can see it</legend>
            <div className="mt-2 grid gap-2">
              {(
                [
                  ["free", "Free"],
                  ["subscriber", "Members"],
                  ["unlock", "One-off unlock"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex h-11 items-center gap-2 rounded-md bg-surface px-3 text-sm">
                  <input type="radio" name="access" checked={access === value} onChange={() => setAccess(value)} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          {access === "unlock" ? (
            <div className="mt-4">
              <TextField label="Price in dollars" name="price" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} />
            </div>
          ) : null}
          {access !== "free" ? (
            <label className="mt-4 flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={teaser} onChange={(event) => setTeaser(event.target.checked)} />
              Show a pixel teaser on Discover. Without it, this post stays off Discover.
            </label>
          ) : null}
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={promote} onChange={(event) => setPromote(event.target.checked)} />
            Allow Discover to feature this
          </label>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={schedule} onChange={(event) => setSchedule(event.target.checked)} />
            Schedule
          </label>
          {schedule ? (
            <input
              type="datetime-local"
              value={when}
              onChange={(event) => setWhen(event.target.value)}
              className="mt-3 h-11 w-full rounded-md border border-line bg-surface px-3 text-base"
            />
          ) : null}
          {localError ? <p className="mt-3 text-sm text-danger">{localError}</p> : null}
          <Button className="mt-4 w-full" type="submit" disabled={pending}>
            {pending ? "Publishing…" : "Publish"}
          </Button>
        </div>
      </form>
      <div className="mt-8 space-y-3">
        <h2 className="font-display text-2xl">Your posts</h2>
        {mine.length === 0 ? <p className="text-sm text-muted">Nothing published yet.</p> : null}
        {mine.map((post) => (
          <div key={post.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface p-3">
            <div>
              <p className="text-sm">{post.caption || (post.kind === "video" ? "Video" : "Photo")}</p>
              <p className="text-xs text-muted">
                {post.scheduled ? "Scheduled" : post.safety === "held" ? "Held for review" : post.access}
              </p>
            </div>
            <Button variant="ghost" onClick={() => void run(() => removePost({ data: { postId: post.id } }))}>
              Remove
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ProfilePage() {
  const { data, run } = useCircleData();
  const me = data.me;
  const [displayName, setDisplayName] = useState(me.displayName);
  const [handle, setHandle] = useState(me.handle);
  const [pronouns, setPronouns] = useState(me.pronouns);
  const [bio, setBio] = useState(me.bio);
  const [city, setCity] = useState(me.city);
  const [boundaries, setBoundaries] = useState(me.boundaries);
  const [identities, setIdentities] = useState(me.identities);
  const [interests, setInterests] = useState(me.interests);
  const [isCreator, setIsCreator] = useState(me.isCreator);
  const [price, setPrice] = useState(String(me.subscriptionCents / 100));
  const [promoteOk, setPromoteOk] = useState(me.promoteOk);
  const [messagesMode, setMessagesMode] = useState(me.messagesMode);
  const [avatarUrl, setAvatarUrl] = useState(me.avatarUrl);
  const [appeal, setAppeal] = useState("");
  const people = peopleIndex(data);
  const groups = new Map<string, typeof data.ledger>();
  for (const row of data.ledger) {
    if (row.userId !== me.userId || row.kind !== "authorization") continue;
    groups.set(row.ref, data.ledger.filter((item) => item.ref === row.ref && item.userId === me.userId));
  }
  const payable = data.ledger
    .filter((row) => row.creatorId === me.userId && row.kind === "creator_payable")
    .reduce((sum, row) => sum + row.amountCents, 0);

  function toggle(list: string[], value: string, set: (next: string[]) => void) {
    set(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  return (
    <section className="space-y-5 pt-4 lg:pt-6">
      <h1 className="font-display text-4xl">Profile</h1>
      <form
        className="space-y-4 rounded-xl bg-surface p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void run(() =>
            updateProfile({
              data: {
                displayName,
                handle,
                pronouns,
                bio,
                city,
                boundaries,
                identities,
                interests,
                isCreator,
                subscriptionCents: Math.round(Number(price) * 100) || 800,
                promoteOk,
                messagesMode,
                avatarUrl,
              },
            }),
          );
        }}
      >
        <div className="rounded-md bg-bg p-3">
          <div className="flex items-center gap-3">
            <Avatar src={avatarUrl} name={displayName} className="size-16 rounded-md" />
            <label className="text-sm">
              Change photo
              <input
                type="file"
                accept="image/*"
                className="mt-2 block text-xs"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void compressImage(file).then(setAvatarUrl).catch(() => undefined);
                }}
              />
            </label>
          </div>
          <div className="mt-4 grid gap-4">
            <TextField label="Name" name="displayName" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            <TextField label="Handle" name="handle" value={handle} onChange={(event) => setHandle(event.target.value)} />
            <TextField label="Pronouns" name="pronouns" value={pronouns} onChange={(event) => setPronouns(event.target.value)} />
            <TextField label="City" name="city" value={city} onChange={(event) => setCity(event.target.value)} hint="Shown on your profile. Not a precise location." />
            <TextArea label="Bio" name="bio" value={bio} onChange={(event) => setBio(event.target.value)} />
            <TextArea label="Boundaries" name="boundaries" value={boundaries} onChange={(event) => setBoundaries(event.target.value)} />
          </div>
          <fieldset className="mt-4">
            <legend className="text-sm font-medium">Identity</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {IDENTITIES.map((item) => (
                <Chip key={item} pressed={identities.includes(item)} onClick={() => toggle(identities, item, setIdentities)}>
                  {item}
                </Chip>
              ))}
            </div>
          </fieldset>
          <fieldset className="mt-4">
            <legend className="text-sm font-medium">Interests</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {INTERESTS.map((item) => (
                <Chip key={item} pressed={interests.includes(item)} onClick={() => toggle(interests, item, setInterests)}>
                  {item}
                </Chip>
              ))}
            </div>
          </fieldset>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isCreator} onChange={(event) => setIsCreator(event.target.checked)} />
            I publish as a creator
          </label>
          <div className="mt-4">
            <TextField label="Membership price in dollars" name="price" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} />
          </div>
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={promoteOk} onChange={(event) => setPromoteOk(event.target.checked)} />
            Let Discover feature posts I mark as promotable
          </label>
          <fieldset className="mt-4">
            <legend className="text-sm font-medium">Messages</legend>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="radio" checked={messagesMode === "open"} onChange={() => setMessagesMode("open")} />
              Open
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="radio" checked={messagesMode === "subscribers"} onChange={() => setMessagesMode("subscribers")} />
              Members only
            </label>
          </fieldset>
          <Button className="mt-4" type="submit">
            Save profile
          </Button>
        </div>
      </form>

      <Panel title="Verification">
        <div className="rounded-md bg-bg p-3 text-sm">
          <p>Status: {me.verificationStatus === "none" ? "Not started" : me.verificationStatus === "submitted" ? "In review" : "Approved"}</p>
          <p className="mt-2 text-muted">
            Creator payouts ask for a government ID, a liveness check, sanctions screening where required, and proof you own the payout account. A person reviews it. Fans never see your legal name. This preview does not collect document images.
          </p>
          {me.verificationStatus !== "approved" ? (
            <Button className="mt-4" type="button" onClick={() => void run(() => submitVerification())}>
              Submit for review
            </Button>
          ) : (
            <p className="mt-3">Payouts still wait on jurisdiction checks. Nothing is sent from this preview.</p>
          )}
          {me.isCreator ? <p className="mt-3 tabular-nums">Payable balance {money(payable)}</p> : null}
        </div>
      </Panel>

      <Panel title="Purchases">
        <ul className="space-y-2">
          {[...groups.entries()].map(([ref, rows]) => {
            const auth = rows.find((row) => row.kind === "authorization");
            const refunded = rows.some((row) => row.kind === "refund");
            return (
              <li key={ref} className="rounded-md bg-bg p-3 text-sm">
                <p className="tabular-nums">{money(auth?.amountCents ?? 0)}</p>
                <p className="text-muted">{auth?.memo || "Payment"} · {auth ? ago(auth.createdAt) : ""}</p>
                {!refunded ? (
                  <Button className="mt-2" variant="ghost" onClick={() => void run(() => refundPurchase({ data: { ref } }))}>
                    Refund
                  </Button>
                ) : (
                  <p className="mt-2 text-muted">Refunded</p>
                )}
              </li>
            );
          })}
          {groups.size === 0 ? <li className="px-1 text-sm text-muted">No payments yet.</li> : null}
        </ul>
      </Panel>

      <Panel title="Safety">
        <div className="rounded-md bg-bg p-3 text-sm">
          <p className="text-muted">
            Discover ignores repeated taps, limits bursts, and holds unusual spikes for a person to review. Urgent reports, including anyone who may be under 18, escalate around the clock.
          </p>
          <ul className="mt-3 space-y-2">
            {data.reports.map((report) => (
              <li key={report.id}>
                {report.reason} · {report.status}
              </li>
            ))}
            {data.reports.length === 0 ? <li className="text-muted">No open cases.</li> : null}
          </ul>
          <div className="mt-4">
            {data.blocks.map((id) => (
              <div key={id} className="flex items-center justify-between py-1">
                <span>Blocked {people.get(id)?.displayName ?? "member"}</span>
                <Button variant="ghost" onClick={() => void run(() => setBlock({ data: { targetId: id, block: false } }))}>
                  Undo
                </Button>
              </div>
            ))}
            {data.mutes.map((id) => (
              <div key={id} className="flex items-center justify-between py-1">
                <span>Muted {people.get(id)?.displayName ?? "member"}</span>
                <Button variant="ghost" onClick={() => void run(() => setMute({ data: { targetId: id, mute: false } }))}>
                  Undo
                </Button>
              </div>
            ))}
          </div>
          <form
            className="mt-4"
            onSubmit={(event) => {
              event.preventDefault();
              void run(() => fileAppeal({ data: { detail: appeal } })).then((ok) => {
                if (ok) setAppeal("");
              });
            }}
          >
            <TextArea label="Appeal a decision" name="appeal" value={appeal} onChange={(event) => setAppeal(event.target.value)} />
            <Button className="mt-3" type="submit" variant="secondary">
              Send appeal
            </Button>
          </form>
        </div>
      </Panel>
      <div className="rounded-xl bg-surface p-3">
        <UserButton />
      </div>
    </section>
  );
}
