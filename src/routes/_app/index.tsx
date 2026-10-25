import { createFileRoute } from "@tanstack/react-router";
import { FeedPage } from "@/components/luma/feed";
import type { FeedTab } from "@/lib/luma/rank";

type FeedSearch = { tab?: FeedTab };

export const Route = createFileRoute("/_app/")({
  validateSearch: (search: Record<string, unknown>): FeedSearch => {
    const tab = search.tab;
    if (tab === "foryou" || tab === "following" || tab === "discover") return { tab };
    return {};
  },
  component: HomePage,
});

function HomePage() {
  const { tab } = Route.useSearch();
  return <FeedPage tab={tab ?? "discover"} />;
}
