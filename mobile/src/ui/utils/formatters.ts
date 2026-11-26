const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const absMins = Math.round(Math.abs(diffMs) / 60_000);
  const suffix = diffMs >= 0 ? 'ago' : 'left';
  if (absMins < 1) return diffMs >= 0 ? 'just now' : 'due now';
  if (absMins < 60) return `${absMins}m ${suffix}`;
  const hours = Math.round(absMins / 60);
  if (hours < 24) return `${hours}h ${suffix}`;
  const days = Math.round(hours / 24);
  return `${days}d ${suffix}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatShortTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const month = MONTHS[date.getMonth()] ?? 'Jan';
  const day = date.getDate();
  const rawHours = date.getHours();
  const period = rawHours >= 12 ? 'PM' : 'AM';
  const hour12 = rawHours % 12 === 0 ? 12 : rawHours % 12;
  const mins = String(date.getMinutes()).padStart(2, '0');
  return `${month} ${day}, ${hour12}:${mins} ${period}`;
}

export function formatCompactDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTHS[date.getMonth()] ?? 'Jan';
  const year = String(date.getFullYear()).slice(-2);
  return `${day} ${month}, '${year}`;
}

export function formatClockTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const rawHours = date.getHours();
  const period = rawHours >= 12 ? 'PM' : 'AM';
  const hour12 = String(rawHours % 12 === 0 ? 12 : rawHours % 12).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  return `${hour12}:${mins} ${period}`;
}

export function buildBatchItemTitle(
  baseTitle: string,
  fileName: string,
  maxLength = 140,
): string {
  const cleanBase = baseTitle.trim();
  const stem = fileName.trim().replace(/\.[^.]+$/, '').trim();
  if (!stem) return cleanBase.slice(0, maxLength);
  const combined = `${cleanBase} — ${stem}`;
  return combined.length <= maxLength ? combined : combined.slice(0, maxLength).trim();
}

/**
 * Safely decodes URI-encoded default filenames and strips accidental OS/Android
 * path or content-provider prefixes (e.g. `primary:Download/`, `content://...`).
 */
export function formatDisplayFileName(rawFileName: string, fallback = 'document'): string {
  const trimmed = rawFileName.trim();
  if (!trimmed) return fallback;

  let decoded = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed.replace(/[?#].*$/, '')
    : trimmed;

  for (let pass = 0; pass < 2; pass += 1) {
    if (!/%[0-9A-Fa-f]{2}/.test(decoded)) break;
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }

  const normalizedSlashes = decoded.replace(/\\+/g, '/');
  const lastSegment = normalizedSlashes.split('/').pop() ?? normalizedSlashes;
  const withoutProviderPrefix = lastSegment.replace(
    /^(?:primary|home|raw|document|msf|downloads):/i,
    '',
  );
  const baseSegment = (withoutProviderPrefix.split('/').pop() ?? withoutProviderPrefix).trim();

  const printable = Array.from(baseSegment)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

  return printable || fallback;
}

/**
 * Sanitizes a user-edited upload filename while preserving the original file extension
 * so renaming never accidentally drops `.pdf`, `.jpg`, `.png`, or `.webp`.
 */
export function normalizeUploadFileName(
  customName: string,
  originalFileName: string,
  maxLength = 180,
): string {
  const fallback = formatDisplayFileName(originalFileName, 'document');
  const extMatch = /\.([a-z0-9]{1,8})$/i.exec(fallback);
  const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '';

  const decodedCustom = formatDisplayFileName(customName, '');
  const stripped = decodedCustom
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\.+|\.+$/g, '')
    .trim();

  if (!stripped) {
    return fallback.slice(0, maxLength);
  }

  let candidate = stripped;
  if (ext && !candidate.toLowerCase().endsWith(ext)) {
    candidate = `${candidate}${ext}`;
  }

  if (candidate.length <= maxLength) {
    return candidate;
  }

  const stemLimit = Math.max(1, maxLength - ext.length);
  const stem =
    ext && candidate.toLowerCase().endsWith(ext)
      ? candidate.slice(0, candidate.length - ext.length)
      : candidate;
  return `${stem.slice(0, stemLimit).trimEnd()}${ext}`;
}
