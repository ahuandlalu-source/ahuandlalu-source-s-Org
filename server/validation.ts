import crypto from 'crypto';

export function isValidSafeUrl(value: string | null | undefined): boolean {
  if (!value || value.trim() === '') return true;
  const trimmed = value.trim();
  // Allow safe root-relative application paths
  if (trimmed.startsWith('/')) {
    return !trimmed.startsWith('//');
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function sanitizeText(value: unknown, maxLen = 2000): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

export function isValidIsoDate(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeCsvCell(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  const formulaSafe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${formulaSafe.replace(/"/g, '""')}"`;
}

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const ALLOWED_VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const ALLOWED_AUDIO_MIMES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/aac',
  'audio/mp4',
]);

export function classifyUploadMime(
  mimeType: string
): 'photo' | 'video' | 'audio' | null {
  const normalized = mimeType.toLowerCase().split(';')[0].trim();
  if (ALLOWED_IMAGE_MIMES.has(normalized)) return 'photo';
  if (ALLOWED_VIDEO_MIMES.has(normalized)) return 'video';
  if (ALLOWED_AUDIO_MIMES.has(normalized)) return 'audio';
  return null;
}

export function extensionForMime(mimeType: string): string {
  const normalized = mimeType.toLowerCase().split(';')[0].trim();
  switch (normalized) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    case 'video/mp4':
      return '.mp4';
    case 'video/webm':
      return '.webm';
    case 'video/quicktime':
      return '.mov';
    case 'audio/mpeg':
    case 'audio/mp3':
      return '.mp3';
    case 'audio/wav':
    case 'audio/x-wav':
      return '.wav';
    case 'audio/ogg':
      return '.ogg';
    case 'audio/aac':
      return '.aac';
    case 'audio/mp4':
      return '.m4a';
    default:
      return '.bin';
  }
}

export const MAX_WISH_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

function detectImageMagicMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }
  // GIF: GIF87a or GIF89a
  const header6 = buf.subarray(0, 6).toString('ascii');
  if (header6 === 'GIF87a' || header6 === 'GIF89a') {
    return 'image/gif';
  }
  // WebP: RIFF....WEBP
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export function validateAndDecodeWishPhoto(
  dataUrl: string
): {buffer: Buffer; mimeType: string; extension: string} {
  const trimmed = dataUrl.trim();
  const match = /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/i.exec(
    trimmed
  );
  if (!match) {
    throw new Error(
      'Uploaded wish photo must be a valid JPEG, PNG, WebP, or GIF image.'
    );
  }

  const base64Payload = match[2];
  const estimatedBytes = Math.floor((base64Payload.length * 3) / 4);
  if (estimatedBytes > MAX_WISH_PHOTO_BYTES + 1024) {
    throw new Error('Wish photograph must be 5 MB or smaller.');
  }

  const buffer = Buffer.from(base64Payload, 'base64');
  if (buffer.length === 0 || buffer.length > MAX_WISH_PHOTO_BYTES) {
    throw new Error('Wish photograph must be between 1 byte and 5 MB.');
  }

  const detectedMime = detectImageMagicMime(buffer);
  if (!detectedMime || !ALLOWED_IMAGE_MIMES.has(detectedMime)) {
    throw new Error(
      'File signature could not be verified as a JPEG, PNG, WebP, or GIF image.'
    );
  }

  return {
    buffer,
    mimeType: detectedMime,
    extension: extensionForMime(detectedMime),
  };
}

// Sliding-window rate limiter for public submissions
const rateLimitBuckets = new Map<string, number[]>();

export function checkSlidingRateLimit(
  bucket: string,
  key: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const fullKey = `${bucket}:${key}`;
  const now = Date.now();
  const cutoff = now - windowMs;
  const recent = (rateLimitBuckets.get(fullKey) || []).filter((ts) => ts > cutoff);
  if (recent.length >= maxRequests) {
    rateLimitBuckets.set(fullKey, recent);
    return false;
  }
  recent.push(now);
  rateLimitBuckets.set(fullKey, recent);
  return true;
}

// HMAC-signed short-lived access tokens so Admin UI can view pending/rejected wish photos privately
const PHOTO_SIGN_FALLBACK = crypto.randomBytes(32).toString('hex');
function getPhotoSignSecret(): string {
  return process.env.SESSION_SECRET || PHOTO_SIGN_FALLBACK;
}

export function signWishPhotoToken(wishId: string, ttlMs = 4 * 60 * 60 * 1000): string {
  const exp = Date.now() + ttlMs;
  const payload = Buffer.from(JSON.stringify({id: wishId, exp})).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getPhotoSignSecret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyWishPhotoToken(token: string, expectedWishId: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  if (!payload || !sig) return false;

  const expectedSig = crypto
    .createHmac('sha256', getPhotoSignSecret())
    .update(payload)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as {id?: string; exp?: number};
    return parsed.id === expectedWishId && typeof parsed.exp === 'number' && Date.now() <= parsed.exp;
  } catch {
    return false;
  }
}

export function signDrivePreviewToken(
  driveFileId: string,
  ttlMs = 2 * 60 * 60 * 1000
): string {
  const exp = Date.now() + ttlMs;
  const payload = Buffer.from(
    JSON.stringify({driveFileId, exp})
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getPhotoSignSecret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyDrivePreviewToken(
  token: string,
  expectedDriveFileId: string
): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  if (!payload || !sig) return false;

  const expectedSig = crypto
    .createHmac('sha256', getPhotoSignSecret())
    .update(payload)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as {driveFileId?: string; exp?: number};
    return (
      parsed.driveFileId === expectedDriveFileId &&
      typeof parsed.exp === 'number' &&
      Date.now() <= parsed.exp
    );
  } catch {
    return false;
  }
}

export function validateDriveDownloadedMedia(
  buffer: Buffer,
  declaredMime: string
): {mediaType: 'photo' | 'video' | 'audio'; mimeType: string; extension: string} {
  if (!buffer || buffer.length === 0) {
    throw new Error('Downloaded file from Google Drive was empty.');
  }
  const normalized = declaredMime.toLowerCase().split(';')[0].trim();
  const kind = classifyUploadMime(normalized);
  if (!kind) {
    throw new Error(`Unsupported media MIME type: ${declaredMime}`);
  }
  if (kind === 'photo') {
    const detected = detectImageMagicMime(buffer);
    if (!detected) {
      throw new Error(
        'Downloaded image file failed binary signature verification.'
      );
    }
    return {
      mediaType: 'photo',
      mimeType: detected,
      extension: extensionForMime(detected),
    };
  }
  return {
    mediaType: kind,
    mimeType: normalized,
    extension: extensionForMime(normalized),
  };
}

