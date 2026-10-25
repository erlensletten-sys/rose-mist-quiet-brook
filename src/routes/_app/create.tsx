import { createFileRoute } from "@tanstack/react-router";
import { CreatePage } from "@/components/luma/pages";

export const Route = createFileRoute("/_app/create")({ component: CreatePage });
