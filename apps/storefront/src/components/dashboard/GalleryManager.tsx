import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";

/** Extra photos with a confirmed delete button under each one. */
export function GalleryManager({
  images,
  action,
  returnTo,
}: {
  images: Array<{ id: string; image_url: string }>;
  action: (formData: FormData) => Promise<void>;
  returnTo: string;
}) {
  if (images.length === 0) return null;
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 md:p-7">
      <h2 className="text-2xl font-bold text-[var(--foreground)]">
        Extra foto&apos;s ({images.length})
      </h2>
      <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((image) => (
          <li key={image.id} className="space-y-2">
            <img
              src={image.image_url}
              alt=""
              className="aspect-square w-full rounded-xl border border-[var(--border)] object-cover"
            />
            <form action={action}>
              <input type="hidden" name="gallery_image_id" value={image.id} />
              <input type="hidden" name="return_to" value={returnTo} />
              <ConfirmSubmitButton
                variant="secondary"
                fullWidth
                message="Deze foto verwijderen? Dit kan je niet ongedaan maken."
              >
                Verwijderen
              </ConfirmSubmitButton>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
