import { getAuthUser } from "@/lib/auth/session";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { createPlatformClient } from "@/lib/platform/client";
import { createProductAction, updateProductAction } from "@/app/actions/dashboard";
import type { Product } from "@/types/platform";

type Props = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

const PRODUCT_TYPE_OPTIONS = [
  { value: "handmade", label: "Handmade" },
  { value: "supply", label: "Supply" },
  { value: "workshop_kit", label: "Workshop kit" },
  { value: "event_ticket", label: "Event ticket" },
  { value: "workshop_ticket", label: "Workshop ticket" },
  { value: "event_listing", label: "Event listing" },
];

export default async function DashboardProductsPage({ searchParams }: Props) {
  const user = await getAuthUser();
  const creator = user ? await getCreatorByUserId(user.id) : null;
  const { success, error } = await searchParams;

  let products: Product[] = [];
  if (creator) {
    const supabase = createPlatformClient();
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("creator_id", creator.id)
      .order("created_at", { ascending: false });
    products = (data ?? []) as Product[];
  }

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold text-[var(--foreground)]">Productbeheer</h1>
      <p className="text-[var(--muted)]">Maak producten aan en beheer hun status.</p>

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

      {!creator ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Maak eerst een creator-profiel aan om producten te beheren.
        </p>
      ) : (
        <>
          <form action={createProductAction} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
            <h2 className="text-lg font-semibold">Nieuw product</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Titel *</span>
                <input name="title" required className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Slug</span>
                <input name="slug" className="w-full rounded-md border border-[var(--border)] px-3 py-2" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Type *</span>
                <select name="product_type" required className="w-full rounded-md border border-[var(--border)] px-3 py-2">
                  {PRODUCT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Afbeelding URL</span>
                <input
                  name="featured_image_url"
                  className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-medium">Korte omschrijving</span>
                <input
                  name="short_description"
                  className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-medium">Omschrijving</span>
                <textarea
                  name="description"
                  rows={3}
                  className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                />
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" name="is_active" />
                <span className="text-sm">Direct actief publiceren</span>
              </label>
            </div>
            <button type="submit" className="mt-4 rounded-md bg-[var(--accent)] px-5 py-2.5 font-semibold text-[var(--accent-foreground)]">
              Product aanmaken
            </button>
          </form>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Bestaande producten ({products.length})</h2>
            {products.length === 0 ? (
              <p className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-6 text-sm text-[var(--muted)]">
                Nog geen producten.
              </p>
            ) : (
              products.map((product) => (
                <details key={product.id} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
                  <summary className="cursor-pointer list-none font-medium text-[var(--foreground)]">
                    {product.title}{" "}
                    <span className="text-sm text-[var(--muted)]">
                      ({product.product_type}){product.is_active ? " · actief" : " · concept"}
                    </span>
                  </summary>
                  <form action={updateProductAction} className="mt-4 grid gap-4 sm:grid-cols-2">
                    <input type="hidden" name="id" value={product.id} />
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium">Titel *</span>
                      <input
                        name="title"
                        required
                        defaultValue={product.title}
                        className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium">Slug</span>
                      <input
                        name="slug"
                        defaultValue={product.slug}
                        className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium">Type *</span>
                      <select
                        name="product_type"
                        required
                        defaultValue={product.product_type}
                        className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                      >
                        {PRODUCT_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium">Afbeelding URL</span>
                      <input
                        name="featured_image_url"
                        defaultValue={product.featured_image_url ?? ""}
                        className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-1 block text-sm font-medium">Korte omschrijving</span>
                      <input
                        name="short_description"
                        defaultValue={product.short_description ?? ""}
                        className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-1 block text-sm font-medium">Omschrijving</span>
                      <textarea
                        name="description"
                        rows={3}
                        defaultValue={product.description ?? ""}
                        className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                      />
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" name="is_active" defaultChecked={product.is_active} />
                      <span className="text-sm">Actief</span>
                    </label>
                    <div className="sm:col-span-2">
                      <button
                        type="submit"
                        className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium hover:border-[var(--accent)]"
                      >
                        Opslaan
                      </button>
                    </div>
                  </form>
                </details>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}
