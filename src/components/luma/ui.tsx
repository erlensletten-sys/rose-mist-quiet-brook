import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { loadMedia } from "@/lib/luma/media";
import { initials } from "@/lib/luma/format";
import { cn } from "@/lib/utils";

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-transform duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "pride-gradient text-white font-semibold shadow-lg shadow-pink-500/20",
        variant === "secondary" && "border border-line bg-surface-2 text-fg hover:border-accent/50",
        variant === "ghost" && "text-fg hover:bg-surface-2",
        variant === "danger" && "bg-danger text-white",
        className,
      )}
      {...props}
    />
  );
}

export function TextField({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = props.id ?? props.name;
  return (
    <label className="block text-sm" htmlFor={id}>
      <span className="mb-2 block font-medium">{label}</span>
      <input
        id={id}
        className="h-11 w-full rounded-md border border-line bg-surface-2 px-3 text-base text-fg outline-none placeholder:text-muted focus:border-accent"
        {...props}
      />
      {hint ? <span className="mt-2 block text-muted">{hint}</span> : null}
    </label>
  );
}

export function TextArea({
  label,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const id = props.id ?? props.name;
  return (
    <label className="block text-sm" htmlFor={id}>
      <span className="mb-2 block font-medium">{label}</span>
      <textarea
        id={id}
        className="min-h-28 w-full rounded-md border border-line bg-surface-2 px-3 py-3 text-base text-fg outline-none placeholder:text-muted focus:border-accent"
        {...props}
      />
    </label>
  );
}

export function Avatar({
  src,
  name,
  className,
}: {
  src?: string;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className={cn("grid place-items-center bg-surface-2 text-sm font-medium text-muted", className)}>
        {initials(name)}
      </span>
    );
  }
  return (
    <img src={src} alt="" className={cn("object-cover", className)} onError={() => setFailed(true)} />
  );
}

export function useResolvedSrc(src: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(src && !src.startsWith("idb:") ? src : null);
  useEffect(() => {
    if (!src) {
      setUrl(null);
      return;
    }
    if (!src.startsWith("idb:")) {
      setUrl(src);
      return;
    }
    let revoke: string | null = null;
    let cancel = false;
    loadMedia(src.slice(4))
      .then((next) => {
        if (cancel) {
          if (next) URL.revokeObjectURL(next);
          return;
        }
        revoke = next;
        setUrl(next);
      })
      .catch(() => {
        if (!cancel) setUrl(null);
      });
    return () => {
      cancel = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [src]);
  return url;
}

export function SkeletonScreen() {
  return (
    <main className="min-h-dvh bg-bg px-4 pt-10 text-fg">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="h-8 w-36 animate-pulse rounded-md bg-surface-2" />
        <div className="h-11 w-full animate-pulse rounded-md bg-surface" />
        <div className="aspect-[3/4] animate-pulse rounded-xl bg-surface" />
      </div>
    </main>
  );
}

export function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-xl bg-surface p-3">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <h2 className="font-display text-2xl">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Chip({
  pressed,
  children,
  onClick,
}: {
  pressed: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "h-11 rounded-full px-4 text-sm",
        pressed ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg",
      )}
    >
      {children}
    </button>
  );
}
