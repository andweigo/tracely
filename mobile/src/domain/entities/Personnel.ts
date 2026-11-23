import { BaseEntity } from '../base/BaseEntity';
import { DomainRuleError } from '../base/DomainRuleError';
import { AvailabilityStatus, RoutingScope, SystemRole } from '../enums/DomainEnums';

export type LandingTabPreference = 'inbox' | 'scanner' | 'sent' | 'track';

export interface UserWorkflowPreferences {
  readonly defaultCopyFormat: 'digital' | 'hard_copy';
  readonly defaultRoutingScope: RoutingScope;
  readonly defaultRemarks: string;
  readonly defaultLandingScreen: LandingTabPreference;
  readonly compactDensity: boolean;
  readonly desktopNotifications: boolean;
  readonly notificationSound: boolean;
  readonly hideLockScreenTitles: boolean;
}

export const DEFAULT_USER_WORKFLOW_PREFERENCES: UserWorkflowPreferences = Object.freeze({
  defaultCopyFormat: 'digital',
  defaultRoutingScope: RoutingScope.INTER_OFFICE,
  defaultRemarks: '',
  defaultLandingScreen: 'inbox',
  compactDensity: false,
  desktopNotifications: true,
  notificationSound: true,
  hideLockScreenTitles: true,
});

export const AVATAR_COLOR_SWATCHES: ReadonlyArray<{ hex: string; label: string }> = [
  { hex: '#5736E4', label: 'Royal Violet' },
  { hex: '#0D3472', label: 'Tracely Navy' },
  { hex: '#0F766E', label: 'Teal' },
  { hex: '#047857', label: 'Emerald' },
  { hex: '#4338CA', label: 'Indigo' },
  { hex: '#B45309', label: 'Amber' },
  { hex: '#BE123C', label: 'Crimson' },
];

export interface ProfileUpdatePayload {
  readonly fullName?: string;
  readonly email?: string;
  readonly position?: string;
  readonly contactNumber?: string | null;
  readonly deskNote?: string | null;
  readonly avatarColor?: string;
}

export interface OfficeSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface PeerDirectorySummary {
  readonly id: string;
  readonly fullName: string;
  readonly initials: string;
  readonly position: string;
  readonly office: OfficeSummary;
  readonly availability: AvailabilityStatus;
  readonly canReceiveDirectRouting: boolean;
}

export interface PersonnelProps {
  id: string;
  employeeId: string;
  fullName: string;
  position: string;
  contactNumber?: string | null;
  deskNote?: string | null;
  avatarColor?: string;
  preferences?: Partial<UserWorkflowPreferences>;
  office: OfficeSummary;
  role: SystemRole;
  email: string;
  availability: AvailabilityStatus;
  availabilityUntil?: string | null;
  delegateId?: string | null;
  active?: boolean;
  createdAt?: string;
}

const ROLE_DISPLAY_LABEL: Record<SystemRole, string> = {
  records_officer: 'Records Officer',
  unit_head: 'Unit Head',
  staff: 'Office Personnel',
  legal_officer: 'Legal Officer',
  ict_admin: 'ICT Administrator',
};

/**
 * Verified user profile with encapsulated availability, leave return window,
 * and delegate invariants. Identity fields are HR-locked read-only from mobile clients.
 */
export class Personnel extends BaseEntity {
  private readonly _employeeId: string;
  private _fullName: string;
  private _position: string;
  private _contactNumber: string | null;
  private _deskNote: string | null;
  private _avatarColor: string;
  private _preferences: UserWorkflowPreferences;
  private readonly _office: OfficeSummary;
  private readonly _role: SystemRole;
  private _email: string;
  private _availability: AvailabilityStatus;
  private _availabilityUntil: string | null;
  private _delegateId: string | null;
  private _active: boolean;

  constructor(props: PersonnelProps) {
    super(props.id, props.createdAt);
    this._employeeId = BaseEntity.requireNonEmpty(props.employeeId, 'employeeId');
    this._fullName = BaseEntity.requireNonEmpty(props.fullName, 'fullName');
    this._position = BaseEntity.requireNonEmpty(props.position, 'position');
    this._contactNumber = props.contactNumber ?? null;
    this._deskNote = props.deskNote ?? null;
    this._avatarColor = props.avatarColor || '#0D3472';
    this._preferences = Object.freeze({
      ...DEFAULT_USER_WORKFLOW_PREFERENCES,
      ...(props.preferences ?? {}),
    });
    this._office = Object.freeze({ ...props.office });
    this._role = props.role;
    this._email = BaseEntity.requireNonEmpty(props.email, 'email');
    this._availability = props.availability;
    this._availabilityUntil = props.availabilityUntil ?? null;
    this._delegateId = props.delegateId ?? null;
    this._active = props.active ?? true;
  }

  public get employeeId(): string {
    return this._employeeId;
  }
  public get fullName(): string {
    return this._fullName;
  }
  public get position(): string {
    return this._position;
  }
  public get contactNumber(): string | null {
    return this._contactNumber;
  }
  public get deskNote(): string | null {
    return this._deskNote;
  }
  public get avatarColor(): string {
    return this._avatarColor;
  }
  public get preferences(): UserWorkflowPreferences {
    return this._preferences;
  }
  public get office(): OfficeSummary {
    return this._office;
  }
  public get role(): SystemRole {
    return this._role;
  }
  public get roleLabel(): string {
    return ROLE_DISPLAY_LABEL[this._role];
  }
  public get email(): string {
    return this._email;
  }
  public get availability(): AvailabilityStatus {
    return this._availability;
  }
  public get availabilityUntil(): string | null {
    return this._availabilityUntil;
  }
  public get delegateId(): string | null {
    return this._delegateId;
  }
  public get isActive(): boolean {
    return this._active;
  }

  public updateProfileInfo(patch: ProfileUpdatePayload): Personnel {
    if (patch.fullName !== undefined && patch.fullName.trim()) {
      this._fullName = patch.fullName.trim();
    }
    if (patch.position !== undefined && patch.position.trim()) {
      this._position = patch.position.trim();
    }
    if (patch.contactNumber !== undefined) {
      const c = patch.contactNumber?.trim() ?? '';
      this._contactNumber = c || null;
    }
    if (patch.deskNote !== undefined) {
      const d = patch.deskNote?.trim() ?? '';
      this._deskNote = d || null;
    }
    if (patch.avatarColor) {
      this._avatarColor = patch.avatarColor;
    }
    return this;
  }

  public updatePreferences(patch: Partial<UserWorkflowPreferences>): UserWorkflowPreferences {
    this._preferences = Object.freeze({
      ...this._preferences,
      ...patch,
    });
    return this._preferences;
  }

  public get initials(): string {
    return this._fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  public canReceiveDirectRouting(): boolean {
    return this._active && this._availability !== AvailabilityStatus.ON_LEAVE;
  }

  public setAvailability(
    status: AvailabilityStatus,
    delegateId?: string | null,
    availabilityUntil?: string | null,
  ): void {
    if (delegateId && delegateId === this.id) {
      throw new DomainRuleError(
        'INVALID_DELEGATE',
        'A personnel member cannot assign themselves as their own delegate.',
      );
    }
    this._availability = status;
    this._delegateId = status === AvailabilityStatus.ON_LEAVE ? (delegateId ?? null) : null;
    this._availabilityUntil =
      status === AvailabilityStatus.AVAILABLE ? null : (availabilityUntil ?? null);
  }

  /**
   * Projects strictly minimal directory info for coworker pickers (no employeeId or email PII).
   */
  public toPeerDirectorySummary(): PeerDirectorySummary {
    return Object.freeze({
      id: this.id,
      fullName: this._fullName,
      initials: this.initials,
      position: this._position,
      office: this._office,
      availability: this._availability,
      canReceiveDirectRouting: this.canReceiveDirectRouting(),
    });
  }

  public deactivate(): void {
    this._active = false;
  }
}
