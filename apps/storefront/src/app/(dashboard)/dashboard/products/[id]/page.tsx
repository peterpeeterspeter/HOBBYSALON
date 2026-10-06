import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  deleteProductAction,
  deleteProductGalleryImageAction,
  unpublishProductAction,
  updateProductAction,
} from "@/app/actions/dashboard";
import { createPlatformClient } from "@/lib/platform/client";
import { getDashboardContext, loadInbox } from "@/lib/dashboard/load";
import { loadOfferFormOptions } from "@/lib/dashboard/form-options";
import { loadCreationCategories } from "@/lib/dashboard/creation-options";
import { resolveCreationStatus } from "@/lib/dashboard/offer-status";
import { requireDashboardCapability } from "@/lib/auth/require-dashboard-capability";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { DashboardPageHeader, FlashMessage, StatusPill } from "@/components/dashboard/ui";
import { FormActions } from "@/components/dashboard/form";
import { CreationFormFields } from "@/components/dashboard/CreationFormFields";
import { GalleryManager } from "@/components/dashboard/GalleryManager";
import { ItemRequestList } from "@/components/dashboard/ItemRequestList";
import type { Product } from "@/types/platform";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
};

const UUID = /^[0-9a-f-]{36}$/i;

export default async function EditCreationPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { success, error } = await searchParams;
  if (!UUID.test(id)) notFound();

  const path = `/dashboard/products/${id}`;
  const { creator, caps } = await getDashboardContext(path);
  requireDashboardCapability(caps.canManageProducts);
  if (!creator) redirect("/dashboard/pagina");

  const supabase = createPlatformClient();
  const { data: productRow } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("creator_id", creator.id)
    .maybeSingle();
  if (!productRow) notFound();
  const product = productRow as Product;

  // Webshop products are managed in the verkopersportaal, not here.
  if (product.product_type !== "handmade" && product.product_type !== "destash") {
    redirect("/dashboard/winkel");
  }

  const [options, categories, galleryResult, requests] = await Promise.all([
    loadOfferFormOptions(creator.id),
    loadCreationCategories(),
    supabase
      .from("product_gallery_images")
      .select("id, image_url, sort_order")
      .eq("product_id", id)
      .order("sort_order", { ascending: true }),
    loadInbox({
      creatorId: creator.id,
      includeCreations: true,
      includeWorkshops: false,
      includeEvents: false,
      itemId: id,
      limit: 50,
    }),
  ]);

  const gallery = (galleryResult.data ?? []) as Array<{ id: string; image_url: string }>;
  const status = resolveCreationStatus(product);

  return (
    <div className="max-w-4xl">
      <DashboardPageHeader
        title={product.title}
        back={{ href: "/dashboard/aanbod?soort=creaties", label: "Terug naar mijn aanbod" }}
        lead={
          <span className="flex flex-wrap items-center gap-3">
            <StatusPill status={status} />
            {status === "visible" ? (
              <Link
                href={`/product/${product.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[var(--accent-hover)] underline underline-offset-4"
              >
                Bekijk op de site
              </Link>
            ) : null}
          </span>
        }
      />
      <FlashMessage success={success} error={error} />

      <section id="aanvragen" className="mb-10 scroll-mt-24" aria-labelledby="aanvragen-titel">
        <h2 id="aanvragen-titel" className="mb-4 text-2xl font-bold text-[var(--foreground)]">
          Vragen van bezoekers
        </h2>
        <ItemRequestList
          items={requests}
          returnTo={path}
          emptyText="Als iemand interesse heeft in deze creatie, verschijnt de vraag hier."
        />
      </section>

      <div className="mb-10">
        <GalleryManager images={gallery} action={deleteProductGalleryImageAction} returnTo={path} />
      </div>

      <form action={updateProductAction} encType="multipart/form-data">
        <input type="hidden" name="id" value={product.id} />
        <input type="hidden" name="medusa_product_id" value={product.medusa_product_id ?? ""} />
        <input type="hidden" name="return_to" value={path} />
        <CreationFormFields
          creatorId={creator.id}
          product={product}
          domainOptions={options.domainOptions}
          categories={categories}
          primaryDomainId={options.primaryDomainId}
          galleryCount={gallery.length}
          lockType={Boolean(product.medusa_product_id)}
        />
        <FormActions>
          <Button type="submit" size="lg">
            Opslaan
          </Button>
          {product.is_active ? (
            <ConfirmSubmitButton
              formAction={unpublishProductAction}
              formNoValidate
              variant="secondary"
              size="lg"
              message="Deze creatie verbergen? Ze blijft bewaard als concept."
            >
              Verbergen
            </ConfirmSubmitButton>
          ) : null}
          <ConfirmSubmitButton
            formAction={deleteProductAction}
            formNoValidate
            variant="danger"
            size="lg"
            className="ml-auto"
            message="Deze creatie definitief verwijderen? Dit kan je niet ongedaan maken."
          >
            Verwijderen
          </ConfirmSubmitButton>
        </FormActions>
      </form>
    </div>
  );
}
