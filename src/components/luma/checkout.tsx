import { useState } from "react";
import { checkout } from "@/lib/luma/api";
import { money, peopleIndex } from "@/lib/luma/format";
import type { PayKind, Post } from "@/lib/luma/types";
import { useCircleData } from "@/components/luma/store";
import { Button } from "@/components/luma/ui";

const TIPS = [300, 500, 1000];

export function PayButton({
  post,
  creatorId,
  creatorName,
}: {
  post?: Post;
  creatorId: string;
  creatorName: string;
}) {
  const { data, openPay } = useCircleData();
  const creator = peopleIndex(data).get(creatorId);
  if (post?.access === "subscriber" || (!post && creator)) {
    const cents = creator?.subscriptionCents ?? 0;
    return (
      <Button
        type="button"
        onClick={() =>
          openPay({
            kind: "subscription",
            creatorId,
            title: `Membership · ${creatorName}`,
            amountCents: cents,
          })
        }
      >
        Subscribe {money(cents)}
      </Button>
    );
  }
  if (post?.access === "unlock") {
    return (
      <Button
        type="button"
        onClick={() =>
          openPay({
            kind: "unlock",
            creatorId,
            postId: post.id,
            title: `Unlock · ${creatorName}`,
            amountCents: post.priceCents,
          })
        }
      >
        Unlock {money(post.priceCents)}
      </Button>
    );
  }
  return null;
}

export function TipButton({ creatorId, creatorName, postId }: { creatorId: string; creatorName: string; postId?: string }) {
  const { openPay } = useCircleData();
  return (
    <button
      type="button"
      className="h-11 px-3 text-sm text-muted"
      onClick={() =>
        openPay({
          kind: "tip",
          creatorId,
          postId,
          title: `Tip · ${creatorName}`,
          amountCents: 500,
        })
      }
    >
      Tip
    </button>
  );
}

export function CheckoutSheet() {
  const { pay, closePay, run, data } = useCircleData();
  const [amount, setAmount] = useState(500);
  const [pending, setPending] = useState(false);
  if (!pay) return null;
  const gross = pay.kind === "tip" ? amount : (pay.amountCents ?? 0);
  const fee = Math.round(gross * 0.2);
  const reserve = Math.round((gross - fee) * 0.1);
  const payable = gross - fee - reserve;
  const creator = peopleIndex(data).get(pay.creatorId);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="pay-title">
      <button type="button" className="absolute inset-0 bg-bg/80" aria-label="Close checkout" onClick={closePay} />
      <div className="relative m-0 w-full max-w-md rounded-t-xl bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:rounded-xl">
        <div className="rounded-md bg-bg p-4">
          <p className="text-xs text-muted">Hosted checkout</p>
          <h2 id="pay-title" className="mt-1 font-display text-3xl">
            {pay.title}
          </h2>
          <p className="mt-2 text-sm text-muted">
            Card details stay with the adult-content acquirer. Luma never stores the number. This preview records the
            ledger and does not send a charge.
          </p>
          {pay.kind === "tip" ? (
            <div className="mt-4 flex gap-2">
              {TIPS.map((cents) => (
                <button
                  key={cents}
                  type="button"
                  className={`h-11 flex-1 rounded-md text-sm ${amount === cents ? "bg-accent text-accent-fg" : "bg-surface text-fg"}`}
                  onClick={() => setAmount(cents)}
                >
                  {money(cents)}
                </button>
              ))}
            </div>
          ) : null}
          <dl className="mt-4 space-y-2 text-sm tabular-nums">
            <Line label="Amount" value={money(gross)} />
            <Line label="Tax" value={money(0)} />
            <Line label="Platform fee" value={money(fee)} />
            <Line label="Reserve" value={money(reserve)} />
            <Line label={`${creator?.displayName ?? "Creator"} receives`} value={money(payable)} />
          </dl>
          <Button
            className="mt-5 w-full"
            disabled={pending}
            onClick={() => {
              setPending(true);
              void run(() =>
                checkout({
                  data: {
                    kind: pay.kind as PayKind,
                    creatorId: pay.creatorId,
                    postId: pay.postId ?? "",
                    amountCents: gross,
                  },
                }),
              ).then((ok) => {
                setPending(false);
                if (ok) closePay();
              });
            }}
          >
            {pending ? "Recording…" : "Confirm payment"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
