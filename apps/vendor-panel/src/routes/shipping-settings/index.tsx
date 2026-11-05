import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Container, Heading, Input, Label, Text } from '@medusajs/ui';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { fetchQuery } from '../../lib/client';

type Policy = {
  country_code: string;
  free_shipping_threshold: number | null;
  shipping_option_ids: string[];
};
type Option = {
  id: string;
  country_code: string;
  name: string;
  shipping_profile_name?: string;
  prices: { amount: number }[];
};
type Data = { policies: Policy[]; options: Option[] };
const key = ['seller_shipping_policies'];
const money = (amount: number) =>
  new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(
    amount
  );
export function Component() {
  const { t } = useTranslation();
  const query = useQuery<Data>({
    queryKey: key,
    queryFn: () => fetchQuery('/vendor/shipping-policies', { method: 'GET' })
  });
  return (
    <Container className="space-y-6">
      <Heading>{t('shippingSettings.title')}</Heading>
      <Text>
        Stel per land in vanaf welk productbedrag je standaardverzending gratis
        aanbiedt. Het bedrag telt na korting, inclusief btw.
      </Text>
      {query.isPending && <Text role="status">Verzendinstellingen laden…</Text>}
      {query.isError && (
        <div role="alert">
          <Text>Verzendinstellingen konden niet worden geladen.</Text>
          <Button variant="secondary" onClick={() => query.refetch()}>
            Opnieuw proberen
          </Button>
        </div>
      )}
      {query.data &&
        ['be', 'nl'].map((country) => (
          <CountryForm
            key={country}
            country={country}
            policy={query.data!.policies.find(
              (p) => p.country_code === country
            )}
            options={query.data!.options.filter(
              (o) => o.country_code === country
            )}
          />
        ))}
      <Link
        className="text-ui-fg-interactive underline"
        to="/settings/locations"
      >
        Bestaande verzendtarieven en zones beheren
      </Link>
    </Container>
  );
}
function CountryForm({
  country,
  policy,
  options
}: {
  country: string;
  policy?: Policy;
  options: Option[];
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [value, setValue] = useState(
    policy?.free_shipping_threshold == null
      ? ''
      : String(policy.free_shipping_threshold).replace('.', ',')
  );
  const [selected, setSelected] = useState(policy?.shipping_option_ids ?? []);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const mutation = useMutation({
    mutationFn: (body: object) =>
      fetchQuery(`/vendor/shipping-policies/${country}`, {
        method: 'POST',
        body
      }),
    onSuccess: async (result) => {
      if (!result?.policy) throw new Error('Opslaan kon niet worden bevestigd');
      await client.invalidateQueries({ queryKey: key });
      setSaved(true);
    },
    onError: (e: Error) =>
      setError(e.message || 'Opslaan mislukt. Probeer het opnieuw.')
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaved(false);
    const text = value.trim().replace(',', '.');
    if (
      text &&
      (!/^\d+(?:\.\d{1,2})?$/.test(text) ||
        !Number.isSafeInteger(Math.round(Number(text) * 100)))
    ) {
      setError('Gebruik een bedrag vanaf 0 met maximaal twee decimalen.');
      return;
    }
    mutation.mutate({
      free_shipping_threshold: text === '' ? null : Number(text),
      shipping_option_ids: selected.filter((id) =>
        options.some((o) => o.id === id)
      )
    });
  };
  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border p-5">
      <Heading level="h2">{country === 'be' ? 'België' : 'Nederland'}</Heading>
      <div className="space-y-2">
        <Label htmlFor={`threshold-${country}`}>
          {t('shippingSettings.threshold')}
        </Label>
        <Input
          id={`threshold-${country}`}
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          aria-describedby={`help-${country}`}
          disabled={mutation.isPending}
        />
        <Text id={`help-${country}`} size="small">
          Leeg laten schakelt gratis verzending uit. Vul 0 in voor altijd
          gratis.
        </Text>
      </div>
      <fieldset disabled={mutation.isPending} className="space-y-3">
        <legend className="mb-2 font-medium">
          Toepassen op standaardbezorging
        </legend>
        <Text size="small">
          Selecteer alleen standaardbezorging. Express, afhalen en retouren
          vallen buiten deze instelling.
        </Text>
        {options.length === 0 && (
          <Text size="small">
            Er zijn nog geen vaste bezorgmethodes voor dit land. Maak ze aan bij
            verzendtarieven en zones; Standaardbezorging kan je vervolgens hier
            selecteren.
          </Text>
        )}
        {options.map((o) => (
          <Label key={o.id} className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selected.includes(o.id)}
              onChange={(e) => {
                setSelected((ids) =>
                  e.target.checked
                    ? [...ids, o.id]
                    : ids.filter((id) => id !== o.id)
                );
                setSaved(false);
              }}
            />
            <span>
              {o.name} — {o.prices.map((p) => money(p.amount)).join(' / ')}
              {o.shipping_profile_name && (
                <span className="block text-ui-fg-subtle text-xs">
                  {o.shipping_profile_name.replace(/^sel_[^:]+:/, '')}
                </span>
              )}
            </span>
          </Label>
        ))}
      </fieldset>
      {error && (
        <Text role="alert" className="text-ui-fg-error">
          {error}
        </Text>
      )}
      {saved && <Text role="status">Verzendinstellingen opgeslagen.</Text>}
      <Button type="submit" isLoading={mutation.isPending}>
        {t('shippingSettings.save')}
      </Button>
    </form>
  );
}
