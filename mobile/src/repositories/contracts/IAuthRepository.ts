import {
  OfficeSummary,
  Personnel,
  ProfileUpdatePayload,
  UserWorkflowPreferences,
} from '../../domain/entities/Personnel';
import type { ActiveDeviceSession } from '../../domain/entities/UserSecurityProfile';
import { AvailabilityStatus } from '../../domain/enums/DomainEnums';

export interface LoginResult {
  readonly bearerToken: string;
  readonly expiresAt: string;
  readonly user: Personnel;
}

export interface RegisterAccountPayload {
  readonly fullName: string;
  readonly employeeId: string;
  readonly email: string;
  readonly position: string;
  readonly officeCode: string;
  readonly customOfficeName?: string | null;
  readonly password: string;
  readonly deviceName: string;
}

export interface RegistrationResult {
  readonly pendingApproval: boolean;
  readonly message: string;
  readonly session: LoginResult | null;
}

export interface AdminCreateUserPayload {
  readonly fullName: string;
  readonly employeeId: string;
  readonly email: string;
  readonly position: string;
  readonly officeId: string;
  readonly role: string;
  readonly password: string;
}

export interface AdminUpdateUserPayload {
  readonly fullName?: string;
  readonly email?: string;
  readonly role?: string;
  readonly officeId?: string;
  readonly position?: string;
  readonly availability?: AvailabilityStatus;
  readonly active?: boolean;
  readonly newPassword?: string;
}

export interface IAuthRepository {
  login(identifier: string, password: string, deviceName: string): Promise<LoginResult>;
  register(payload: RegisterAccountPayload): Promise<RegistrationResult>;
  fetchCurrentProfile(): Promise<Personnel>;
  updateAvailability(
    status: AvailabilityStatus,
    delegateId?: string | null,
    availabilityUntil?: string | null,
  ): Promise<Personnel>;
  updateProfile?(patch: ProfileUpdatePayload): Promise<Personnel>;
  updatePreferences?(
    patch: Partial<UserWorkflowPreferences>,
  ): Promise<{ user: Personnel; preferences: UserWorkflowPreferences }>;
  listActiveSessions(): Promise<ReadonlyArray<ActiveDeviceSession>>;
  revokeOtherSessions(): Promise<number>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  requestPasswordReset?(identifier: string): Promise<{ message: string; devResetCode?: string }>;
  confirmPasswordReset?(
    identifier: string,
    resetCode: string,
    newPassword: string,
  ): Promise<string>;
  listPendingUsers?(): Promise<ReadonlyArray<Personnel>>;
  approveUser?(userId: string): Promise<Personnel>;
  rejectUser?(userId: string, reason?: string): Promise<void>;
  listAdminUsers?(): Promise<ReadonlyArray<Personnel>>;
  createAdminUser?(payload: AdminCreateUserPayload): Promise<Personnel>;
  updateAdminUser?(userId: string, patch: AdminUpdateUserPayload): Promise<Personnel>;
  createAdminOffice?(payload: { code: string; name: string }): Promise<OfficeSummary>;
  updateAdminOffice?(
    officeId: string,
    patch: { code?: string; name?: string },
  ): Promise<OfficeSummary>;
  logout(): Promise<void>;
}
