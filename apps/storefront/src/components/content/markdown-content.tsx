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

function renderBlock(block: string, index: number): React.ReactNode {
  const trimmed = block.trim();
  if (!trimmed) return null;

  const lines = trimmed.split("\n").map((line) => line.trimEnd());

  if (lines.every((line) => line.startsWith("- "))) {
    return (
      <ul key={`block-${index}`} className="my-4 list-disc space-y-1 pl-5 text-[var(--foreground)]">
        {lines.map((line, liIndex) => (
          <li key={`li-${index}-${liIndex}`}>{renderInline(line.slice(2), `b${index}-li${liIndex}`)}</li>
        ))}
      </ul>
    );
  }

  const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    const content = renderInline(headingMatch[2], `b${index}-h`);
    if (level === 1) {
      return (
        <h2 key={`h-${index}`} className="mt-6 text-2xl font-semibold text-[var(--foreground)]">
          {content}
        </h2>
      );
    }
    if (level === 2) {
      return (
        <h3 key={`h-${index}`} className="mt-5 text-xl font-semibold text-[var(--foreground)]">
          {content}
        </h3>
      );
    }
    return (
      <h4 key={`h-${index}`} className="mt-4 text-lg font-semibold text-[var(--foreground)]">
        {content}
      </h4>
    );
  }

  // Check if this paragraph is an emoji+UPPERCASE section header
  const sectionId = SECTION_HEADER_RE.test(trimmed) ? slugify(trimmed) : undefined;

  return (
    <p
      key={`p-${index}`}
      {...(sectionId ? { id: sectionId, "data-section": "header", className: "mt-6 mb-2 text-lg font-bold text-[var(--foreground)] scroll-mt-20" } : { className: "my-4 whitespace-pre-wrap leading-7 text-[var(--foreground)]" })}
    >
      {renderInline(trimmed, `b${index}-p`)}
    </p>
  );
}

export function MarkdownContent({ markdown, className }: MarkdownContentProps) {
  const blocks = markdown
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);

  return <div className={className}>{blocks.map((block, index) => renderBlock(block, index))}</div>;
}
