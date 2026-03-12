import { getAuthUser } from "@/lib/auth/session";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { listDomainsBySort } from "@/lib/platform/queries/domains";
import { createPlatformClient } from "@/lib/platform/client";
import { saveCreatorProfileAction } from "@/app/actions/dashboard";
import { CardShell } from "@/components/ui/card-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

const CREATOR_TYPES: Array<{ value: string; label: string }> = [
  { value: "maker", label: "Maker" },
  { value: "workshopgever", label: "Workshopgever" },
  { value: "supplier", label: "Leverancier" },
  { value: "content_creator", label: "Content maker" },
  { value: "organizer", label: "Organisator" },
];

export default async function DashboardCreatorPage({ searchParams }: Props) {
  const user = await getAuthUser();
  const creator = user ? await getCreatorByUserId(user.id) : null;
  const domains = await listDomainsBySort();
  const selectedDomainIds = creator
    ? await (async () => {
        const supabase = createPlatformClient();
        const { data } = await supabase
          .from("creator_domains")
          .select("domain_id")
          .eq("creator_id", creator.id);
        return new Set((data ?? []).map((row) => row.domain_id as string));
      })()
    : new Set<string>();
  const { success, error } = await searchParams;

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold text-[var(--foreground)]">Creator dashboard</h1>
      <p className="text-[var(--muted)]">Beheer je creator-profiel en publieke info.</p>

      {success && (
        <p className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </p>
      )}
      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <CardShell variant="default" padding="lg">
        <form action={saveCreatorProfileAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            name="display_name"
            label="Naam *"
            required
            defaultValue={creator?.display_name ?? ""}
          />
          <Input
            name="slug"
            label="Slug"
            defaultValue={creator?.slug ?? ""}
          />
          <Input
            name="business_name"
            label="Bedrijfsnaam"
            defaultValue={creator?.business_name ?? ""}
          />
          <Input
            name="city"
            label="Stad"
            defaultValue={creator?.city ?? ""}
          />
          <Input
            name="website_url"
            label="Website"
            defaultValue={creator?.website_url ?? ""}
          />
          <Input
            name="instagram_url"
            label="Instagram"
            defaultValue={creator?.instagram_url ?? ""}
          />
          <Input
            name="facebook_url"
            label="Facebook"
            defaultValue={creator?.facebook_url ?? ""}
          />
          <Input
            name="avatar_url"
            label="Avatar URL"
            defaultValue={creator?.avatar_url ?? ""}
          />
          <Input
            name="banner_url"
            label="Banner URL"
            defaultValue={creator?.banner_url ?? ""}
          />
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Bio</label>
            <textarea
              name="bio"
              rows={4}
              defaultValue={creator?.bio ?? ""}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
            />
          </div>
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Rollen</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {CREATOR_TYPES.map((type) => (
              <label key={type.value} className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-1.5">
                <input
                  type="checkbox"
                  name="creator_types"
                  value={type.value}
                  defaultChecked={creator?.creator_types?.includes(type.value)}
                />
                <span className="text-sm">{type.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Hobby-domeinen</legend>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Deze domeinen bepalen waar je zichtbaar bent op discovery-pagina&apos;s.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            {domains.map((domain) => (
              <label
                key={domain.id}
                className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-1.5"
              >
                <input
                  type="checkbox"
                  name="domain_ids"
                  value={domain.id}
                  defaultChecked={selectedDomainIds.has(domain.id)}
                />
                <span className="text-sm">{domain.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <Button type="submit" className="mt-6">
          Profiel opslaan
        </Button>
        </form>
      </CardShell>
    </section>
  );
}
