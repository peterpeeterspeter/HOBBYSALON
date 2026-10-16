/**
 * Minimal HTML sanitizer for trusted newsletter archive bodies.
 * Strips scripts, event handlers, and javascript: URLs. Keeps common
 * email markup (tables, inline styles, links, lists, headings).
 */

const BLOCKED_TAGS =
  /<\/?(?:script|iframe|object|embed|link|meta|base|form|input|button|textarea|select|style)\b[^>]*>/gi;

const EVENT_HANDLER_ATTR = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

const JS_URL_ATTR =
  /(\s(?:href|src)\s*=\s*)(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]+)/gi;

export function sanitizeNewsletterHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(BLOCKED_TAGS, "")
    .replace(EVENT_HANDLER_ATTR, "")
    .replace(JS_URL_ATTR, '$1"#"')
    .replace(/\*\|UNSUBSCRIBE_URL\|\*/g, "#");
}
