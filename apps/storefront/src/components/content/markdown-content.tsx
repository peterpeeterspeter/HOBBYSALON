import React from "react";

type MarkdownContentProps = {
  markdown: string;
  className?: string;
};

/**
 * Slugify a section header into a URL-safe fragment ID.
 * Strips emoji, normalizes diacritics, converts spaces to hyphens.
 * "🌸 IN HET KORT" → "in-het-kort"
 */
function slugify(text: string): string {
  return text
    // eslint-disable-next-line no-misleading-character-class
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Detect emoji+UPPERCASE section headers like "🌸 IN HET KORT".
 * These paragraphs get an id so fragment links (#...) can jump to them.
 */
const SECTION_HEADER_RE = /^[\p{Emoji}\u200D\uFE0F]+\s+[A-ZÀ-Þ0-9][A-ZÀ-Þ0-9\s'"()?/&+-]*$/u;

function normalizeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  // Same-page fragment link (#section-name)
  if (value.startsWith("#")) {
    return value;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const tokenRegex = /!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)/g;

  let cursor = 0;
  let match: RegExpExecArray | null;
  let tokenIndex = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }

    if (match[1] !== undefined && match[2] !== undefined) {
      const alt = match[1] ?? "";
      const src = normalizeUrl(match[2]);
      if (src) {
        nodes.push(
          <img
            key={`${keyPrefix}-img-${tokenIndex}`}
            src={src}
            alt={alt}
            loading="lazy"
            className="my-3 w-full rounded-lg border border-[var(--border)]"
          />
        );
      } else {
        nodes.push(match[0]);
      }
    } else if (match[3] !== undefined && match[4] !== undefined) {
      const href = normalizeUrl(match[4]);
      if (href) {
        const label = renderInline(match[3], `${keyPrefix}-link-label-${tokenIndex}`);
        const isFragment = href.startsWith("#");
        nodes.push(
          <a
            key={`${keyPrefix}-link-${tokenIndex}`}
            href={href}
            {...(isFragment ? {} : { target: "_blank", rel: "noreferrer" })}
            className="text-[var(--accent)] underline underline-offset-2"
          >
            {label}
          </a>
        );
      } else {
        nodes.push(match[0]);
      }
    } else {
      nodes.push(match[0]);
    }

    cursor = tokenRegex.lastIndex;
    tokenIndex += 1;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

export function MarkdownContent({ markdown, className }: MarkdownContentProps) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const nodes: React.ReactNode[] = [];
  let paragraph: string[] = [];
  let nodeIndex = 0;

  const flushParagraph = () => {
    const text = paragraph.join(" ").trim();
    paragraph = [];
    if (!text) return;

    const sectionId = SECTION_HEADER_RE.test(text) ? slugify(text) : undefined;
    nodes.push(
      <p
        key={`p-${nodeIndex++}`}
        {...(sectionId
          ? {
              id: sectionId,
              "data-section": "header",
              className: "mt-6 mb-2 text-lg font-bold text-[var(--foreground)] scroll-mt-20",
            }
          : { className: "my-4 leading-7 text-[var(--foreground)]" })}
      >
        {renderInline(text, `p${nodeIndex}`)}
      </p>
    );
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      const level = Math.min(headingMatch[1].length + 1, 4);
      const content = renderInline(headingMatch[2], `h${nodeIndex}`);
      const headingClassName =
        level === 2
          ? "mt-6 text-2xl font-semibold text-[var(--foreground)]"
          : level === 3
            ? "mt-5 text-xl font-semibold text-[var(--foreground)]"
            : "mt-4 text-lg font-semibold text-[var(--foreground)]";
      const Heading = (`h${level}`) as React.ElementType;
      nodes.push(
        <Heading key={`h-${nodeIndex++}`} className={headingClassName}>
          {content}
        </Heading>
      );
      continue;
    }

    const listMatch = trimmed.match(/^([-*+] |\d+[.)] )(.+)$/);
    if (listMatch) {
      flushParagraph();
      const ordered = /^\d/.test(listMatch[1]);
      const items: string[] = [listMatch[2]];
      while (index + 1 < lines.length) {
        const nextMatch = lines[index + 1].trim().match(/^([-*+] |\d+[.)] )(.+)$/);
        if (!nextMatch || /^\d/.test(nextMatch[1]) !== ordered) break;
        items.push(nextMatch[2]);
        index += 1;
      }
      const List = (ordered ? "ol" : "ul") as React.ElementType;
      nodes.push(
        <List
          key={`list-${nodeIndex++}`}
          className={`${ordered ? "list-decimal" : "list-disc"} my-4 space-y-1 pl-5 text-[var(--foreground)]`}
        >
          {items.map((item, itemIndex) => (
            <li key={`li-${nodeIndex}-${itemIndex}`}>{renderInline(item, `l${nodeIndex}-${itemIndex}`)}</li>
          ))}
        </List>
      );
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  return <div className={className}>{nodes}</div>;
}
