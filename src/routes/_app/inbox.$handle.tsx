import { createFileRoute } from "@tanstack/react-router";
import { ThreadPage } from "@/components/luma/pages";

export const Route = createFileRoute("/_app/inbox/$handle")({
  component: Page,
});

function Page() {
  const { handle } = Route.useParams();
  return <ThreadPage handle={handle} />;
}
