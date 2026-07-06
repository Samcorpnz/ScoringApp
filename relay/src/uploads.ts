// Shared upload validation/sanitization for the relay's image routes (logo,
// competition logo, player photo). Uploads run through memory storage so the
// handler sees the raw bytes before persisting — that lets us both sanitize
// SVGs (a `<script>`-bearing SVG served from our origin is a stored-XSS
// vector) and reject files whose content doesn't match their declared MIME.

// jsdom + DOMPurify are lazy-loaded on first SVG upload so the (heavy) jsdom
// dependency graph isn't pulled into the import graph of every route/test that
// merely imports this module — only the SVG sanitization path needs it.
type Sanitizer = { sanitize: (dirty: string, cfg: object) => string };
let _domPurify: Sanitizer | null = null;
function getDomPurify(): Sanitizer {
  if (!_domPurify) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { JSDOM } = require("jsdom");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const createDOMPurify = require("dompurify");
    _domPurify = createDOMPurify(new JSDOM("").window) as Sanitizer;
  }
  return _domPurify;
}

// Route params that become on-disk filenames / R2 keys (e.g. :playerId, a
// cuid) must be a single safe segment — otherwise a URL-encoded `..%2f`
// decodes to `../` and `path.join` escapes the org directory.
export function safeSegment(v: unknown): string | null {
  const s = String(v ?? "");
  return /^[A-Za-z0-9_-]+$/.test(s) ? s : null;
}

// Strip scripts/event handlers/foreignObject etc. from an SVG so it's inert
// when served directly from our origin.
export function sanitizeSvgBuffer(buffer: Buffer): Buffer {
  const clean = getDomPurify().sanitize(buffer.toString("utf8"), {
    USE_PROFILES: { svg: true, svgFilters: true },
  });
  return Buffer.from(clean, "utf8");
}

// True when the buffer's leading bytes match the declared image MIME. SVG is
// text-based and has no reliable signature, so it's handled by sanitization
// (see validateImageUpload) rather than this check.
export function imageMagicBytesMatch(buffer: Buffer, mime: string): boolean {
  const b = buffer;
  switch (mime) {
    case "image/png":
      return b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
    case "image/jpeg":
      return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case "image/gif":
      return b.length >= 3 && b.toString("ascii", 0, 3) === "GIF";
    case "image/webp":
      return b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP";
    default:
      return false;
  }
}

export class UploadValidationError extends Error {}

// Returns the bytes to persist for an image upload, sanitizing SVGs and
// rejecting non-SVG files whose content doesn't match their declared MIME.
// Throws UploadValidationError on a mismatch (callers map this to a 400).
export function validateImageUpload(mimetype: string, buffer: Buffer): Buffer {
  if (mimetype === "image/svg+xml") {
    return sanitizeSvgBuffer(buffer);
  }
  if (!imageMagicBytesMatch(buffer, mimetype)) {
    throw new UploadValidationError("file content does not match its declared type");
  }
  return buffer;
}
