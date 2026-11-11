import type { ShippingPolicyNotice } from '@/lib/commerce/medusa/shipping';
const money = (amount: number) =>
  new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(
    amount
  );
export function ShippingProgress({
  summaries,
  frozen = false
}: {
  summaries: ShippingPolicyNotice[];
  frozen?: boolean;
}) {
  if (frozen) return null;
  return (
    <div className="space-y-2 text-sm text-[var(--muted)]">
      {summaries
        .filter((s) => s.available && s.remaining_amount != null)
        .map((s) => (
          <p key={`${s.seller_id}-${s.country_code}`}>
            {s.qualified
              ? 'Gratis standaardverzending beschikbaar'
              : `Nog ${money(s.remaining_amount!)} voor gratis standaardverzending`}{' '}
            bij {s.seller_name ?? 'deze verkoper'} naar{' '}
            {s.country_code === 'be' ? 'België' : 'Nederland'}.
          </p>
        ))}
    </div>
  );
}
