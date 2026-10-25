import { createFileRoute } from "@tanstack/react-router";
import { InboxPage } from "@/components/luma/pages";

export const Route = createFileRoute("/_app/inbox")({ component: InboxPage });
