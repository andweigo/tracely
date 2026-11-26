export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 10 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return 'No SLA';
  const target = new Date(isoString).getTime();
  if (Number.isNaN(target)) return '';
  const diffMs = target - Date.now();
  const absMins = Math.round(Math.abs(diffMs) / 60000);
  if (absMins < 60) {
    return diffMs >= 0 ? `Due in ${absMins}m` : `${absMins}m overdue`;
  }
  const absHours = Math.round(absMins / 60);
  if (absHours < 48) {
    return diffMs >= 0 ? `Due in ${absHours}h` : `${absHours}h overdue`;
  }
  const absDays = Math.round(absHours / 24);
  return diffMs >= 0 ? `Due in ${absDays}d` : `${absDays}d overdue`;
}

export function formatClockTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatCompactDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatElapsedTime(isoString: string | null | undefined, nowMs = Date.now()): string {
  if (!isoString) return '';
  const ts = new Date(isoString).getTime();
  if (Number.isNaN(ts)) return '';
  const diffMs = Math.max(0, nowMs - ts);
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatCompactDate(isoString);
}

export async function computeFileSha256(file: File): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof file.arrayBuffer === 'function') {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    const bytes = Array.from(new Uint8Array(digest));
    return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return '0'.repeat(64);
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
 * path or content-provider prefixes (e.g. `primary:Download/`, `C:\fakepath\`).
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
 * so renaming the filename never strips `.pdf`, `.jpg`, `.png`, or `.webp`.
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
