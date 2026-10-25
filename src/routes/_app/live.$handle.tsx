import { createFileRoute } from "@tanstack/react-router";
import { LivePage } from "@/components/luma/pages";

export const Route = createFileRoute("/_app/live/$handle")({
  component: Page,
});

function Page() {
  const { handle } = Route.useParams();
  return <LivePage handle={handle} />;
}
