import { createFileRoute } from "@tanstack/react-router";
import { SearchPage } from "@/components/luma/pages";

export const Route = createFileRoute("/_app/search")({ component: SearchPage });
