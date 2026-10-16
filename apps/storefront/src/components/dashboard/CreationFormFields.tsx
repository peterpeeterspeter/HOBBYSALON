import { ImageUploadField } from "@/components/ui/image-upload-field";
import { MultiImageUploadField } from "@/components/ui/multi-image-upload-field";
import { ProductDomainCategoryFields } from "@/components/dashboard/ProductDomainCategoryFields";
import {
  CheckboxField,
  FormSection,
  SelectField,
  TextAreaField,
  TextField,
  centsToEuroInput,
} from "@/components/dashboard/form";
import type { Product } from "@/types/platform";

export const CREATION_TYPE_OPTIONS = [
  { value: "handmade", label: "Zelf gemaakt" },
  { value: "destash", label: "Materiaal dat ik niet meer gebruik" },
];

export const CREATION_CONDITION_OPTIONS = [
  { value: "handmade", label: "Handgemaakt" },
  { value: "new", label: "Nieuw" },
  { value: "made_to_order", label: "Wordt op bestelling gemaakt" },
  { value: "used", label: "Gebruikt" },
];

type Props = {
  creatorId: string;
  product?: Product | null;
  domainOptions: Array<{ value: string; label: string }>;
  categories: Array<{ id: string; name: string; domain_id: string | null }>;
  primaryDomainId: string;
  galleryCount?: number;
  /** Creations sold through the webshop can only be "zelf gemaakt". */
  lockType?: boolean;
};

/** The three parts of a creation: what, price & delivery, photos. */
export function CreationFormFields({
  creatorId,
  product,
  domainOptions,
  categories,
  primaryDomainId,
  galleryCount = 0,
  lockType = false,
}: Props) {
  return (
    <div className="space-y-6">
      <FormSection id="wat" title="1. Wat" lead="Wat bied je aan?">
        <TextField
          name="title"
          label="Naam"
          required
          wide
          defaultValue={product?.title}
          placeholder="Bijvoorbeeld: Gehaakte mand in naturel"
        />
        {lockType ? (
          <input type="hidden" name="product_type" value="handmade" />
        ) : (
          <SelectField
            name="product_type"
            label="Soort"
            required
            options={CREATION_TYPE_OPTIONS}
            defaultValue={product?.product_type ?? "handmade"}
          />
        )}
        <SelectField
          name="condition_type"
          label="Staat"
          options={CREATION_CONDITION_OPTIONS}
          defaultValue={product?.condition_type ?? "handmade"}
        />
        <ProductDomainCategoryFields
          domainOptions={domainOptions}
          categories={categories}
          defaults={{
            domain_id: product?.domain_id ?? primaryDomainId,
            category_id: product?.category_id ?? null,
          }}
        />
        <TextField
          name="short_description"
          label="Korte samenvatting"
          wide
          help="Eén zin. Die verschijnt in overzichten."
          defaultValue={product?.short_description}
        />
        <TextAreaField
          name="description"
          label="Uitgebreide beschrijving"
          help="Afmetingen, materiaal, kleur, onderhoud."
          defaultValue={product?.description}
        />
      </FormSection>

      <FormSection
        id="prijs"
        title="2. Prijs en levering"
        lead="Bezoekers nemen contact met je op. Jullie spreken de verkoop zelf af."
      >
        <TextField
          name="price_euro"
          type="number"
          inputMode="decimal"
          min={0}
          step={0.01}
          label="Richtprijs (€)"
          required
          defaultValue={product ? centsToEuroInput(product.price_cents) : "0"}
        />
        <input type="hidden" name="currency_code" value="EUR" />
        <TextField
          name="estimated_dispatch_days"
          type="number"
          inputMode="numeric"
          min={0}
          label="Klaar om te versturen binnen (dagen)"
          defaultValue={product?.estimated_dispatch_days}
        />
        <CheckboxField
          name="personalization_available"
          label="Personaliseren kan"
          help="Bijvoorbeeld een naam, kleur of maat op vraag."
          defaultChecked={product?.personalization_available ?? false}
        />
      </FormSection>

      <FormSection id="fotos" title="3. Foto's">
        <div className="md:col-span-2">
          <ImageUploadField
            name="featured_image_file"
            label="Hoofdfoto"
            currentUrl={product?.featured_image_url}
            uploadPathPrefix={`creators/${creatorId}/products`}
            hint={
              product
                ? "Laat leeg om de huidige foto te houden."
                : "Vierkant werkt het best, minstens 1000 bij 1000 pixels."
            }
          />
        </div>
        <div className="md:col-span-2">
          <MultiImageUploadField
            uploadPathPrefix={`creators/${creatorId}/products/gallery`}
            label="Extra foto's"
            existingCount={galleryCount}
            hint="Niet verplicht. Bijvoorbeeld een detail of de achterkant."
          />
        </div>
        <CheckboxField
          name="is_active"
          label="Zichtbaar maken op je maker-pagina"
          defaultChecked={product?.is_active ?? false}
          help="Laat leeg om eerst als concept te bewaren."
        />
      </FormSection>
    </div>
  );
}
