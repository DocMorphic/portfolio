import { NextResponse } from "next/server";

// Fetch a remote page and extract its <title> tag server-side. Used by
// the Blog app when the user submits a URL without a title.
//
// SECURITY:
// - Only http / https schemes allowed.
// - Reject localhost, loopback, private / link-local IPs (basic SSRF).
// - 5-second timeout via AbortController.
// - Response trimmed to 200 chars.

const MAX_TITLE_LEN = 200;
const FETCH_TIMEOUT_MS = 5000;

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "0.0.0.0") return true;
  // IPv4 loopback + private ranges
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  // 172.16.0.0/12
  const m = /^172\.(\d+)\./.exec(h);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  // Basic IPv6 loopback + link-local
  if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) {
    return true;
  }
  return false;
}

function validateUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (isBlockedHost(u.hostname)) return null;
    return u;
  } catch {
    return null;
  }
}

// Small HTML entity decoder — covers the common ones. For more exotic
// entities we'd use a library, but for <title> tags the short list below
// handles almost everything in practice.
function decodeEntities(s: string): string {
  const named: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
    "&mdash;": "—",
    "&ndash;": "–",
    "&hellip;": "…",
    "&lsquo;": "\u2018",
    "&rsquo;": "\u2019",
    "&ldquo;": "\u201C",
    "&rdquo;": "\u201D",
  };
  return s
    .replace(/&[a-zA-Z#0-9]+;/g, (entity) => {
      if (named[entity]) return named[entity];
      const numericHex = /^&#x([0-9a-fA-F]+);$/.exec(entity);
      if (numericHex) return String.fromCodePoint(parseInt(numericHex[1], 16));
      const numeric = /^&#(\d+);$/.exec(entity);
      if (numeric) return String.fromCodePoint(parseInt(numeric[1], 10));
      return entity;
    });
}

function extractTitle(html: string): string {
  // Case-insensitive, dot matches newlines
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!match) return "";
  const raw = match[1]
    .replace(/\s+/g, " ") // collapse whitespace
    .trim();
  const decoded = decodeEntities(raw);
  return decoded.slice(0, MAX_TITLE_LEN);
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ title: "" });
  }

  const rawUrl = (body as { url?: string })?.url;
  if (typeof rawUrl !== "string") {
    return NextResponse.json({ title: "" });
  }

  const url = validateUrl(rawUrl);
  if (!url) {
    return NextResponse.json({ title: "" }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "dharmay-portfolio-bot/1.0 (+https://github.com/DocMorphic/portfolio)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(timer);

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("html")) {
      return NextResponse.json({ title: "" });
    }

    const text = await res.text();
    const title = extractTitle(text);
    return NextResponse.json({ title });
  } catch {
    clearTimeout(timer);
    return NextResponse.json({ title: "" });
  }
}
