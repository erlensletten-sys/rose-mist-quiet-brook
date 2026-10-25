import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@/components/luma/pages";

export const Route = createFileRoute("/_app/me")({ component: ProfilePage });
