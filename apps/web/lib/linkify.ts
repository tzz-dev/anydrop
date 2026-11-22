export type TextPart = { type: "text"; value: string } | { type: "link"; value: string; href: string };

const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/g;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}、。，！？）」』]+$/;

// Splits text into plain parts and http(s) links. Only those two schemes are
// ever turned into links, so received text can't smuggle in javascript: URLs.
export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    const raw = match[0];
    const url = raw.replace(TRAILING_PUNCTUATION, "");

    let href: string | null = null;
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") href = parsed.href;
    } catch {
      // not a valid URL; leave as text
    }
    if (!href) continue;

    if (start > last) parts.push({ type: "text", value: text.slice(last, start) });
    parts.push({ type: "link", value: url, href });
    last = start + url.length;
  }

  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}
