import { Platform } from 'react-native';
import { DomainRuleError } from '../domain/base/DomainRuleError';
import {
  OfficeSummary,
  Personnel,
  ProfileUpdatePayload,
  UserWorkflowPreferences,
} from '../domain/entities/Personnel';
import type { ActiveDeviceSession } from '../domain/entities/UserSecurityProfile';
import { AvailabilityStatus } from '../domain/enums/DomainEnums';
import { AuthInputPolicy } from '../domain/security/AuthInputPolicy';
import { ApiError } from '../network/ApiClient';
import type { IAuthRepository, LoginResult } from '../repositories/contracts/IAuthRepository';
import type {
  ISecureTokenStore,
  SecureSessionRecord,
} from '../repositories/contracts/ISecureTokenStore';

export interface RegisterAccountInput {
  readonly fullName: string;
  readonly employeeId: string;
  readonly email: string;
  readonly position: string;
  readonly officeCode: string;
  readonly isCustomOffice?: boolean;
  readonly customOfficeName?: string;
  readonly password: string;
  readonly confirmPassword: string;
}

export interface AuthenticatedSessionOutcome {
  readonly actor: Personnel;
  readonly session: SecureSessionRecord;
}

export interface RegistrationOutcome {
  readonly pendingApproval: boolean;
  readonly message: string;
  readonly authSession: AuthenticatedSessionOutcome | null;
}

/**
 * Coordinates hardware-backed session storage, strict input validation,
 * and client-side burst/flood rate-limiting for authentication workflows.
 */
export class AuthSessionService {
  private static readonly AUTH_WINDOW_MS = 60_000;
  private static readonly MAX_AUTH_ATTEMPTS_PER_WINDOW = 5;
  private static readonly CLIENT_RATE_LIMIT_COOLDOWN_MS = 30_000;

  private readonly _authRepo: IAuthRepository;
  private readonly _tokenStore: ISecureTokenStore;
  private _authAttemptTimestamps: number[] = [];
  private _cooldownUntilMs = 0;
  private _inFlightAuth = false;

  constructor(authRepo: IAuthRepository, tokenStore: ISecureTokenStore) {
    this._authRepo = authRepo;
    this._tokenStore = tokenStore;
  }

  public async restoreSession(): Promise<AuthenticatedSessionOutcome | null> {
    const existing = await this._tokenStore.getSession();
    if (!existing) return null;

    const actor = await this._authRepo.fetchCurrentProfile();
    return { actor, session: existing };
  }

  public async getSessionMetadata(): Promise<SecureSessionRecord | null> {
    return this._tokenStore.getSession();
  }

  public async login(identifier: string, password: string): Promise<AuthenticatedSessionOutcome> {
    const validated = AuthInputPolicy.validateLoginCredentials(identifier, password);
    const result = await this._runProtectedAuthAction(() =>
      this._authRepo.login(validated.identifier, validated.password, this._deviceName()),
    );
    return this._saveAuthenticatedSession(result);
  }

  public async register(input: RegisterAccountInput): Promise<RegistrationOutcome> {
    const sanitized = AuthInputPolicy.validateRegistration(input);
    const result = await this._runProtectedAuthAction(() =>
      this._authRepo.register({
        ...sanitized,
        password: input.password,
        deviceName: this._deviceName(),
      }),
    );

    const authSession = result.session
      ? await this._saveAuthenticatedSession(result.session)
      : null;

    return {
      pendingApproval: result.pendingApproval,
      message: result.message,
      authSession,
    };
  }

  public async updateAvailability(
    status: AvailabilityStatus,
    delegateId?: string | null,
    availabilityUntil?: string | null,
  ): Promise<Personnel> {
    return this._authRepo.updateAvailability(status, delegateId, availabilityUntil);
  }

  public async updateProfile(patch: ProfileUpdatePayload): Promise<Personnel> {
    if (!this._authRepo.updateProfile) {
      throw new DomainRuleError('UNSUPPORTED_OPERATION', 'Profile update endpoint is unavailable.');
    }
    return this._authRepo.updateProfile(patch);
  }

  public async updatePreferences(
    patch: Partial<UserWorkflowPreferences>,
  ): Promise<{ user: Personnel; preferences: UserWorkflowPreferences }> {
    if (!this._authRepo.updatePreferences) {
      throw new DomainRuleError(
        'UNSUPPORTED_OPERATION',
        'Preferences update endpoint is unavailable.',
      );
    }
    return this._authRepo.updatePreferences(patch);
  }

  public async listActiveSessions(): Promise<ReadonlyArray<ActiveDeviceSession>> {
    return this._authRepo.listActiveSessions();
  }

  public async requestPasswordReset(
    identifier: string,
  ): Promise<{ message: string; devResetCode?: string }> {
    const clean = identifier.trim();
    if (!clean) {
      throw new DomainRuleError('MISSING_IDENTIFIER', 'Enter your Employee ID or work email.');
    }
    if (!this._authRepo.requestPasswordReset) {
      return {
        message:
          'If an active Tracely account matches that Employee ID or email, a 15-minute reset code has been issued.',
      };
    }
    return this._authRepo.requestPasswordReset(clean);
  }

  public async confirmPasswordReset(
    identifier: string,
    resetCode: string,
    newPassword: string,
    confirmPassword: string,
  ): Promise<string> {
    const cleanId = identifier.trim();
    const cleanCode = resetCode.trim();
    if (!cleanId || !cleanCode) {
      throw new DomainRuleError('MISSING_RESET_FIELDS', 'Enter your account ID and reset code.');
    }
    if (newPassword !== confirmPassword) {
      throw new DomainRuleError('PASSWORD_MISMATCH', 'Password confirmation does not match.');
    }
    const check = AuthInputPolicy.evaluatePassword(newPassword, [cleanId]);
    if (!check.allSatisfied) {
      throw new DomainRuleError(
        'WEAK_PASSWORD',
        'Password must be 8–32 characters with uppercase, lowercase, number, and symbol.',
      );
    }
    if (!this._authRepo.confirmPasswordReset) {
      throw new DomainRuleError('UNSUPPORTED_OPERATION', 'Password reset endpoint is unavailable.');
    }
    return this._authRepo.confirmPasswordReset(cleanId, cleanCode, newPassword);
  }

  public async revokeOtherSessions(): Promise<number> {
    return this._authRepo.revokeOtherSessions();
  }

  public async listPendingUsers(): Promise<ReadonlyArray<Personnel>> {
    if (!this._authRepo.listPendingUsers) return [];
    return this._authRepo.listPendingUsers();
  }

  public async approveUser(userId: string): Promise<Personnel> {
    if (!this._authRepo.approveUser) {
      throw new DomainRuleError('UNSUPPORTED_OPERATION', 'Account approvals are not enabled.');
    }
    return this._authRepo.approveUser(userId);
  }

  public async rejectUser(userId: string, reason?: string): Promise<void> {
    if (!this._authRepo.rejectUser) {
      throw new DomainRuleError('UNSUPPORTED_OPERATION', 'Account approvals are not enabled.');
    }
    await this._authRepo.rejectUser(userId, reason);
  }

  public async listAdminUsers(): Promise<ReadonlyArray<Personnel>> {
    if (!this._authRepo.listAdminUsers) return [];
    return this._authRepo.listAdminUsers();
  }

  public async createAdminUser(payload: {
    fullName: string;
    employeeId: string;
    email: string;
    position: string;
    officeId: string;
    role: string;
    password: string;
  }): Promise<Personnel> {
    if (!this._authRepo.createAdminUser) {
      throw new DomainRuleError('UNSUPPORTED_OPERATION', 'Personnel provisioning is not enabled.');
    }
    return this._authRepo.createAdminUser(payload);
  }

  public async updateAdminUser(
    userId: string,
    patch: {
      fullName?: string;
      email?: string;
      role?: string;
      officeId?: string;
      position?: string;
      availability?: AvailabilityStatus;
      active?: boolean;
      newPassword?: string;
    },
  ): Promise<Personnel> {
    if (!this._authRepo.updateAdminUser) {
      throw new DomainRuleError('UNSUPPORTED_OPERATION', 'Personnel management is not enabled.');
    }
    return this._authRepo.updateAdminUser(userId, patch);
  }

  public async createAdminOffice(payload: { code: string; name: string }): Promise<OfficeSummary> {
    if (!this._authRepo.createAdminOffice) {
      throw new DomainRuleError('UNSUPPORTED_OPERATION', 'Office management is not enabled.');
    }
    return this._authRepo.createAdminOffice(payload);
  }

  public async updateAdminOffice(
    officeId: string,
    patch: { code?: string; name?: string },
  ): Promise<OfficeSummary> {
    if (!this._authRepo.updateAdminOffice) {
      throw new DomainRuleError('UNSUPPORTED_OPERATION', 'Office management is not enabled.');
    }
    return this._authRepo.updateAdminOffice(officeId, patch);
  }

  public async changePassword(
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ): Promise<void> {
    if (!currentPassword || !newPassword) {
      throw new DomainRuleError('EMPTY_PASSWORD', 'Current and new passwords are required.');
    }
    if (newPassword === currentPassword) {
      throw new DomainRuleError(
        'REUSED_PASSWORD',
        'New password must differ from your current password.',
      );
    }
    AuthInputPolicy.assertStrongPassword(newPassword, confirmPassword, 'New password');
    await this._runProtectedAuthAction(() =>
      this._authRepo.changePassword(currentPassword, newPassword),
    );
  }

  public async signOutAndWipeCache(): Promise<void> {
    const bearerToken = await this._tokenStore.getBearerToken();
    if (bearerToken) {
      try {
        await this._authRepo.logout();
      } catch {
        // Always wipe device Keystore & local cache even if offline during sign-out
      }
    }
    await this._tokenStore.clearAndWipeAllLocalCache();
  }

  private async _runProtectedAuthAction<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    if (this._inFlightAuth) {
      throw new DomainRuleError(
        'AUTH_REQUEST_IN_FLIGHT',
        'An authentication request is already in progress. Please wait.',
      );
    }
    if (now < this._cooldownUntilMs) {
      const waitSeconds = Math.max(1, Math.ceil((this._cooldownUntilMs - now) / 1000));
      throw new DomainRuleError(
        'RATE_LIMITED',
        `Too many authentication attempts. Try again in ${waitSeconds}s.`,
      );
    }

    this._authAttemptTimestamps = this._authAttemptTimestamps.filter(
      (ts) => now - ts < AuthSessionService.AUTH_WINDOW_MS,
    );
    if (this._authAttemptTimestamps.length >= AuthSessionService.MAX_AUTH_ATTEMPTS_PER_WINDOW) {
      this._cooldownUntilMs = now + AuthSessionService.CLIENT_RATE_LIMIT_COOLDOWN_MS;
      throw new DomainRuleError(
        'RATE_LIMITED',
        `Too many authentication attempts. Please wait ${
          AuthSessionService.CLIENT_RATE_LIMIT_COOLDOWN_MS / 1000
        }s before retrying.`,
      );
    }

    this._authAttemptTimestamps.push(now);
    this._inFlightAuth = true;
    try {
      return await fn();
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        const retrySeconds = err.retryAfterSeconds ?? 60;
        this._cooldownUntilMs = Date.now() + retrySeconds * 1000;
      }
      throw err;
    } finally {
      this._inFlightAuth = false;
    }
  }

  private async _saveAuthenticatedSession(
    result: LoginResult,
  ): Promise<AuthenticatedSessionOutcome> {
    const tokenTail = result.bearerToken.slice(-4);
    const session: SecureSessionRecord = {
      tokenHint: `trc_mob_••••${tokenTail}`,
      userId: result.user.id,
      issuedAt: new Date().toISOString(),
      expiresAt: result.expiresAt,
      storageBacking: 'Android Keystore / Hardware Encrypted Storage',
    };

    await this._tokenStore.saveSession(result.bearerToken, session);
    return { actor: result.user, session };
  }

  private _deviceName(): string {
    return `Tracely (${Platform.OS})`;
  }
}
