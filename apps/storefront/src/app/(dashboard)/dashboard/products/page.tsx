import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { resolveDashboardCapabilities } from "@/lib/auth/dashboard-access";
import { requireDashboardCapability } from "@/lib/auth/require-dashboard-capability";
import { getCreatorByUserId } from "@/lib/platform/queries/creators";
import { createPlatformClient } from "@/lib/platform/client";
import { getUserRegistrationContext } from "@/lib/platform/queries/user-registration";
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
import { updateProductInquiryStatusAction } from "@/app/actions/product-inquiry";
import { createCreditPackCheckoutAction } from "@/app/actions/listing-checkout";
import { getCreditBalance } from "@/lib/platform/listing-credits";
import { isCommercialGatingEnabled } from "@/lib/platform/commercial-entitlements";
import { CardShell } from "@/components/ui/card-shell";
import { Input } from "@/components/ui/input";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardProductListItem } from "@/components/dashboard/DashboardProductListItem";
import type { Product } from "@/types/platform";

type Props = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

type ProductInquiryRow = {
  id: string;
  product_id: string;
  full_name: string;
  email: string;
  message: string | null;
  status: string;
  created_at: string;
  products: { title: string; slug: string } | { title: string; slug: string }[] | null;
};

type CreditPackRow = {
  pack_code: string;
  name: string;
  credits: number;
  price_cents: number;
  currency_code: string;
};

const PRODUCT_TYPE_OPTIONS = [
  { value: "handmade", label: "Handmade" },
  { value: "destash", label: "Restant materiaal (destash)" },
];
const PRODUCT_CONDITION_OPTIONS = [
  { value: "handmade", label: "Handmade" },
  { value: "new", label: "Nieuw" },
  { value: "made_to_order", label: "Op bestelling gemaakt" },
  { value: "used", label: "Destash / tweedehands" },
];
const INQUIRY_STATUS_OPTIONS = [
  { value: "new", label: "Nieuw" },
  { value: "contacted", label: "Gecontacteerd" },
  { value: "accepted", label: "Geaccepteerd" },
  { value: "declined", label: "Afgewezen" },
];

function formatEuroFromCents(cents: number | null | undefined): string {
  if (typeof cents !== "number") return "";
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function inquiryProductTitle(inquiry: ProductInquiryRow): string {
  const products = inquiry.products;
  if (!products) return inquiry.product_id;
  if (Array.isArray(products)) return products[0]?.title ?? inquiry.product_id;
  return products.title;
}

export default async function DashboardProductsPage({ searchParams }: Props) {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/dashboard/products");
  }

  const [creator, registrationContext] = await Promise.all([
    getCreatorByUserId(user.id),
    getUserRegistrationContext(user.id),
  ]);
  const caps = resolveDashboardCapabilities({
    registrationContext,
    creatorTypes: creator?.creator_types,
    hasCreatorProfile: Boolean(creator),
  });
  requireDashboardCapability(caps.canManageProducts);

  const { success, error } = await searchParams;
  const [domains, categoryOptions] = await Promise.all([
    listDomainsBySort(),
    listSupplyCategoryOptions(),
  ]);

  let products: Product[] = [];
  let creatorDomainIds: string[] = [];
  let productInquiries: ProductInquiryRow[] = [];
  let creditPacks: CreditPackRow[] = [];
  let creditBalance = 0;
  if (creator) {
    const supabase = createPlatformClient();
    const [
      { data: productData },
      { data: creatorDomainLinks },
      { data: inquiryData },
      { data: creditPackData },
      balance,
    ] = await Promise.all([
      supabase
        .from("products")
        .select("*")
        .eq("creator_id", creator.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("creator_domains")
        .select("domain_id")
        .eq("creator_id", creator.id),
      supabase
        .from("product_inquiries")
        .select(
          "id, product_id, full_name, email, message, status, created_at, products(title, slug)"
        )
        .eq("creator_id", creator.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("listing_credit_products")
        .select("pack_code, name, credits, price_cents, currency_code")
        .eq("is_active", true)
        .order("credits", { ascending: true }),
      getCreditBalance(creator.id),
    ]);
    products = (productData ?? []) as Product[];
    creatorDomainIds = Array.from(
      new Set((creatorDomainLinks ?? []).map((row) => row.domain_id).filter(Boolean))
    );
    productInquiries = (inquiryData ?? []) as ProductInquiryRow[];
    creditPacks = (creditPackData ?? []) as CreditPackRow[];
    creditBalance = balance;
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
      <h1 className="text-3xl font-bold text-[var(--foreground)]">Beheer je creaties</h1>
      <p className="max-w-2xl text-[var(--muted)]">
        Plaats je handmade creaties als vermelding. Bezoekers contacteren jou
        rechtstreeks. Hobbysalon verwerkt geen betalingen voor makers.
      </p>

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
          Maak eerst je maker-pagina aan om creaties in je shop te plaatsen.
        </p>
      ) : (
        <>
          {isCommercialGatingEnabled() && (
          <CardShell variant="default" padding="lg" className="mb-8">
            <h2 className="text-lg font-semibold">Listing credits</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Je huidige saldo: <strong>{creditBalance} credits</strong>. Elke
              plaatsing kost credits; koop een pakket om te blijven publiceren.
            </p>
            {creditPacks.length > 0 && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {creditPacks.map((pack) => (
                  <form
                    key={pack.pack_code}
                    action={createCreditPackCheckoutAction}
                    className="flex flex-col gap-2 rounded-lg border border-[var(--border)] p-3"
                  >
                    <input type="hidden" name="pack_code" value={pack.pack_code} />
                    <span className="font-semibold text-[var(--foreground)]">
                      {pack.name}
                    </span>
                    <span className="text-sm text-[var(--muted)]">
                      {pack.credits} credits
                    </span>
                    <span className="text-sm text-[var(--foreground)]">
                      {formatEuroFromCents(pack.price_cents)}
                    </span>
                    <Button type="submit" variant="secondary" size="sm">
                      Kopen
                    </Button>
                  </form>
                ))}
              </div>
            )}
          </CardShell>
          )}

          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold text-[var(--foreground)]">
                Jouw plaatsingen
              </h2>
              <p className="mt-1 text-base text-[var(--muted)]">
                {products.length === 0
                  ? "Nog geen creaties. Voeg er een toe met het formulier hieronder."
                  : `${products.length} ${products.length === 1 ? "plaatsing" : "plaatsingen"} in je shop.`}
              </p>
            </div>
            {products.length === 0 ? (
              <EmptyState
                title="Nog geen plaatsingen"
                description="Voeg je eerste creatie toe met het formulier hieronder."
              />
            ) : (
              <ul className="space-y-4">
                {products.map((product) => (
                  <li key={product.id}>
                    <DashboardProductListItem
                      product={product}
                      priceLabel={formatEuroFromCents(product.price_cents)}
                    >
                      <form
                        action={updateProductAction}
                        encType="multipart/form-data"
                        className="grid gap-4 sm:grid-cols-2"
                      >
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
                          name="price_cents"
                          label="Richtprijs (cent)"
                          type="number"
                          min={0}
                          defaultValue={
                            typeof product.price_cents === "number"
                              ? String(product.price_cents)
                              : ""
                          }
                        />
                        <Input
                          name="currency_code"
                          label="Valuta"
                          defaultValue={product.currency_code ?? "EUR"}
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
                          options={
                            (
                              product.domain_id
                                ? categoryOptionsByDomain.get(product.domain_id)
                                : createCategoryOptions
                            )?.map((category) => ({
                              value: category.id,
                              label: category.name,
                            })) ?? []
                          }
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
                        <div className="grid gap-4 rounded-lg border border-[var(--border)] p-4 sm:col-span-2">
                          <ImageUploadField
                            name="featured_image_file"
                            label="Foto van je creatie"
                            currentUrl={product.featured_image_url}
                            uploadPathPrefix={`creators/${creator.id}/products`}
                            hint="Laat leeg om de huidige foto te behouden."
                          />
                        </div>
                        <Input
                          name="short_description"
                          label="Korte omschrijving"
                          defaultValue={product.short_description ?? ""}
                          className="sm:col-span-2"
                        />
                        <div className="sm:col-span-2">
                          <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                            Omschrijving
                          </label>
                          <textarea
                            name="description"
                            rows={3}
                            defaultValue={product.description ?? ""}
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                          />
                        </div>
                        <label className="inline-flex items-center gap-2 sm:col-span-2">
                          <input
                            type="checkbox"
                            name="is_active"
                            defaultChecked={product.is_active}
                          />
                          <span className="text-sm">Zichtbaar in je shop</span>
                        </label>
                        <label className="inline-flex items-center gap-2 sm:col-span-2">
                          <input
                            type="checkbox"
                            name="personalization_available"
                            defaultChecked={product.personalization_available}
                          />
                          <span className="text-sm">Personalisatie mogelijk</span>
                        </label>
                        <div className="flex flex-wrap gap-2 sm:col-span-2">
                          <Button type="submit" variant="secondary" size="sm">
                            Opslaan
                          </Button>
                          <Button
                            type="submit"
                            formAction={unpublishProductAction}
                            variant="secondary"
                            size="sm"
                          >
                            Uit shop halen
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
                    </DashboardProductListItem>
                  </li>
                ))}
              </ul>
            )}
          </div>


          <CardShell variant="default" padding="lg" className="mb-8">
            <form action={createProductAction} encType="multipart/form-data">
              <h2 className="text-lg font-semibold">Nieuwe plaatsing</h2>
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
                <Input
                  name="price_cents"
                  label="Richtprijs (cent) *"
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
                    label="Foto van je creatie"
                    uploadPathPrefix={`creators/${creator.id}/products`}
                    hint="Deze foto verschijnt als hoofdafbeelding in je shop."
                  />
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
                  <span className="text-sm">Direct zichtbaar in je shop</span>
                </label>
                <label className="inline-flex items-center gap-2 sm:col-span-2">
                  <input type="checkbox" name="personalization_available" />
                  <span className="text-sm">Personalisatie mogelijk</span>
                </label>
              </div>
              <Button type="submit" className="mt-4">
                Plaatsing toevoegen
              </Button>
            </form>
          </CardShell>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">
              Aanvragen inbox ({productInquiries.length})
            </h2>
            {productInquiries.length === 0 ? (
              <p className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-6 text-sm text-[var(--muted)]">
                Nog geen aanvragen. Zodra iemand reageert op een plaatsing,
                verschijnt dat hier.
              </p>
            ) : (
              productInquiries.map((inquiry) => (
                <div
                  key={inquiry.id}
                  className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--foreground)]">
                        {inquiry.full_name} · {inquiry.email}
                      </p>
                      <p className="text-sm text-[var(--muted)]">
                        Plaatsing: {inquiryProductTitle(inquiry)}
                      </p>
                      {inquiry.message && (
                        <p className="mt-1 text-sm text-[var(--foreground)]">
                          {inquiry.message}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {new Date(inquiry.created_at).toLocaleString("nl-BE")}
                      </p>
                    </div>
                    <form
                      action={updateProductInquiryStatusAction}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="id" value={inquiry.id} />
                      <select
                        name="status"
                        defaultValue={inquiry.status}
                        className="rounded-md border border-[var(--border)] px-2 py-1.5 text-sm"
                      >
                        {INQUIRY_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:border-[var(--accent)]"
                      >
                        Update
                      </button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}
