import { useEffect, useState } from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { CircleGate } from "@/components/luma/gate";
import { FrontDoor } from "@/components/luma/front-door";
import { Shell } from "@/components/luma/shell";
import { CircleProvider } from "@/components/luma/store";
import { SkeletonScreen } from "@/components/luma/ui";

export const Route = createFileRoute("/_app")({ component: AppLayout });

function AppLayout() {
  const { user, isPending } = useCurrentUserState();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || isPending) return <SkeletonScreen />;
  if (!user) return <FrontDoor />;
  return (
    <CircleProvider displayName={user.displayName ?? ""}>
      <CircleGate>
        <Shell>
          <Outlet />
        </Shell>
      </CircleGate>
    </CircleProvider>
  );
}
