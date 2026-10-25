import { createFileRoute } from "@tanstack/react-router";
import { CreatorPage } from "@/components/luma/pages";

export const Route = createFileRoute("/_app/c/$handle")({
  component: Page,
});

function Page() {
  const { handle } = Route.useParams();
  return <CreatorPage handle={handle} />;
}
