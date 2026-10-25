import { useState } from "react";
import { confirmAge, tuneProfile } from "@/lib/luma/api";
import { IDENTITIES, INTERESTS } from "@/lib/luma/types";
import { useCircle } from "@/components/luma/store";
import { Button, Chip } from "@/components/luma/ui";

export function AgeScreen() {
  const { run } = useCircle();
  const [date, setDate] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 py-10 text-fg">
      <form
        className="w-full max-w-md rounded-xl bg-surface p-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!agreed) return;
          setPending(true);
          void run(() => confirmAge({ data: { date } })).finally(() => setPending(false));
        }}
      >
        <div className="rounded-md bg-bg px-4 py-6">
          <p className="text-sm text-muted">Age check</p>
          <h1 className="mt-2 font-display text-4xl">Adults only.</h1>
          <p className="mt-3 text-sm text-muted">
            Luma is for people 18 and over. We keep the year, not a copy of an ID. Creator payouts use a
            separate review that fans never see.
          </p>
          <label className="mt-6 block text-sm font-medium" htmlFor="dob">
            Date of birth
            <input
              id="dob"
              type="date"
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-line bg-surface-2 px-3 text-base"
            />
          </label>
          <label className="mt-4 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-4"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
            />
            I confirm I am 18 or older.
          </label>
          <Button className="mt-6 w-full" type="submit" disabled={!agreed || !date || pending}>
            {pending ? "Checking…" : "Continue"}
          </Button>
        </div>
      </form>
    </main>
  );
}

export function TuneScreen() {
  const { run } = useCircle();
  const [pronouns, setPronouns] = useState("");
  const [identities, setIdentities] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [pending, setPending] = useState(false);

  function toggle(list: string[], value: string, set: (next: string[]) => void) {
    set(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  return (
    <main className="min-h-dvh bg-bg px-4 py-8 text-fg">
      <form
        className="mx-auto max-w-lg"
        onSubmit={(event) => {
          event.preventDefault();
          setPending(true);
          void run(() => tuneProfile({ data: { pronouns, identities, interests } })).finally(() =>
            setPending(false),
          );
        }}
      >
        <p className="text-sm text-muted">Your circle</p>
        <h1 className="mt-2 font-display text-4xl">What should we bring forward?</h1>
        <p className="mt-3 text-sm text-muted">
          Interests shape For you. Identity stays on your profile only if you choose it. You can change both later.
        </p>
        <fieldset className="mt-8">
          <legend className="text-sm font-medium">Interests</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {INTERESTS.map((item) => (
              <Chip key={item} pressed={interests.includes(item)} onClick={() => toggle(interests, item, setInterests)}>
                {item}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset className="mt-8">
          <legend className="text-sm font-medium">Identity on your profile</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {IDENTITIES.map((item) => (
              <Chip
                key={item}
                pressed={identities.includes(item)}
                onClick={() => toggle(identities, item, setIdentities)}
              >
                {item}
              </Chip>
            ))}
          </div>
        </fieldset>
        <label className="mt-8 block text-sm font-medium" htmlFor="pronouns">
          Pronouns
          <input
            id="pronouns"
            value={pronouns}
            onChange={(event) => setPronouns(event.target.value)}
            placeholder="they/them"
            className="mt-2 h-11 w-full rounded-md border border-line bg-surface px-3 text-base"
          />
        </label>
        <div className="mt-8 flex gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Enter Discover"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setPending(true);
              void run(() => tuneProfile({ data: { pronouns: "", identities: [], interests: [] } })).finally(() =>
                setPending(false),
              );
            }}
          >
            Skip
          </Button>
        </div>
      </form>
    </main>
  );
}
