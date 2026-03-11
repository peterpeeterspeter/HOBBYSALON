import { getAuthUser } from "@/lib/auth/session";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { saveCreatorProfileAction } from "@/app/actions/dashboard";

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

      <form action={saveCreatorProfileAction} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Naam *</span>
            <input
              name="display_name"
              required
              defaultValue={creator?.display_name ?? ""}
              className="w-full rounded-md border border-[var(--border)] px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Slug</span>
            <input
              name="slug"
              defaultValue={creator?.slug ?? ""}
              className="w-full rounded-md border border-[var(--border)] px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Bedrijfsnaam</span>
            <input
              name="business_name"
              defaultValue={creator?.business_name ?? ""}
              className="w-full rounded-md border border-[var(--border)] px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Stad</span>
            <input
              name="city"
              defaultValue={creator?.city ?? ""}
              className="w-full rounded-md border border-[var(--border)] px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Website</span>
            <input
              name="website_url"
              defaultValue={creator?.website_url ?? ""}
              className="w-full rounded-md border border-[var(--border)] px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Instagram</span>
            <input
              name="instagram_url"
              defaultValue={creator?.instagram_url ?? ""}
              className="w-full rounded-md border border-[var(--border)] px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Avatar URL</span>
            <input
              name="avatar_url"
              defaultValue={creator?.avatar_url ?? ""}
              className="w-full rounded-md border border-[var(--border)] px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Banner URL</span>
            <input
              name="banner_url"
              defaultValue={creator?.banner_url ?? ""}
              className="w-full rounded-md border border-[var(--border)] px-3 py-2"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium">Bio</span>
            <textarea
              name="bio"
              rows={4}
              defaultValue={creator?.bio ?? ""}
              className="w-full rounded-md border border-[var(--border)] px-3 py-2"
            />
          </label>
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

        <button
          type="submit"
          className="mt-6 rounded-md bg-[var(--accent)] px-5 py-2.5 font-semibold text-[var(--accent-foreground)]"
        >
          Profiel opslaan
        </button>
      </form>
    </section>
  );
}
