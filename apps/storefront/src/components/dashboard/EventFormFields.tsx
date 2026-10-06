import { ImageUploadField } from "@/components/ui/image-upload-field";
import { MultiImageUploadField } from "@/components/ui/multi-image-upload-field";
import {
  CheckboxField,
  FormSection,
  SelectField,
  TextAreaField,
  TextField,
  centsToEuroInput,
  toDateTimeLocal,
} from "@/components/dashboard/form";
import type { Event } from "@/types/platform";

export const EVENT_TYPE_OPTIONS = [
  { value: "handmade_market", label: "Handmade markt" },
  { value: "hobby_fair", label: "Hobbybeurs" },
  { value: "pop_up", label: "Pop-up" },
  { value: "open_atelier", label: "Open atelier" },
  { value: "workshop_day", label: "Workshopdag" },
];

type Props = {
  creatorId: string;
  event?: Event | null;
  galleryCount?: number;
  canPublish: boolean;
  allowExternalTickets: boolean;
  /** Suffix per event type, e.g. " (2 credits)", when credits apply. */
  typeCostLabel?: (type: string) => string;
};

function defaultStart(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setHours(10, 0, 0, 0);
  return toDateTimeLocal(date.toISOString());
}

function defaultEnd(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setHours(16, 0, 0, 0);
  return toDateTimeLocal(date.toISOString());
}

/** The three parts of an event: what, when & where, tickets & photos. */
export function EventFormFields({
  creatorId,
  event,
  galleryCount = 0,
  canPublish,
  allowExternalTickets,
  typeCostLabel,
}: Props) {
  const ticketOptions = [
    { value: "none", label: "Geen tickets nodig" },
    ...(allowExternalTickets || event?.ticketing_mode === "external_link"
      ? [{ value: "external_link", label: "Tickets via een andere website" }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <FormSection id="wat" title="1. Wat" lead="Wat voor activiteit organiseer je?">
        <TextField
          name="title"
          label="Naam van het event"
          required
          wide
          defaultValue={event?.title}
          placeholder="Bijvoorbeeld: Kerstmarkt in de Schaliken"
        />
        <SelectField
          name="event_type"
          label="Soort event"
          required
          wide
          defaultValue={event?.event_type ?? "handmade_market"}
          options={EVENT_TYPE_OPTIONS.map((option) => ({
            value: option.value,
            label: `${option.label}${typeCostLabel ? typeCostLabel(option.value) : ""}`,
          }))}
        />
        <TextField
          name="short_description"
          label="Korte samenvatting"
          wide
          help="Eén zin. Die verschijnt in de agenda."
          defaultValue={event?.short_description}
        />
        <TextAreaField
          name="description"
          label="Uitgebreide beschrijving"
          defaultValue={event?.description}
        />
      </FormSection>

      <FormSection id="wanneer" title="2. Wanneer en waar">
        <TextField
          name="starts_at"
          type="datetime-local"
          label="Begin"
          required
          defaultValue={event ? toDateTimeLocal(event.starts_at) : defaultStart()}
        />
        <TextField
          name="ends_at"
          type="datetime-local"
          label="Einde"
          required
          defaultValue={event ? toDateTimeLocal(event.ends_at) : defaultEnd()}
        />
        <TextField
          name="location_name"
          label="Locatie of zaal"
          defaultValue={event?.location_name}
        />
        <TextField name="address_line_1" label="Straat en nummer" defaultValue={event?.address_line_1} />
        <TextField name="postal_code" label="Postcode" defaultValue={event?.postal_code} />
        <TextField name="city" label="Gemeente" defaultValue={event?.city} />
      </FormSection>

      <FormSection id="tickets" title="3. Tickets en foto's">
        <SelectField
          name="ticketing_mode"
          label="Tickets"
          required
          options={ticketOptions}
          defaultValue={event?.ticketing_mode ?? "none"}
        />
        <TextField
          name="ticket_price_euro"
          type="number"
          inputMode="decimal"
          min={0}
          step={0.01}
          label="Toegangsprijs (€)"
          help="Laat leeg als de toegang gratis is."
          defaultValue={event ? centsToEuroInput(event.ticket_price_cents) : undefined}
        />
        <div className="md:col-span-2">
          <ImageUploadField
            name="featured_image_file"
            label="Hoofdfoto"
            currentUrl={event?.featured_image_url}
            uploadPathPrefix={`creators/${creatorId}/events`}
            hint={
              event
                ? "Laat leeg om de huidige foto te houden."
                : "Deze foto zien bezoekers als eerste in de agenda."
            }
          />
        </div>
        <div className="md:col-span-2">
          <MultiImageUploadField
            uploadPathPrefix={`creators/${creatorId}/events/gallery`}
            label="Extra foto's"
            existingCount={galleryCount}
            hint="Niet verplicht. Bijvoorbeeld de locatie, de stands of de sfeer."
          />
        </div>
        <CheckboxField
          name="is_active"
          label="Zichtbaar maken in de agenda"
          defaultChecked={event?.is_active ?? false}
          help={
            canPublish
              ? "Laat leeg om eerst als concept te bewaren."
              : "Je kan pas zichtbaar maken nadat we je account als organisator goedkeuren. Bewaar intussen als concept."
          }
        />
      </FormSection>
    </div>
  );
}
