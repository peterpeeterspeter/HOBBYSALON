"use client";

import {
  FormWithDraft,
  draftString,
  draftStringArray,
} from "@/components/ui/form-with-draft";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { MultiImageUploadField } from "@/components/ui/multi-image-upload-field";
import { ProductDomainCategoryFields } from "@/components/dashboard/ProductDomainCategoryFields";

type CategoryOption = {
  id: string;
  name: string;
  domain_id: string | null;
};

type CreateProductDraftFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  creatorId: string;
  domainOptions: { value: string; label: string }[];
  categories: CategoryOption[];
  primaryDomainId: string;
  productTypeOptions: { value: string; label: string }[];
  conditionOptions: { value: string; label: string }[];
};

export function CreateProductDraftForm({
  action,
  creatorId,
  domainOptions,
  categories,
  primaryDomainId,
  productTypeOptions,
  conditionOptions,
}: CreateProductDraftFormProps) {
  return (
    <FormWithDraft
      storageKey="hs-draft:product-create"
      action={action}
      encType="multipart/form-data"
    >
      {({ draft }) => (
        <>
          <h2 className="text-lg font-semibold">Nieuwe plaatsing</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input
              name="title"
              label="Titel *"
              required
              defaultValue={draftString(draft, "title")}
            />
            <Select
              name="product_type"
              label="Type *"
              options={productTypeOptions}
              required
              defaultValue={draftString(draft, "product_type") ?? "handmade"}
            />
            <Input
              name="price_euro"
              label="Richtprijs (€) *"
              type="number"
              min={0}
              step={0.01}
              required
              defaultValue={draftString(draft, "price_euro") ?? "0"}
              placeholder="45.00"
            />
            <input type="hidden" name="currency_code" value="EUR" />
            <ProductDomainCategoryFields
              domainOptions={domainOptions}
              categories={categories}
              defaults={{
                domain_id: draftString(draft, "domain_id") ?? primaryDomainId,
                category_id: draftString(draft, "category_id") ?? null,
              }}
            />
            <Select
              name="condition_type"
              label="Conditie"
              options={conditionOptions}
              defaultValue={draftString(draft, "condition_type") ?? "handmade"}
            />
            <Input
              name="estimated_dispatch_days"
              label="Verzending binnen (dagen)"
              type="number"
              min={0}
              defaultValue={draftString(draft, "estimated_dispatch_days")}
            />
            <div className="grid gap-4 rounded-lg border border-[var(--border)] p-4 sm:col-span-2">
              <ImageUploadField
                key={
                  draftString(draft, "featured_image_file_uploaded_url") ??
                  "featured-new"
                }
                name="featured_image_file"
                label="Hoofdfoto"
                uploadPathPrefix={`creators/${creatorId}/products`}
                urlDefaultValue={draftString(
                  draft,
                  "featured_image_file_uploaded_url"
                )}
                hint="Vierkant of liggend · min. 1000×1000 px. Deze foto verschijnt als eerste op je productpagina."
              />
              <MultiImageUploadField
                key={
                  draftStringArray(draft, "gallery_image_urls").join("|") ||
                  "gallery-new"
                }
                uploadPathPrefix={`creators/${creatorId}/products/gallery`}
                label="Extra foto's"
                initialUrls={draftStringArray(draft, "gallery_image_urls")}
                hint="Optioneel. Vierkant werkt het best · min. 1000×1000 px. Detail, materiaal of resultaat."
              />
            </div>
            <Input
              name="short_description"
              label="Korte omschrijving"
              className="sm:col-span-2"
              defaultValue={draftString(draft, "short_description")}
            />
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                Omschrijving
              </label>
              <textarea
                name="description"
                rows={3}
                defaultValue={draftString(draft, "description")}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
              />
            </div>
            <label className="inline-flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={Boolean(draft?.is_active)}
              />
              <span className="text-sm">Direct zichtbaar in je shop</span>
            </label>
            <label className="inline-flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                name="personalization_available"
                defaultChecked={Boolean(draft?.personalization_available)}
              />
              <span className="text-sm">Personalisatie mogelijk</span>
            </label>
          </div>
          <Button type="submit" className="mt-4">
            Plaatsing toevoegen
          </Button>
        </>
      )}
    </FormWithDraft>
  );
}
