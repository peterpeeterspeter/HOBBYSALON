import { ImageUploadField } from "@/components/ui/image-upload-field";
import { MultiImageUploadField } from "@/components/ui/multi-image-upload-field";
import { WorkshopTaxonomyFields } from "@/components/dashboard/WorkshopTaxonomyFields";
import {
  CheckboxField,
  FormSection,
  SelectField,
  TextAreaField,
  TextField,
  centsToEuroInput,
} from "@/components/dashboard/form";
import type { Workshop } from "@/types/platform";

export const WORKSHOP_FORMAT_OPTIONS = [
  { value: "physical", label: "Ter plaatse" },
  { value: "online", label: "Online" },
  { value: "hybrid", label: "Ter plaatse en online" },
];

export const WORKSHOP_LEVEL_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Gevorderd" },
  { value: "advanced", label: "Expert" },
];

type Props = {
  creatorId: string;
  workshop?: Workshop | null;
  categories: Parameters<typeof WorkshopTaxonomyFields>[0]["categories"];
  domainOptions: Array<{ value: string; label: string }>;
  primaryDomainId: string;
  galleryCount?: number;
  canPublish: boolean;
  /** New workshops need a first date; existing ones manage dates separately. */
  withFirstDate: boolean;
};

/** The three parts of a workshop: what, when & where, price & photos. */
export function WorkshopFormFields({
  creatorId,
  workshop,
  categories,
  domainOptions,
  primaryDomainId,
  galleryCount = 0,
  canPublish,
  withFirstDate,
}: Props) {
  return (
    <div className="space-y-6">
      <FormSection id="wat" title="1. Wat" lead="Waar gaat je workshop over?">
        <TextField
          name="title"
          label="Naam van de workshop"
          required
          wide
          defaultValue={workshop?.title}
          placeholder="Bijvoorbeeld: Haken voor beginners"
        />
        <WorkshopTaxonomyFields
          categories={categories}
          domainOptions={domainOptions}
          defaults={{
            domain_id: workshop?.domain_id ?? primaryDomainId,
            category_id: workshop?.category_id,
            offer_type: workshop?.offer_type,
            audience_types: workshop?.audience_types,
            age_groups: workshop?.age_groups,
            languages: workshop?.languages,
          }}
        />
        <SelectField
          name="format_type"
          label="Waar vindt het plaats?"
          required
          options={WORKSHOP_FORMAT_OPTIONS}
          defaultValue={workshop?.format_type ?? "physical"}
        />
        <SelectField
          name="difficulty_level"
          label="Niveau"
          required
          options={WORKSHOP_LEVEL_OPTIONS}
          defaultValue={workshop?.difficulty_level ?? "beginner"}
        />
        <TextField
          name="short_description"
          label="Korte samenvatting"
          wide
          help="Eén zin. Die verschijnt in overzichten en zoekresultaten."
          defaultValue={workshop?.short_description}
        />
        <TextAreaField
          name="description"
          label="Uitgebreide beschrijving"
          help="Wat leren deelnemers? Wat moeten ze meebrengen?"
          defaultValue={workshop?.description}
        />
      </FormSection>

      <FormSection id="wanneer" title="2. Wanneer en waar">
        {withFirstDate ? (
          <>
            <TextField
              name="session_starts_at"
              type="datetime-local"
              label="Eerste datum: begin"
              required
            />
            <TextField
              name="session_ends_at"
              type="datetime-local"
              label="Eerste datum: einde"
              required
              help="Meer data voeg je later toe."
            />
          </>
        ) : null}
        <TextField
          name="location_name"
          label="Locatie of zaal"
          defaultValue={workshop?.location_name}
        />
        <TextField name="city" label="Gemeente" defaultValue={workshop?.city} />
        <TextField
          name="duration_minutes"
          type="number"
          inputMode="numeric"
          min={0}
          label="Duur in minuten"
          defaultValue={workshop?.duration_minutes}
        />
        <TextField
          name="capacity"
          type="number"
          inputMode="numeric"
          min={0}
          label="Maximum aantal deelnemers"
          defaultValue={workshop?.capacity}
        />
      </FormSection>

      <FormSection id="prijs" title="3. Prijs en foto's">
        <TextField
          name="price_euro"
          type="number"
          inputMode="decimal"
          min={0}
          step={0.01}
          label="Prijs per deelnemer (€)"
          help="Vul 0 in als de workshop gratis is."
          defaultValue={workshop ? centsToEuroInput(workshop.price_cents) : "0"}
        />
        <div className="md:col-span-2">
          <ImageUploadField
            name="featured_image_file"
            label="Hoofdfoto"
            currentUrl={workshop?.featured_image_url}
            uploadPathPrefix={`creators/${creatorId}/workshops`}
            hint={
              workshop
                ? "Laat leeg om de huidige foto te houden."
                : "Deze foto zien bezoekers als eerste."
            }
          />
        </div>
        <div className="md:col-span-2">
          <MultiImageUploadField
            uploadPathPrefix={`creators/${creatorId}/workshops/gallery`}
            label="Extra foto's"
            existingCount={galleryCount}
            hint="Niet verplicht. Bijvoorbeeld de zaal, het materiaal of het resultaat."
          />
        </div>
        <CheckboxField
          name="is_active"
          label="Zichtbaar maken op Hobbysalon"
          defaultChecked={workshop?.is_active ?? false}
          help={
            canPublish
              ? "Laat leeg om eerst als concept te bewaren."
              : "Je kan pas zichtbaar maken nadat we je account als workshopgever goedkeuren. Bewaar intussen als concept."
          }
        />
      </FormSection>
    </div>
  );
}
