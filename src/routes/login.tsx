import { useEffect, useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { FrontDoor } from "@/components/luma/front-door";
import { SkeletonScreen } from "@/components/luma/ui";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { user, isPending } = useCurrentUserState();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || isPending) return <SkeletonScreen />;
  if (user) return <Navigate to="/" />;
  return <FrontDoor />;
}
