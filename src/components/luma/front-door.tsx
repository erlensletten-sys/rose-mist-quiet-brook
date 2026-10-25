import { useState, type FormEvent } from "react";
import { GROK_PROVIDERS, authClient, signIn } from "@/lib/auth/client";
import { Avatar, Button, TextField } from "@/components/luma/ui";

const FACES = [
  { src: "/media/solene.jpg", name: "Solène" },
  { src: "/media/amari.jpg", name: "Amari" },
  { src: "/media/juniper.jpg", name: "Juniper" },
];

export function FrontDoor() {
  const [mode, setMode] = useState<"join" | "enter">("join");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adult, setAdult] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (mode === "join" && !adult) {
      setError("Confirm that you are 18 or older.");
      return;
    }
    setPending(true);
    try {
      const result =
        mode === "join"
          ? await authClient.signUp.email({ email, password, name, callbackURL: "/" })
          : await authClient.signIn.email({ email, password, callbackURL: "/" });
      if (result.error) {
        setError(result.error.message ?? "That did not work.");
        setPending(false);
        return;
      }
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
      setPending(false);
    }
  }

  return (
    <main className="min-h-dvh bg-bg text-fg">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-8 lg:grid-cols-2 lg:py-16">
        <section>
          <p className="text-sm text-muted">18+ membership</p>
          <h1 className="mt-3 font-display text-5xl leading-tight lg:text-6xl">Luma Circle</h1>
          <p className="mt-4 max-w-md text-lg text-muted">
            A circle for trans, nonbinary, and pan adults. Follow freely. Pay only when a creator asks. Your legal
            name stays off the profile.
          </p>
          <ul className="mt-8 max-w-md space-y-3 text-sm text-muted">
            <li>Discover, For you, and Following are ordinary pages until you open a photo or video.</li>
            <li>Posts can be free, for members, or a one-off unlock. Teasers never exceed what the creator allowed.</li>
            <li>Messages, tips, block, mute, report, and a ledger you can read.</li>
          </ul>
          <div className="mt-8 flex gap-3">
            {FACES.map((face) => (
              <figure key={face.name} className="w-24">
                <Avatar src={face.src} name={face.name} className="aspect-[3/4] w-full rounded-lg" />
                <figcaption className="mt-2 text-xs text-muted">{face.name}</figcaption>
              </figure>
            ))}
          </div>
        </section>
        <section className="rounded-xl bg-surface p-3">
          <div className="rounded-md bg-bg p-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`h-11 rounded-md text-sm font-medium ${mode === "join" ? "bg-accent text-accent-fg" : "text-muted"}`}
                onClick={() => setMode("join")}
              >
                Create account
              </button>
              <button
                type="button"
                className={`h-11 rounded-md text-sm font-medium ${mode === "enter" ? "bg-accent text-accent-fg" : "text-muted"}`}
                onClick={() => setMode("enter")}
              >
                Sign in
              </button>
            </div>
            <form className="mt-4 space-y-4" onSubmit={(event) => void onSubmit(event)}>
              {mode === "join" ? (
                <TextField label="Name" name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required />
              ) : null}
              <TextField
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              <TextField
                label="Password"
                name="password"
                type="password"
                autoComplete={mode === "join" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                hint="At least 8 characters."
                required
              />
              {mode === "join" ? (
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" className="mt-1 size-4" checked={adult} onChange={(event) => setAdult(event.target.checked)} />
                  I am 18 or older.
                </label>
              ) : null}
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <Button className="w-full" type="submit" disabled={pending}>
                {pending ? "Please wait…" : mode === "join" ? "Create account" : "Sign in"}
              </Button>
            </form>
            <div className="my-4 h-px bg-line" />
            <div className="space-y-2">
              {GROK_PROVIDERS.map((provider) => (
                <Button
                  key={provider.providerId}
                  variant="secondary"
                  className="w-full"
                  type="button"
                  onClick={() => {
                    setError("");
                    void signIn(provider.providerId, { callbackURL: "/" }).catch((err: unknown) => {
                      setError(err instanceof Error ? err.message : "Sign-in failed");
                    });
                  }}
                >
                  Continue with {provider.label}
                </Button>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted">
              Card numbers are never stored here. Payments, when you publish for real, go through a hosted adult-content
              checkout. This preview records the ledger only.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
