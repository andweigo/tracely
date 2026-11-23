import {
  OfficeSummary,
  Personnel,
  ProfileUpdatePayload,
  UserWorkflowPreferences,
} from '../../domain/entities/Personnel';
import type { ActiveDeviceSession } from '../../domain/entities/UserSecurityProfile';
import { AvailabilityStatus } from '../../domain/enums/DomainEnums';
import {
  ActiveSessionDto,
  DocumentMapper,
  PersonnelDto,
  PersonnelPreferencesDto,
} from '../../domain/mappers/DocumentMapper';
import { ApiClient } from '../../network/ApiClient';
import type {
  AdminCreateUserPayload,
  AdminUpdateUserPayload,
  IAuthRepository,
  LoginResult,
  RegisterAccountPayload,
  RegistrationResult,
} from '../contracts/IAuthRepository';

interface LoginResponseDto {
  token: string;
  expires_at: string;
  user: PersonnelDto;
}

interface RegisterResponseDto {
  pending_approval?: boolean;
  message?: string;
  token?: string;
  expires_at?: string;
  user?: PersonnelDto;
}

export class HttpAuthRepository implements IAuthRepository {
  private readonly _api: ApiClient;

  constructor(api: ApiClient) {
    this._api = api;
  }

  public async login(
    identifier: string,
    password: string,
    deviceName: string,
  ): Promise<LoginResult> {
    const res = await this._api.post<LoginResponseDto>('/auth/login', {
      identifier,
      password,
      device_name: deviceName,
    });
    return this._toLoginResult(res);
  }

  public async register(payload: RegisterAccountPayload): Promise<RegistrationResult> {
    const res = await this._api.post<RegisterResponseDto>('/auth/register', {
      full_name: payload.fullName,
      employee_id: payload.employeeId,
      email: payload.email,
      position: payload.position,
      office_code: payload.officeCode,
      ...(payload.customOfficeName ? { custom_office_name: payload.customOfficeName } : {}),
      password: payload.password,
      device_name: payload.deviceName,
    });
    const session =
      res.token && res.user
        ? this._toLoginResult({
            token: res.token,
            expires_at: res.expires_at ?? '',
            user: res.user,
          })
        : null;
    const pendingApproval = Boolean(res.pending_approval ?? !session);
    return {
      pendingApproval,
      message:
        res.message ??
        (pendingApproval
          ? 'Registration submitted for administrator verification.'
          : 'Account created and signed in.'),
      session,
    };
  }

  private _toLoginResult(res: LoginResponseDto): LoginResult {
    return {
      bearerToken: res.token,
      expiresAt: res.expires_at,
      user: DocumentMapper.toPersonnel(res.user),
    };
  }

  public async fetchCurrentProfile(): Promise<Personnel> {
    const dto = await this._api.get<{ data: PersonnelDto }>('/auth/me');
    return DocumentMapper.toPersonnel(dto.data);
  }

  public async updateAvailability(
    status: AvailabilityStatus,
    delegateId?: string | null,
    availabilityUntil?: string | null,
  ): Promise<Personnel> {
    const dto = await this._api.patch<{ data: PersonnelDto }>('/personnel/availability', {
      availability: status,
      delegate_id: delegateId ?? null,
      availability_until: availabilityUntil ?? null,
    });
    return DocumentMapper.toPersonnel(dto.data);
  }

  public async updateProfile(patch: ProfileUpdatePayload): Promise<Personnel> {
    const dto = await this._api.patch<{ data: PersonnelDto }>('/auth/profile', {
      ...(patch.fullName !== undefined ? { full_name: patch.fullName } : {}),
      ...(patch.email !== undefined ? { email: patch.email } : {}),
      ...(patch.position !== undefined ? { position: patch.position } : {}),
      ...(patch.contactNumber !== undefined ? { contact_number: patch.contactNumber } : {}),
      ...(patch.deskNote !== undefined ? { desk_note: patch.deskNote } : {}),
      ...(patch.avatarColor !== undefined ? { avatar_color: patch.avatarColor } : {}),
    });
    return DocumentMapper.toPersonnel(dto.data);
  }

  public async updatePreferences(
    patch: Partial<UserWorkflowPreferences>,
  ): Promise<{ user: Personnel; preferences: UserWorkflowPreferences }> {
    const dto = await this._api.patch<{
      data: PersonnelDto;
      preferences?: PersonnelPreferencesDto;
    }>('/auth/preferences', {
      ...(patch.defaultCopyFormat !== undefined
        ? { default_copy_format: patch.defaultCopyFormat }
        : {}),
      ...(patch.defaultRoutingScope !== undefined
        ? { default_routing_scope: patch.defaultRoutingScope }
        : {}),
      ...(patch.defaultRemarks !== undefined ? { default_remarks: patch.defaultRemarks } : {}),
      ...(patch.defaultLandingScreen !== undefined
        ? { default_landing_screen: patch.defaultLandingScreen }
        : {}),
      ...(patch.compactDensity !== undefined ? { compact_density: patch.compactDensity } : {}),
      ...(patch.desktopNotifications !== undefined
        ? { desktop_notifications: patch.desktopNotifications }
        : {}),
      ...(patch.notificationSound !== undefined
        ? { notification_sound: patch.notificationSound }
        : {}),
      ...(patch.hideLockScreenTitles !== undefined
        ? { hide_lock_screen_titles: patch.hideLockScreenTitles }
        : {}),
    });
    const user = DocumentMapper.toPersonnel(dto.data);
    return {
      user,
      preferences: user.preferences,
    };
  }

  public async listActiveSessions(): Promise<ReadonlyArray<ActiveDeviceSession>> {
    const res = await this._api.get<{ data: ActiveSessionDto[] }>('/auth/sessions');
    return res.data.map(DocumentMapper.toActiveSession);
  }

  public async revokeOtherSessions(): Promise<number> {
    const res = await this._api.post<{ revoked_count: number }>('/auth/sessions/revoke-others', {});
    return res.revoked_count;
  }

  public async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this._api.post<void>('/auth/password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
  }

  public async listPendingUsers(): Promise<ReadonlyArray<Personnel>> {
    const res = await this._api.get<{ data: PersonnelDto[] }>('/admin/pending-users');
    return res.data.map(DocumentMapper.toPersonnel);
  }

  public async approveUser(userId: string): Promise<Personnel> {
    const res = await this._api.post<{ data: PersonnelDto }>(
      `/admin/users/${encodeURIComponent(userId)}/approve`,
      {},
    );
    return DocumentMapper.toPersonnel(res.data);
  }

  public async rejectUser(userId: string, reason?: string): Promise<void> {
    await this._api.post<void>(`/admin/users/${encodeURIComponent(userId)}/reject`, {
      reason: reason?.trim() || undefined,
    });
  }

  public async listAdminUsers(): Promise<ReadonlyArray<Personnel>> {
    const res = await this._api.get<{ data: PersonnelDto[] }>('/admin/users');
    return res.data.map(DocumentMapper.toPersonnel);
  }

  public async createAdminUser(payload: AdminCreateUserPayload): Promise<Personnel> {
    const res = await this._api.post<{ data: PersonnelDto }>('/admin/users', {
      full_name: payload.fullName,
      employee_id: payload.employeeId,
      email: payload.email,
      position: payload.position,
      office_id: payload.officeId,
      role: payload.role,
      password: payload.password,
    });
    return DocumentMapper.toPersonnel(res.data);
  }

  public async updateAdminUser(
    userId: string,
    patch: AdminUpdateUserPayload,
  ): Promise<Personnel> {
    const res = await this._api.patch<{ data: PersonnelDto }>(
      `/admin/users/${encodeURIComponent(userId)}`,
      {
        ...(patch.fullName !== undefined ? { full_name: patch.fullName } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
        ...(patch.role !== undefined ? { role: patch.role } : {}),
        ...(patch.officeId !== undefined ? { office_id: patch.officeId } : {}),
        ...(patch.position !== undefined ? { position: patch.position } : {}),
        ...(patch.availability !== undefined ? { availability: patch.availability } : {}),
        ...(patch.active !== undefined ? { active: patch.active } : {}),
        ...(patch.newPassword !== undefined ? { new_password: patch.newPassword } : {}),
      },
    );
    return DocumentMapper.toPersonnel(res.data);
  }

  public async createAdminOffice(payload: { code: string; name: string }): Promise<OfficeSummary> {
    const res = await this._api.post<{ data: OfficeSummary }>('/admin/offices', payload);
    return res.data;
  }

  public async updateAdminOffice(
    officeId: string,
    patch: { code?: string; name?: string },
  ): Promise<OfficeSummary> {
    const res = await this._api.patch<{ data: OfficeSummary }>(
      `/admin/offices/${encodeURIComponent(officeId)}`,
      patch,
    );
    return res.data;
  }

  public async requestPasswordReset(
    identifier: string,
  ): Promise<{ message: string; devResetCode?: string }> {
    const res = await this._api.post<{ message: string; dev_reset_code?: string }>(
      '/auth/forgot-password',
      { identifier: identifier.trim() },
    );
    return {
      message: res.message,
      devResetCode: res.dev_reset_code,
    };
  }

  public async confirmPasswordReset(
    identifier: string,
    resetCode: string,
    newPassword: string,
  ): Promise<string> {
    const res = await this._api.post<{ message: string }>('/auth/reset-password', {
      identifier: identifier.trim(),
      reset_code: resetCode.trim(),
      new_password: newPassword,
    });
    return res.message;
  }

  public async logout(): Promise<void> {
    await this._api.post<void>('/auth/logout');
  }
}
