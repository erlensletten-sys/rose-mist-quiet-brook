import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Compass,
  House,
  MessageCircle,
  Plus,
  Search,
  UserRound,
} from "lucide-react";
import { CheckoutSheet } from "@/components/luma/checkout";
import { useCircleData } from "@/components/luma/store";
import { Avatar } from "@/components/luma/ui";
import { money } from "@/lib/luma/format";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "discover", label: "Discover", search: {} },
  { id: "foryou", label: "For you", search: { tab: "foryou" as const } },
  { id: "following", label: "Following", search: { tab: "following" as const } },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const { data, toast, dismissToast } = useCircleData();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const tab = useRouterState({
    select: (state) => {
      const search = state.location.search as { tab?: string };
      return search.tab === "foryou" || search.tab === "following" ? search.tab : "discover";
    },
  });
  const unread = data.notifications.filter((note) => !note.read);
  const messageUnread = unread.filter((note) => note.kind === "message").length;
  const home = pathname === "/";
  const creators = data.people
    .filter((person) => person.isCreator)
    .sort((a, b) => Number(b.isLive) - Number(a.isLive))
    .slice(0, 12);
  const followed = new Set([...data.follows, ...data.subscriptions]);
  const suggested = data.people
    .filter((person) => person.isCreator && !followed.has(person.userId))
    .slice(0, 3);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <div className="mx-auto grid w-full max-w-6xl lg:grid-cols-[112px_minmax(0,40rem)_17.5rem] lg:gap-8 lg:px-6">
        <nav className="sticky top-0 hidden h-dvh flex-col gap-1 py-6 lg:flex" aria-label="Primary">
          <Link to="/" className="mb-6 px-2 font-display text-2xl italic">
            Luma
          </Link>
          <RailLink to="/" search={{}} active={home && tab === "discover"} icon={<Compass />} label="Discover" />
          <RailLink to="/" search={{ tab: "foryou" }} active={home && tab === "foryou"} icon={<House />} label="For you" />
          <RailLink
            to="/"
            search={{ tab: "following" }}
            active={home && tab === "following"}
            icon={<UserRound />}
            label="Following"
          />
          <RailLink to="/search" active={pathname === "/search"} icon={<Search />} label="Search" />
          <RailLink to="/alerts" active={pathname === "/alerts"} icon={<Bell />} label="Alerts" count={unread.length} />
          <RailLink
            to="/inbox"
            active={pathname.startsWith("/inbox")}
            icon={<MessageCircle />}
            label="Inbox"
            count={messageUnread}
          />
          <RailLink to="/create" active={pathname === "/create"} icon={<Plus />} label="Create" />
          <RailLink to="/me" active={pathname === "/me"} icon={<UserRound />} label="Profile" />
        </nav>
        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-line bg-bg pt-[env(safe-area-inset-top)] lg:hidden">
            <div className="flex h-14 items-center justify-between px-4">
              <Link to="/" className="font-display text-2xl italic">
                Luma
              </Link>
              <Link to="/alerts" className="relative grid h-11 w-11 place-items-center" aria-label="Alerts">
                <Bell className="size-5" />
                {unread.length > 0 ? (
                  <span className="absolute top-2 right-2 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-medium text-accent-fg tabular-nums">
                    {unread.length}
                  </span>
                ) : null}
              </Link>
            </div>
            {home ? (
              <div className="grid grid-cols-3 px-2">
                {TABS.map((item) => {
                  const active = tab === item.id;
                  return (
                    <Link
                      key={item.id}
                      to="/"
                      search={item.search}
                      className={cn(
                        "flex h-11 items-center justify-center border-b text-sm",
                        active ? "border-accent text-fg" : "border-transparent text-muted",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </header>
          {home ? (
            <div className="scroll-row flex gap-3 overflow-x-auto px-4 py-4 lg:hidden">
              {creators.map((person) => (
                <Link
                  key={person.userId}
                  to={person.isLive ? "/live/$handle" : "/c/$handle"}
                  params={{ handle: person.handle }}
                  className="w-16 shrink-0 text-center"
                >
                  <span className={cn("mx-auto block rounded-full p-0.5", person.isLive && "bg-danger")}>
                    <Avatar src={person.avatarUrl} name={person.displayName} className="size-14 rounded-full border-2 border-bg" />
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted">
                    {person.isLive ? "Live" : person.displayName.split(" ")[0]}
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
          <div className="px-4 pb-28 lg:px-0 lg:pb-16">{children}</div>
        </div>
        <aside className="sticky top-6 hidden self-start space-y-4 py-6 lg:block">
          <Link to="/me" className="flex items-center gap-3 rounded-xl bg-surface p-3">
            <Avatar src={data.me.avatarUrl} name={data.me.displayName} className="size-12 rounded-md" />
            <span>
              <span className="block font-medium">{data.me.displayName}</span>
              <span className="block text-sm text-muted">@{data.me.handle}</span>
            </span>
          </Link>
          <section className="rounded-xl bg-surface p-3">
            <h2 className="px-1 font-medium">Live now</h2>
            <div className="mt-2 space-y-1">
              {data.people.filter((person) => person.isLive).map((person) => (
                <Link
                  key={person.userId}
                  to="/live/$handle"
                  params={{ handle: person.handle }}
                  className="flex items-center gap-3 rounded-md px-1 py-2"
                >
                  <Avatar src={person.avatarUrl} name={person.displayName} className="size-10 rounded-full" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{person.displayName}</span>
                    <span className="block text-xs text-muted tabular-nums">{person.liveViewers} watching</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
          {suggested.length > 0 ? (
            <section className="rounded-xl bg-surface p-3">
              <h2 className="px-1 font-medium">Suggested</h2>
              <div className="mt-2 space-y-3">
                {suggested.map((person) => (
                  <div key={person.userId} className="flex items-center gap-3">
                    <Link to="/c/$handle" params={{ handle: person.handle }} className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar src={person.avatarUrl} name={person.displayName} className="size-10 rounded-full" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{person.displayName}</span>
                        <span className="block text-xs text-muted">{money(person.subscriptionCents)}/mo</span>
                      </span>
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          <p className="px-1 text-xs leading-5 text-muted">
            Discover features posts creators allowed, weighted by response, recency, your interests, and safety.
            Paid work shows only the teaser they approved. Repeated taps are not counted.
          </p>
        </aside>
      </div>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Primary"
      >
        <div className="grid grid-cols-5">
          <BottomLink to="/" search={{}} active={home} icon={<House />} label="Home" />
          <BottomLink to="/search" active={pathname === "/search"} icon={<Search />} label="Search" />
          <BottomLink to="/create" active={pathname === "/create"} icon={<Plus />} label="Create" />
          <BottomLink to="/inbox" active={pathname.startsWith("/inbox")} icon={<MessageCircle />} label="Inbox" count={messageUnread} />
          <BottomLink to="/me" active={pathname === "/me"} icon={<UserRound />} label="You" />
        </div>
      </nav>
      <CheckoutSheet />
      {toast ? (
        <div
          role="status"
          className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-md items-start justify-between gap-3 rounded-md bg-surface-2 px-4 py-3 text-sm lg:bottom-6"
        >
          <p>{toast}</p>
          <button type="button" className="shrink-0 text-muted" onClick={dismissToast}>
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  );
}

function RailLink({
  to,
  search,
  active,
  icon,
  label,
  count = 0,
}: {
  to: "/" | "/search" | "/alerts" | "/inbox" | "/create" | "/me";
  search?: { tab?: "foryou" | "following" };
  active: boolean;
  icon: ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <Link
      to={to}
      search={search}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-2 text-sm",
        active ? "bg-surface text-fg" : "text-muted",
      )}
    >
      <span className="relative">
        <span className="grid size-5 place-items-center [&_svg]:size-5">{icon}</span>
        {count > 0 ? <span className="absolute -top-1 -right-2 size-2 rounded-full bg-accent" /> : null}
      </span>
      <span className="text-xs">{label}</span>
    </Link>
  );
}

function BottomLink({
  to,
  search,
  active,
  icon,
  label,
  count = 0,
}: {
  to: "/" | "/search" | "/inbox" | "/create" | "/me";
  search?: { tab?: "foryou" | "following" };
  active: boolean;
  icon: ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <Link
      to={to}
      search={search}
      className={cn("relative flex h-16 flex-col items-center justify-center gap-1 text-xs", active ? "text-fg" : "text-muted")}
    >
      <span className="relative [&_svg]:size-5">
        {icon}
        {count > 0 ? (
          <span className="absolute -top-1 -right-2 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-medium text-accent-fg tabular-nums">
            {count}
          </span>
        ) : null}
      </span>
      {label}
    </Link>
  );
}
