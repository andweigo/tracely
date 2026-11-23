import { Document } from './Document';
import { DocumentLifecycleStatus, SlaState } from '../enums/DomainEnums';
import type { Personnel } from './Personnel';
import type { DocumentTrackingSnapshot } from '../security/AccessPolicy';

export interface ActiveDeviceSession {
  readonly id: string;
  readonly deviceName: string;
  readonly platform: 'android' | 'ios' | 'web';
  readonly lastActiveAt: string;
  readonly isCurrentDevice: boolean;
  readonly ipHint: string;
}

export interface UserSecurityPreferences {
  readonly biometricGateEnabled: boolean;
  readonly hideLockScreenTitles: boolean;
  readonly screenshotShieldEnabled: boolean;
}

export const DEFAULT_SECURITY_PREFERENCES: UserSecurityPreferences = Object.freeze({
  biometricGateEnabled: false,
  hideLockScreenTitles: true,
  screenshotShieldEnabled: true,
});

export interface WorkloadSummary {
  readonly pendingReceiptCount: number;
  readonly inProgressCount: number;
  readonly returnedCount: number;
  readonly sentTrackedCount: number;
  readonly onTimeSlaPercent: number;
}

/**
 * Pure domain projection deriving real workload & SLA metrics from live document queues.
 */
export function computeWorkloadSummary(
  actor: Personnel | null,
  documents: ReadonlyArray<Document>,
  trackedSnapshots: ReadonlyArray<DocumentTrackingSnapshot>,
): WorkloadSummary {
  if (!actor) {
    return Object.freeze({
      pendingReceiptCount: 0,
      inProgressCount: 0,
      returnedCount: 0,
      sentTrackedCount: trackedSnapshots.length,
      onTimeSlaPercent: 100,
    });
  }

  const pendingReceiptCount = documents.filter((d) =>
    d.latestTransaction?.canBeAcknowledgedBy(actor),
  ).length;

  const inProgressCount = documents.filter(
    (d) =>
      d.currentOffice.id === actor.office.id &&
      !d.latestTransaction?.canBeAcknowledgedBy(actor) &&
      !d.latestTransaction?.isPendingSentBy(actor.id) &&
      d.lifecycleStatus === DocumentLifecycleStatus.IN_REVIEW,
  ).length;

  const returnedCount = documents.filter(
    (d) => d.lifecycleStatus === DocumentLifecycleStatus.RETURNED_FOR_REVISION,
  ).length;

  const sentTrackedCount = trackedSnapshots.filter((s) => s.sentByActorOffice).length;

  const onTimeCount = documents.filter((d) => d.slaState !== SlaState.OVERDUE).length;
  const onTimeSlaPercent =
    documents.length === 0 ? 100 : Math.round((onTimeCount / documents.length) * 100);

  return Object.freeze({
    pendingReceiptCount,
    inProgressCount,
    returnedCount,
    sentTrackedCount,
    onTimeSlaPercent,
  });
}
