import { Link } from "@tanstack/react-router";
import { setFollow } from "@/lib/luma/api";
import type { FeedTab } from "@/lib/luma/rank";
import { postsForTab } from "@/lib/luma/rank";
import { PostList } from "@/components/luma/post-card";
import { useCircleData } from "@/components/luma/store";
import { Avatar, Button } from "@/components/luma/ui";

const COPY: Record<FeedTab, { title: string; body: string }> = {
  discover: {
    title: "Discover",
    body: "Creators who agreed to be featured. Newer work and real responses rank higher. Paid posts show only the teaser they approved.",
  },
  foryou: {
    title: "For you",
    body: "A regular scrolling page shaped by your interests and the people you already follow.",
  },
  following: {
    title: "Following",
    body: "Posts from creators you follow or subscribe to, newest first.",
  },
};

export function FeedPage({ tab }: { tab: FeedTab }) {
  const { data, run } = useCircleData();
  const posts = postsForTab(tab, data);
  const copy = COPY[tab];
  const ideas = data.people.filter((person) => person.isCreator && !data.follows.includes(person.userId)).slice(0, 4);

  return (
    <section>
      <h1 className="pt-4 font-display text-3xl lg:pt-6 lg:text-4xl">{copy.title}</h1>
      <p className="mt-2 mb-5 max-w-md text-sm text-muted">{copy.body}</p>
      {posts.length === 0 ? (
        <div className="rounded-xl bg-surface p-3">
          <div className="rounded-md bg-bg px-4 py-8">
            <h2 className="font-display text-3xl">{tab === "following" ? "Your circle is quiet" : "Nothing here yet"}</h2>
            <p className="mt-2 text-sm text-muted">
              {tab === "following"
                ? "Follow a few creators. Their posts will gather on this page."
                : "Check back after you follow someone, or post something of your own."}
            </p>
            {tab === "following" ? (
              <ul className="mt-6 space-y-3">
                {ideas.map((person) => (
                  <li key={person.userId} className="flex items-center gap-3">
                    <Link to="/c/$handle" params={{ handle: person.handle }} className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar src={person.avatarUrl} name={person.displayName} className="size-11 rounded-full" />
                      <span className="truncate">{person.displayName}</span>
                    </Link>
                    <Button
                      variant="secondary"
                      onClick={() => void run(() => setFollow({ data: { creatorId: person.userId, follow: true } }))}
                    >
                      Follow
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : (
        <PostList posts={posts} tease={tab === "discover"} />
      )}
    </section>
  );
}
