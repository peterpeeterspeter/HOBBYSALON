/**
 * Read-only companion discovery from explicit links in published editorial copy.
 * This deliberately supports inline Markdown links, not inferred relations,
 * HTML/autolinks or reference definitions. It never assigns a next_step role.
 */

function isEscaped(text: string, index: number): boolean {
  let backslashes = 0;
  while (index > 0 && text[--index] === "\\") backslashes += 1;
  return backslashes % 2 === 1;
}

function withoutCode(markdown: string): string {
  let fence: { marker: string; length: number } | null = null;
  const prose = markdown.split(/\r?\n/).map((line) => {
    // Fences can be nested in blockquotes or list items. Strip only container
    // prefixes for fence detection, leaving ordinary editorial text untouched.
    let fenceLine = line;
    let previous: string;
    do {
      previous = fenceLine;
      fenceLine = fenceLine.replace(/^[ \t]*(?:>[ \t]?|(?:[-+*]|\d+[.)])[ \t]+)/, "");
    } while (fenceLine !== previous);
    const marker = fenceLine.match(/^[ \t]*(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence.marker && marker[1].length >= fence.length && !marker[2].trim()) {
        fence = null;
      }
      return "";
    }
    if (marker) {
      fence = { marker: marker[1][0], length: marker[1].length };
      return "";
    }
    // Conservative: indented examples are not editorial recommendations.
    return /^(?: {4}|\t)/.test(line) ? "" : line;
  }).join("\n").replace(/<!--[\s\S]*?(?:-->|$)/g, "");

  // Match equal-length backtick delimiters; a shorter run cannot close a span.
  let result = "";
  for (let index = 0; index < prose.length;) {
    if (prose[index] !== "`" || isEscaped(prose, index)) {
      result += prose[index++];
      continue;
    }
    const start = index;
    while (prose[index] === "`") index += 1;
    const length = index - start;
    let end = index;
    let closed = false;
    while (end < prose.length) {
      if (prose[end] !== "`") { end += 1; continue; }
      const runStart = end;
      while (prose[end] === "`") end += 1;
      if (end - runStart === length) { closed = true; break; }
    }
    if (closed) {
      result += " ";
      index = end;
    } else {
      result += prose.slice(start, index);
    }
  }
  return result;
}

function articleSlugFromHref(href: string): string | null {
  // Reject WHATWG URL normalization tricks before parsing: no backslashes,
  // credentials, alternate ports, protocol-relative URLs or encoded authorities.
  if (/[\s\\\u0000-\u001f\u007f]/u.test(href)) return null;
  const path = href.startsWith("/artikel/")
    ? href
    : href.match(/^https:\/\/(?:www\.)?hobbysalon\.be(\/artikel\/.*)$/i)?.[1];
  if (!path) return null;
  const match = path.match(/^\/artikel\/([^/?#]+)\/?(?:[?#].*)?$/);
  if (!match) return null;
  try {
    const slug = decodeURIComponent(match[1]).normalize("NFC");
    // Decode once; reject traversal, separators, double encoding and ambiguity.
    return /^[\p{L}\p{M}\p{N}_-]+$/u.test(slug) ? slug : null;
  } catch {
    return null;
  }
}

/** Unique explicit same-site companion slugs, in the author's body order. */
export function extractArticleEditorialSlugs(
  bodyMarkdown: string | null | undefined,
  selfSlug: string
): string[] {
  if (!bodyMarkdown) return [];
  const prose = withoutCode(bodyMarkdown);
  const slugs: string[] = [];
  const seen = new Set([selfSlug.normalize("NFC")]);
  // Only a balanced label followed by a destination excludes nested fragments.
  // An unmatched prose bracket must not poison subsequent paragraphs/links.
  const nestedLabelRanges: Array<{ start: number; end: number }> = [];
  const opens: number[] = [];
  for (let index = 0; index < prose.length; index += 1) {
    if (prose[index] === "\n" && /^\n[ \t]*\n/.test(prose.slice(index))) opens.length = 0;
    if (isEscaped(prose, index)) continue;
    if (prose[index] === "[") opens.push(index);
    else if (prose[index] === "]" && opens.length) {
      const start = opens.pop()!;
      if (prose[index + 1] === "(") nestedLabelRanges.push({ start, end: index });
    }
  }
  // An optional Markdown title is allowed; nested labels/images are not guessed.
  const links = /!?\[[^\[\]\n]*\]\(\s*(?:<([^<>\n]+)>|([^\s()<>]+))(?:\s+(?:"[^"\n]*"|'[^'\n]*'))?\s*\)/g;
  for (const match of prose.matchAll(links)) {
    if (match[0].startsWith("!") || isEscaped(prose, match.index!) ||
      nestedLabelRanges.some(range => range.start < match.index! && match.index! < range.end)) continue;
    const slug = articleSlugFromHref(match[1] ?? match[2]);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    slugs.push(slug);
  }
  return slugs;
}
