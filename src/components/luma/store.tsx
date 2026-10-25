import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ensureProfile, getCircle } from "@/lib/luma/api";
import type { ActionResult, CirclePayload, PayRequest } from "@/lib/luma/types";

type CircleContextValue = {
  data: CirclePayload | null;
  loading: boolean;
  error: string;
  toast: string;
  dismissToast: () => void;
  refresh: () => Promise<void>;
  run: (task: () => Promise<ActionResult | void>) => Promise<boolean>;
  pay: PayRequest | null;
  openPay: (request: PayRequest) => void;
  closePay: () => void;
};

const CircleContext = createContext<CircleContextValue | null>(null);

export function CircleProvider({
  displayName,
  children,
}: {
  displayName: string;
  children: ReactNode;
}) {
  const [data, setData] = useState<CirclePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [pay, setPay] = useState<PayRequest | null>(null);

  const refresh = useCallback(async () => {
    const next = await getCircle();
    setData(next);
    setError("");
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const ensured = await ensureProfile({ data: { displayName } });
        if (!ensured.ok) throw new Error(ensured.error);
        const next = await getCircle();
        if (!cancel) setData(next);
      } catch (err) {
        if (!cancel) setError(err instanceof Error ? err.message : "Could not open your circle");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [displayName]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refresh().catch(() => undefined);
    }, 25000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const run = useCallback(
    async (task: () => Promise<ActionResult | void>) => {
      try {
        const result = await task();
        if (result && result.ok === false) {
          setToast(result.error);
          return false;
        }
        await refresh();
        return true;
      } catch (err) {
        setToast(err instanceof Error ? err.message : "Something went wrong");
        return false;
      }
    },
    [refresh],
  );

  const value = useMemo<CircleContextValue>(
    () => ({
      data,
      loading,
      error,
      toast,
      dismissToast: () => setToast(""),
      refresh,
      run,
      pay,
      openPay: setPay,
      closePay: () => setPay(null),
    }),
    [data, loading, error, toast, refresh, run, pay],
  );

  return <CircleContext.Provider value={value}>{children}</CircleContext.Provider>;
}

export function useCircle() {
  const value = useContext(CircleContext);
  if (!value) throw new Error("Circle is not ready");
  return value;
}

export function useCircleData() {
  const value = useCircle();
  if (!value.data) throw new Error("Circle is still loading");
  return { ...value, data: value.data };
}
