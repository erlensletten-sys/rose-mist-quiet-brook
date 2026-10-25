import type { CirclePayload, Person } from "@/lib/luma/types";

export function money(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function ago(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function peopleIndex(data: CirclePayload): Map<string, Person> {
  const map = new Map<string, Person>();
  for (const person of data.people) map.set(person.userId, person);
  map.set(data.me.userId, data.me);
  return map;
}

export function findHandle(data: CirclePayload, handle: string): Person | undefined {
  const key = handle.toLowerCase();
  if (data.me.handle.toLowerCase() === key) return data.me;
  return data.people.find((person) => person.handle.toLowerCase() === key);
}

export function threadKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const letters = parts.map((part) => part.charAt(0).toUpperCase()).join("");
  return letters || "L";
}
