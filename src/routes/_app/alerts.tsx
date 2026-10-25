import { createFileRoute } from "@tanstack/react-router";
import { AlertsPage } from "@/components/luma/pages";

export const Route = createFileRoute("/_app/alerts")({ component: AlertsPage });
