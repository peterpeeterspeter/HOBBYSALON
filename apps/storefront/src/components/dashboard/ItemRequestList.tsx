import { updateInboxItemStatusAction } from "@/app/actions/dashboard-inbox";
import { Button } from "@/components/ui/button";
import { EmptyBlock } from "@/components/dashboard/ui";
import { buildReplyMailto, type InboxItem } from "@/lib/dashboard/offer-status";
import { formatDashboardDate } from "@/lib/dashboard/load";

type StatusChoice = { value: string; label: string };

const CHOICES: Record<InboxItem["source"], { handled: StatusChoice; others: StatusChoice[] }> = {
  creatie: {
    handled: { value: "contacted", label: "Behandeld" },
    others: [
      { value: "accepted", label: "Verkocht" },
      { value: "declined", label: "Niet verkocht" },
    ],
  },
  workshop: {
    handled: { value: "contacted", label: "Behandeld" },
    others: [
      { value: "confirmed", label: "Boeking bevestigd" },
      { value: "cancelled", label: "Geannuleerd" },
    ],
  },
  event: {
    handled: { value: "contacted", label: "Behandeld" },
    others: [
      { value: "accepted", label: "Standplaats gegeven" },
      { value: "declined", label: "Afgewezen" },
    ],
  },
};

const STATUS_LABEL: Record<string, string> = {
  new: "Nieuw",
  contacted: "Behandeld",
  accepted: "Geaccepteerd",
  confirmed: "Bevestigd",
  declined: "Afgewezen",
  cancelled: "Geannuleerd",
};

export type ItemRequest = InboxItem & { status: string };

/** Requests for one workshop, event or creation, shown on its edit page. */
export function ItemRequestList({
  items,
  returnTo,
  emptyText,
}: {
  items: ItemRequest[];
  returnTo: string;
  emptyText: string;
}) {
  if (items.length === 0) {
    return <EmptyBlock title="Nog geen aanvragen">{emptyText}</EmptyBlock>;
  }

  return (
    <ul className="space-y-4">
      {items.map((item) => {
        const choices = CHOICES[item.source];
        return (
          <li
            key={item.id}
            className={
              item.isNew
                ? "rounded-2xl border-2 border-[var(--accent)]/40 bg-[var(--card)] p-5"
                : "rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"
            }
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xl font-bold text-[var(--foreground)]">
                {item.name || item.email}
              </p>
              <p className="text-base font-semibold text-[var(--muted)]">
                {STATUS_LABEL[item.status] ?? item.status}, {formatDashboardDate(item.createdAt)}
              </p>
            </div>
            <p className="text-lg text-[var(--muted)]">{item.email}</p>
            {item.message ? (
              <p className="mt-3 max-w-[65ch] whitespace-pre-wrap text-lg leading-relaxed text-[var(--foreground)]">
                {item.message}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <a href={buildReplyMailto(item)}>Antwoorden per e-mail</a>
              </Button>
              {[...(item.isNew ? [choices.handled] : []), ...choices.others]
                .filter((choice) => choice.value !== item.status)
                .map((choice) => (
                  <form key={choice.value} action={updateInboxItemStatusAction}>
                    <input type="hidden" name="source" value={item.source} />
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="status" value={choice.value} />
                    <input type="hidden" name="return_to" value={returnTo} />
                    <Button type="submit" variant="secondary" size="lg">
                      {choice.label}
                    </Button>
                  </form>
                ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
