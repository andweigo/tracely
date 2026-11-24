import { WebRoute } from '../domain/types';

const VALID_ROUTES = new Set<WebRoute>([
  'dashboard',
  'inbox',
  'send',
  'sent',
  'completed',
  'document',
  'track',
  'analytics',
  'categories',
  'alerts',
  'profile',
  'user_profile',
  'settings',
  'verify',
  'pending_approval',
  'login',
]);

export interface ParsedWebHash {
  readonly route: WebRoute;
  readonly documentId: string | null;
  readonly verifyToken: string | null;
}

export function parseWebHash(rawHash: string): ParsedWebHash {
  const cleaned = rawHash.replace(/^#\/?/, '').trim();
  if (!cleaned) {
    return { route: 'dashboard', documentId: null, verifyToken: null };
  }
  const [firstSegment, secondSegment] = cleaned.split('/');
  if (firstSegment === 'document' && secondSegment) {
    return {
      route: 'document',
      documentId: decodeURIComponent(secondSegment),
      verifyToken: null,
    };
  }
  if (firstSegment === 'verify') {
    return {
      route: 'verify',
      documentId: null,
      verifyToken: secondSegment ? decodeURIComponent(secondSegment) : null,
    };
  }
  if (VALID_ROUTES.has(firstSegment as WebRoute)) {
    return {
      route: firstSegment as WebRoute,
      documentId: null,
      verifyToken: null,
    };
  }
  return { route: 'inbox', documentId: null, verifyToken: null };
}

export function formatWebHash(
  route: WebRoute,
  documentId: string | null,
  verifyToken?: string | null,
): string {
  if (route === 'document' && documentId) {
    return `#/document/${encodeURIComponent(documentId)}`;
  }
  if (route === 'verify' && verifyToken) {
    return `#/verify/${encodeURIComponent(verifyToken)}`;
  }
  return `#/${route}`;
}
