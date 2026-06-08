import Link from "next/link";
import { saveCreatorProfileAction } from "@/app/actions/dashboard";
import { CardShell } from "@/components/ui/card-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { CREATOR_TYPES, type CreatorProfileTabProps } from "./types";

export function CreatorProfileTab({
  creator,
  onboarding,
  accountDisplayName,
  registrationCity,
  registrationCountryCode,
  domains,
  selectedDomainIds,
  hasMerchantRole,
}: CreatorProfileTabProps) {
  const selectedTypes = new Set(creator?.creator_types ?? []);
  const onboardingTypes = Array.isArray(onboarding?.creator_types)
    ? (onboarding.creator_types as string[])
    : [];
  const showSupplierHint =
    !hasMerchantRole &&
    (selectedTypes.has("supplier") ||
      onboardingTypes.includes("supplier"));

  return (
    <CardShell variant="default" padding="lg">
      <form action={saveCreatorProfileAction} encType="multipart/form-data" className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            name="display_name"
            label="Naam *"
            required
            defaultValue={
              creator?.display_name ??
              (typeof onboarding?.display_name === "string" ? onboarding.display_name : "") ??
              accountDisplayName
            }
          />
          <div>
            <Input
              name="slug"
              label="Webadres"
              placeholder="bijv. marie-haakt"
              defaultValue={
                creator?.slug ??
                (typeof onboarding?.preferred_slug === "string" ? onboarding.preferred_slug : "")
              }
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              Dit wordt je persoonlijke link: hobbysalon.be/creator/jouw-naam
            </p>
          </div>
          <Input
            name="business_name"
            label="Bedrijfsnaam"
            defaultValue={
              creator?.business_name ??
              (typeof onboarding?.business_name === "string" ? onboarding.business_name : "")
            }
          />
          <Input
            name="city"
            label="Stad"
            defaultValue={
              creator?.city ??
              (typeof onboarding?.city === "string" ? onboarding.city : "") ??
              registrationCity ??
              ""
            }
          />
          <Input
            name="website_url"
            label="Website"
            placeholder="https://"
            defaultValue={creator?.website_url ?? ""}
          />
          <Input
            name="instagram_url"
            label="Instagram"
            placeholder="https://instagram.com/..."
            defaultValue={creator?.instagram_url ?? ""}
          />
          <Input
            name="facebook_url"
            label="Facebook"
            placeholder="https://facebook.com/..."
            defaultValue={creator?.facebook_url ?? ""}
          />
          <ImageUploadField
            name="avatar_file"
            label="Profielfoto"
            hint="Je profielfoto op je maker-pagina en in overzichten."
            currentUrl={creator?.avatar_url}
          />
          <ImageUploadField
            name="banner_file"
            label="Omslagfoto"
            hint="Grote foto bovenaan je maker-pagina (optioneel)."
            currentUrl={creator?.banner_url}
            previewClassName="h-20 w-full max-w-sm rounded-lg object-cover"
          />
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
              Over jou
            </label>
            <textarea
              name="bio"
              rows={4}
              placeholder="Vertel kort wie je bent en wat je maakt..."
              defaultValue={creator?.bio ?? ""}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
            />
          </div>
        </div>
        <input
          type="hidden"
          name="country_code"
          value={
            creator?.country_code ??
            (typeof onboarding?.country_code === "string" ? onboarding.country_code : "") ??
            registrationCountryCode ??
            "BE"
          }
        />

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-[var(--foreground)]">
            Wat doe je op Hobbysalon?
          </legend>
          <div className="mt-3 space-y-2">
            {CREATOR_TYPES.map((type) => (
              <label
                key={type.value}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] px-3 py-2.5"
              >
                <input
                  type="checkbox"
                  name="creator_types"
                  value={type.value}
                  defaultChecked={
                    creator?.creator_types?.includes(type.value) ??
                    (onboardingTypes.length > 0
                      ? onboardingTypes.includes(type.value)
                      : type.value === "maker")
                  }
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium text-[var(--foreground)]">
                    {type.label}
                  </span>
                  <span className="block text-xs text-[var(--muted)]">{type.description}</span>
                </span>
              </label>
            ))}
          </div>
          {showSupplierHint && (
            <p className="mt-3 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
              Verkoop je garen, stof of hobbybenodigdheden?{" "}
              <Link
                href={`/register/merchant?next=${encodeURIComponent("/dashboard/materials")}`}
                className="font-medium underline"
              >
                Activeer je winkel
              </Link>{" "}
              om producten te importeren en te verkopen.
            </p>
          )}
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-[var(--foreground)]">Je hobby&apos;s</legend>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Kies je hobby&apos;s — zo vindt men je op Hobbysalon.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            {domains.map((domain) => (
              <label
                key={domain.id}
                className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-1.5"
              >
                <input
                  type="checkbox"
                  name="domain_ids"
                  value={domain.id}
                  defaultChecked={selectedDomainIds.has(domain.id)}
                />
                <span className="text-sm">{domain.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <Button type="submit" className="mt-6">
          Profiel opslaan
        </Button>
      </form>
    </CardShell>
  );
}
