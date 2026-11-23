export interface SecureSessionRecord {
  readonly tokenHint: string;
  readonly userId: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly storageBacking: string;
}

/**
 * Abstraction over hardware-backed mobile credential storage.
 */
export interface ISecureTokenStore {
  getSession(): Promise<SecureSessionRecord | null>;
  getBearerToken(): Promise<string | null>;
  saveSession(bearerToken: string, session: SecureSessionRecord): Promise<void>;
  clearAndWipeAllLocalCache(): Promise<void>;
}
