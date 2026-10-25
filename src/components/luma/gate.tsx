import type { ReactNode } from "react";
import { AgeScreen, TuneScreen } from "@/components/luma/onboarding";
import { useCircle } from "@/components/luma/store";
import { Button, SkeletonScreen } from "@/components/luma/ui";

export function CircleGate({ children }: { children: ReactNode }) {
  const { data, loading, error, refresh } = useCircle();
  if (loading && !data) return <SkeletonScreen />;
  if (!data && error) {
    return (
      <main className="grid min-h-dvh place-items-center bg-bg px-6 text-center text-fg">
        <div className="max-w-sm">
          <h1 className="font-display text-3xl">Could not open Luma</h1>
          <p className="mt-3 text-sm text-muted">{error}</p>
          <Button className="mt-6" onClick={() => void refresh().catch(() => undefined)}>
            Try again
          </Button>
        </div>
      </main>
    );
  }
  if (!data) return <SkeletonScreen />;
  if (!data.me.ageOk) return <AgeScreen />;
  if (!data.me.tuned) return <TuneScreen />;
  return children;
}
