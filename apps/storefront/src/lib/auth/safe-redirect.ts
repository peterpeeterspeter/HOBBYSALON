/** Same-origin path policy shared by login redirects and persisted auth targets. */
export function sanitizeInternalRedirect(
  requestedPath: string | null | undefined,
  options: { trim?: boolean } = {}
): string | null {
  if (!requestedPath) return null;
  // Check before trimming/parsing: URL parsers silently discard some controls.
  const forbidden = /[\\\u0000-\u001f\u007f-\u009f]/u;
  if (forbidden.test(requestedPath)) return null;
  const candidate = options.trim === false ? requestedPath : requestedPath.trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return null;

  try {
    const base = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.hobbysalon.be");
    if (base.protocol !== "https:" && base.protocol !== "http:") return null;
    const normalized = new URL(candidate, base.origin);
    // Reject malformed escapes, even if WHATWG URL would preserve them.
    decodeURIComponent(candidate);
    let probe = candidate;
    for (let depth = 0; depth < 8; depth += 1) {
      if (forbidden.test(probe) || !probe.startsWith("/") || probe.startsWith("//")) return null;
      const parsed = new URL(probe, base.origin);
      // Dot-segment normalization can produce a protocol-relative pathname.
      if (parsed.origin !== base.origin || parsed.pathname.startsWith("//")) return null;
      // Inspect nested encodings without changing the returned query. A literal
      // percent produced by decoding %25 is not itself another escape.
      const decoded = decodeURIComponent(probe.replace(/%(?![\da-f]{2})/gi, "%25"));
      if (decoded === probe) {
        // Both existing auth flows intentionally discard fragments.
        return normalized.pathname + normalized.search;
      }
      probe = decoded;
    }
    // Excessively nested encodings are ambiguous: fail closed.
    return null;
  } catch {
    return null;
  }
}
