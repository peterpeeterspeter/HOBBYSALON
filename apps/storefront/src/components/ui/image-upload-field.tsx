type ImageUploadFieldProps = {
  name: string;
  label: string;
  hint?: string;
  currentUrl?: string | null;
  required?: boolean;
  previewClassName?: string;
};

export function ImageUploadField({
  name,
  label,
  hint,
  currentUrl,
  required = false,
  previewClassName = "h-24 w-24 rounded-lg object-cover",
}: ImageUploadFieldProps) {
  const needsFile = required && !currentUrl;

  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
        {label}
      </label>
      {currentUrl ? (
        <img
          src={currentUrl}
          alt=""
          className={`mb-2 border border-[var(--border)] ${previewClassName}`}
        />
      ) : null}
      <input
        id={name}
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/webp,image/gif"
        required={needsFile}
        className="block w-full text-sm text-[var(--foreground)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--accent)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--accent-foreground)] hover:file:bg-[var(--accent-hover)]"
      />
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
      <p className="mt-1 text-xs text-[var(--muted)]">JPEG, PNG, WebP of GIF · max. 5 MB</p>
    </div>
  );
}
