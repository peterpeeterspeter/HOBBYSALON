import { getAuthUser } from "@/lib/auth/session";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { createPlatformClient } from "@/lib/platform/client";
import { createProductAction, updateProductAction } from "@/app/actions/dashboard";
import { CardShell } from "@/components/ui/card-shell";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
          <CardShell variant="default" padding="lg" className="mb-8">
            <form action={createProductAction}>
              <h2 className="text-lg font-semibold">Nieuw product</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Input name="title" label="Titel *" required />
                <Input name="slug" label="Slug" />
                <Select
                  name="product_type"
                  label="Type *"
                  options={PRODUCT_TYPE_OPTIONS}
                  required
                />
                <Input name="featured_image_url" label="Afbeelding URL" />
                <Input name="short_description" label="Korte omschrijving" className="sm:col-span-2" />
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Omschrijving</label>
                  <textarea
                    name="description"
                    rows={3}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                  />
                </div>
                <label className="inline-flex items-center gap-2 sm:col-span-2">
                  <input type="checkbox" name="is_active" />
                  <span className="text-sm">Direct actief publiceren</span>
                </label>
              </div>
              <Button type="submit" className="mt-4">
                Product aanmaken
              </Button>
            </form>
          </CardShell>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Bestaande producten ({products.length})</h2>
            {products.length === 0 ? (
              <EmptyState
                title="Nog geen producten"
                description="Maak je eerste product aan met het formulier hierboven."
              />
            ) : (
              products.map((product) => (
                <CardShell key={product.id} variant="default" padding="md">
                <details>
                  <summary className="cursor-pointer list-none font-medium text-[var(--foreground)]">
                    {product.title}{" "}
                    <span className="text-sm text-[var(--muted)]">
                      ({product.product_type}){product.is_active ? " · actief" : " · concept"}
                    </span>
                  </summary>
                  <form action={updateProductAction} className="mt-4 grid gap-4 sm:grid-cols-2">
                    <input type="hidden" name="id" value={product.id} />
                    <input
                      type="hidden"
                      name="medusa_product_id"
                      value={product.medusa_product_id ?? ""}
                    />
                    <Input
                      name="title"
                      label="Titel *"
                      required
                      defaultValue={product.title}
                    />
                    <Input
                      name="slug"
                      label="Slug"
                      defaultValue={product.slug}
                    />
                    <Select
                      name="product_type"
                      label="Type *"
                      options={PRODUCT_TYPE_OPTIONS}
                      required
                      defaultValue={product.product_type}
                    />
                    <Input
                      name="featured_image_url"
                      label="Afbeelding URL"
                      defaultValue={product.featured_image_url ?? ""}
                    />
                    <Input
                      name="short_description"
                      label="Korte omschrijving"
                      defaultValue={product.short_description ?? ""}
                      className="sm:col-span-2"
                    />
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Omschrijving</label>
                      <textarea
                        name="description"
                        rows={3}
                        defaultValue={product.description ?? ""}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                      />
                    </div>
                    <label className="inline-flex items-center gap-2 sm:col-span-2">
                      <input type="checkbox" name="is_active" defaultChecked={product.is_active} />
                      <span className="text-sm">Actief</span>
                    </label>
                    <div className="sm:col-span-2">
                      <Button type="submit" variant="secondary" size="sm">
                        Opslaan
                      </Button>
                    </div>
                  </form>
                </details>
                </CardShell>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}
