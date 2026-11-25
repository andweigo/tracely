import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  AvailabilityStatus,
  ConfidentialityTier,
  DocumentCopyFormat,
  DocumentLifecycleStatus,
  OfflineQueueStatus,
  ReceiptStatus,
  SlaState,
} from '../../domain/enums/DomainEnums';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';

interface BadgeSpec {
  readonly label: string;
  readonly bg: string;
  readonly text: string;
  readonly dot?: string;
}

const CONFIDENTIALITY_MAP: Record<ConfidentialityTier, BadgeSpec> = {
  standard_internal: {
    label: 'Standard',
    bg: SDO_COLORS.surfaceSoft,
    text: SDO_COLORS.textSecondary,
  },
  restricted: {
    label: 'Restricted',
    bg: SDO_COLORS.amberSoft,
    text: SDO_COLORS.amberText,
  },
  confidential: {
    label: 'Confidential',
    bg: SDO_COLORS.roseSoft,
    text: SDO_COLORS.roseText,
  },
};

const AVAILABILITY_MAP: Record<AvailabilityStatus, BadgeSpec> = {
  available: {
    label: 'Available',
    bg: SDO_COLORS.emeraldSoft,
    text: SDO_COLORS.emeraldText,
    dot: SDO_COLORS.tealDot,
  },
  official_business: {
    label: 'Official Business',
    bg: SDO_COLORS.skySoft,
    text: SDO_COLORS.skyText,
    dot: SDO_COLORS.skyText,
  },
  on_leave: {
    label: 'On Leave',
    bg: SDO_COLORS.amberSoft,
    text: SDO_COLORS.amberText,
    dot: SDO_COLORS.amber,
  },
};

const SLA_MAP: Record<SlaState, BadgeSpec> = {
  on_track: {
    label: 'On track',
    bg: SDO_COLORS.emeraldSoft,
    text: SDO_COLORS.emeraldText,
  },
  at_risk: {
    label: 'Due soon',
    bg: SDO_COLORS.amberSoft,
    text: SDO_COLORS.amberText,
  },
  overdue: {
    label: 'Overdue',
    bg: SDO_COLORS.roseSoft,
    text: SDO_COLORS.roseText,
  },
};

const RECEIPT_MAP: Record<ReceiptStatus, BadgeSpec> = {
  pending: {
    label: 'Awaiting receipt',
    bg: SDO_COLORS.skySoft,
    text: SDO_COLORS.skyText,
  },
  acknowledged: {
    label: 'Received',
    bg: SDO_COLORS.emeraldSoft,
    text: SDO_COLORS.emeraldText,
  },
  recalled: {
    label: 'Recalled',
    bg: SDO_COLORS.surfaceSoft,
    text: SDO_COLORS.textSecondary,
  },
  declined_misrouted: {
    label: 'Misrouted',
    bg: SDO_COLORS.roseSoft,
    text: SDO_COLORS.roseText,
  },
  returned_for_revision: {
    label: 'Returned',
    bg: SDO_COLORS.amberSoft,
    text: SDO_COLORS.amberText,
  },
};

const LIFECYCLE_MAP: Record<DocumentLifecycleStatus, BadgeSpec> = {
  registered: {
    label: 'Registered',
    bg: SDO_COLORS.surfaceSoft,
    text: SDO_COLORS.textSecondary,
  },
  in_transit: {
    label: 'In transit',
    bg: SDO_COLORS.skySoft,
    text: SDO_COLORS.skyText,
  },
  in_review: {
    label: 'In progress',
    bg: SDO_COLORS.indigoSoft,
    text: SDO_COLORS.indigoText,
  },
  returned_for_revision: {
    label: 'Returned',
    bg: SDO_COLORS.amberSoft,
    text: SDO_COLORS.amberText,
  },
  approved: {
    label: 'Approved',
    bg: SDO_COLORS.emeraldSoft,
    text: SDO_COLORS.emeraldText,
  },
  archived: {
    label: 'Archived',
    bg: SDO_COLORS.surfaceSoft,
    text: SDO_COLORS.textMuted,
  },
};

const OFFLINE_MAP: Record<OfflineQueueStatus, BadgeSpec> = {
  queued: {
    label: 'Queued',
    bg: SDO_COLORS.amberSoft,
    text: SDO_COLORS.amberText,
  },
  uploading: {
    label: 'Syncing...',
    bg: SDO_COLORS.skySoft,
    text: SDO_COLORS.skyText,
  },
  synced: {
    label: 'Synced',
    bg: SDO_COLORS.emeraldSoft,
    text: SDO_COLORS.emeraldText,
  },
  failed: {
    label: 'Retry needed',
    bg: SDO_COLORS.roseSoft,
    text: SDO_COLORS.roseText,
  },
};

const COPY_FORMAT_LABELS: Record<DocumentCopyFormat, string> = {
  digital: 'Soft Copy',
  hard_copy: 'Hard Copy',
  hybrid: 'Hard + Soft',
};

const StatusPill: React.FC<{ spec: BadgeSpec; suffix?: string }> = ({ spec, suffix }) => (
  <View style={[styles.pill, { backgroundColor: spec.bg }]}>
    {spec.dot ? <View style={[styles.dot, { backgroundColor: spec.dot }]} /> : null}
    <Text style={[styles.text, { color: spec.text }]}>
      {suffix ? `${spec.label} · ${suffix}` : spec.label}
    </Text>
  </View>
);

export const ConfidentialityBadge: React.FC<{ tier: ConfidentialityTier }> = ({ tier }) => {
  if (tier === ConfidentialityTier.STANDARD_INTERNAL) {
    return null;
  }
  return <StatusPill spec={CONFIDENTIALITY_MAP[tier]} />;
};

export const AvailabilityBadge: React.FC<{ status: AvailabilityStatus }> = ({ status }) => (
  <StatusPill spec={AVAILABILITY_MAP[status]} />
);

export const SlaBadge: React.FC<{ state: SlaState; suffix?: string }> = ({ state, suffix }) => {
  if (state === SlaState.ON_TRACK) {
    if (!suffix) return null;
    return <Text style={styles.subtleMeta}>{suffix}</Text>;
  }
  return <StatusPill spec={SLA_MAP[state]} suffix={suffix} />;
};

export const ReceiptStatusBadge: React.FC<{ status: ReceiptStatus }> = ({ status }) => (
  <StatusPill spec={RECEIPT_MAP[status]} />
);

export const LifecycleBadge: React.FC<{ status: DocumentLifecycleStatus }> = ({ status }) => (
  <StatusPill spec={LIFECYCLE_MAP[status]} />
);

export const OfflineStatusBadge: React.FC<{ status: OfflineQueueStatus }> = ({ status }) => (
  <StatusPill spec={OFFLINE_MAP[status]} />
);

export const CopyFormatBadge: React.FC<{ format: DocumentCopyFormat }> = ({ format }) => (
  <Text style={styles.subtleMeta}>{COPY_FORMAT_LABELS[format]}</Text>
);

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
  },
  subtleMeta: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '600',
    color: SDO_COLORS.textSecondary,
  },
});
