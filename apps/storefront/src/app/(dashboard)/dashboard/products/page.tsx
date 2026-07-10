import { getAuthUser } from "@/lib/auth/session";
import { ensureCreatorSellerLinked, resolveSellerIdForCreatorOps } from "@/lib/commerce/medusa/creator-onboarding";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { createPlatformClient } from "@/lib/platform/client";
import { listDomainsBySort } from "@/lib/platform/queries/domains";
import {
  listSupplyCategoryOptions,
  type ProductCategoryOption,
} from "@/lib/platform/queries/products";
import {
  createProductAction,
  deleteProductAction,
  unpublishProductAction,
  updateProductAction,
} from "@/app/actions/dashboard";
import { CardShell } from "@/components/ui/card-shell";
import { Input } from "@/components/ui/input";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { Product } from "@/types/platform";

type Props = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

const PRODUCT_TYPE_OPTIONS = [
  { value: "handmade", label: "Handmade" },
];
const PRODUCT_CONDITION_OPTIONS = [
  { value: "handmade", label: "Handmade" },
  { value: "new", label: "Nieuw" },
  { value: "made_to_order", label: "Op bestelling gemaakt" },
  { value: "used", label: "Tweedehands" },
];
const PRODUCT_STOCK_MODE_OPTIONS = [
  { value: "made_to_order", label: "Op bestelling (geen voorraad)" },
  { value: "in_stock", label: "Voorraadproduct" },
];

export default async function DashboardProductsPage({ searchParams }: Props) {
  const user = await getAuthUser();
  const creator = user ? await getCreatorByUserId(user.id) : null;
  if (creator && user) {
    const linkedSellerId = await resolveSellerIdForCreatorOps(user.id);
    if (!linkedSellerId) {
      await ensureCreatorSellerLinked(user.id, user.email ?? "", creator);
    }
  }
  const { success, error } = await searchParams;
  const [domains, categoryOptions] = await Promise.all([
    listDomainsBySort(),
    listSupplyCategoryOptions(),
  ]);

  let products: Product[] = [];
  let creatorDomainIds: string[] = [];
  if (creator) {
    const supabase = createPlatformClient();
    const [{ data: productData }, { data: creatorDomainLinks }] = await Promise.all([
      supabase
        .from("products")
        .select("*")
        .eq("creator_id", creator.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("creator_domains")
        .select("domain_id")
        .eq("creator_id", creator.id),
    ]);
    products = (productData ?? []) as Product[];
    creatorDomainIds = Array.from(
      new Set((creatorDomainLinks ?? []).map((row) => row.domain_id).filter(Boolean))
    );
  }

  const domainOptions = domains.map((domain) => ({
    value: domain.id,
    label: domain.name,
  }));
  const categoryOptionsByDomain = new Map<string, ProductCategoryOption[]>();
  for (const category of categoryOptions) {
    if (!category.domain_id) continue;
    const existing = categoryOptionsByDomain.get(category.domain_id) ?? [];
    existing.push(category);
    categoryOptionsByDomain.set(category.domain_id, existing);
  }
  const primaryDomainId = creatorDomainIds[0] ?? "";
  const createCategoryOptions =
    (primaryDomainId ? categoryOptionsByDomain.get(primaryDomainId) : null) ??
    categoryOptions;

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
            <form action={createProductAction} encType="multipart/form-data">
              <h2 className="text-lg font-semibold">Nieuw product</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Input name="title" label="Titel *" required />
                <Input name="slug" label="Slug" />
                <Select
                  name="product_type"
                  label="Type *"
                  options={PRODUCT_TYPE_OPTIONS}
                  required
                  defaultValue="handmade"
                />
                <Select
                  name="stock_mode"
                  label="Voorraadmodus *"
                  options={PRODUCT_STOCK_MODE_OPTIONS}
                  required
                  defaultValue="made_to_order"
                />
                <Input
                  name="price_cents"
                  label="Prijs (cent) *"
                  type="number"
                  min={0}
                  required
                  defaultValue="0"
                />
                <Input
                  name="currency_code"
                  label="Valuta *"
                  defaultValue="EUR"
                  maxLength={3}
                  required
                />
                <Select
                  name="domain_id"
                  label="Domein"
                  options={domainOptions}
                  placeholder="Selecteer domein"
                  defaultValue={primaryDomainId}
                />
                <Select
                  name="category_id"
                  label="Categorie"
                  options={createCategoryOptions.map((category) => ({
                    value: category.id,
                    label: category.name,
                  }))}
                  placeholder="Selecteer categorie"
                />
                <Select
                  name="condition_type"
                  label="Conditie"
                  options={PRODUCT_CONDITION_OPTIONS}
                  defaultValue="handmade"
                />
                <Input
                  name="estimated_dispatch_days"
                  label="Verzending binnen (dagen)"
                  type="number"
                  min={0}
                />
                <div className="sm:col-span-2 grid gap-4 rounded-lg border border-[var(--border)] p-4">
                  <ImageUploadField
                    name="featured_image_file"
                    label="Productfoto"
                    urlFieldName="featured_image_url"
                    uploadPathPrefix={`creators/${creator.id}/products`}
                    hint="Kies een foto vanaf je computer of telefoon. Deze foto wordt gebruikt als hoofdafbeelding van je product."
                  />
                  <p className="text-xs text-[var(--muted)]">
                    Een geüploade foto krijgt voorrang op een geplakte link. Gebruik enkel een
                    directe link naar JPG, PNG, WebP of GIF — niet een webpagina of
                    Google Drive-preview.
                  </p>
                </div>
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
                <label className="inline-flex items-center gap-2 sm:col-span-2">
                  <input type="checkbox" name="personalization_available" />
                  <span className="text-sm">Personalisatie mogelijk</span>
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
                  <form action={updateProductAction} encType="multipart/form-data" className="mt-4 grid gap-4 sm:grid-cols-2">
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
                    <Select
                      name="stock_mode"
                      label="Voorraadmodus *"
                      options={PRODUCT_STOCK_MODE_OPTIONS}
                      required
                      defaultValue={
                        product.condition_type === "made_to_order"
                          ? "made_to_order"
                          : "in_stock"
                      }
                    />
                    <Input
                      name="price_cents"
                      label="Prijs (cent)"
                      type="number"
                      min={0}
                      defaultValue=""
                    />
                    <Input
                      name="currency_code"
                      label="Valuta"
                      defaultValue="EUR"
                      maxLength={3}
                    />
                    <Select
                      name="domain_id"
                      label="Domein"
                      options={domainOptions}
                      placeholder="Selecteer domein"
                      defaultValue={product.domain_id ?? primaryDomainId}
                    />
                    <Select
                      name="category_id"
                      label="Categorie"
                      options={(
                        product.domain_id
                          ? categoryOptionsByDomain.get(product.domain_id)
                          : createCategoryOptions
                      )?.map((category) => ({
                        value: category.id,
                        label: category.name,
                      })) ?? []}
                      placeholder="Selecteer categorie"
                      defaultValue={product.category_id ?? ""}
                    />
                    <Select
                      name="condition_type"
                      label="Conditie"
                      options={PRODUCT_CONDITION_OPTIONS}
                      defaultValue={product.condition_type ?? "handmade"}
                    />
                    <Input
                      name="estimated_dispatch_days"
                      label="Verzending binnen (dagen)"
                      type="number"
                      min={0}
                      defaultValue={product.estimated_dispatch_days ?? ""}
                    />
                    <div className="sm:col-span-2 grid gap-4 rounded-lg border border-[var(--border)] p-4">
                      <ImageUploadField
                        name="featured_image_file"
                        label="Productfoto vervangen"
                        currentUrl={product.featured_image_url}
                        urlFieldName="featured_image_url"
                        urlDefaultValue={product.featured_image_url ?? ""}
                        uploadPathPrefix={`creators/${creator.id}/products`}
                        hint="Kies alleen een nieuwe foto als je de huidige wilt vervangen."
                      />
                      <p className="text-xs text-[var(--muted)]">
                        Een geüploade foto krijgt voorrang op een geplakte link. Laat beide
                        velden leeg om je huidige foto te behouden.
                      </p>
                    </div>
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
                    <label className="inline-flex items-center gap-2 sm:col-span-2">
                      <input
                        type="checkbox"
                        name="personalization_available"
                        defaultChecked={product.personalization_available}
                      />
                      <span className="text-sm">Personalisatie mogelijk</span>
                    </label>
                    <div className="sm:col-span-2 flex flex-wrap gap-2">
                      <Button type="submit" variant="secondary" size="sm">
                        Opslaan
                      </Button>
                      <Button
                        type="submit"
                        formAction={unpublishProductAction}
                        variant="secondary"
                        size="sm"
                      >
                        Depubliceer
                      </Button>
                      <Button
                        type="submit"
                        formAction={deleteProductAction}
                        variant="danger"
                        size="sm"
                      >
                        Verwijder
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
