import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ShieldAlert } from 'lucide-react-native';
import { useAppServices } from '../../state/AppServiceContext';
import { ModalSheet } from '../components/ModalSheet';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';
import { formatShortTimestamp } from '../utils/formatters';

interface AuditInspectorSheetProps {
  open: boolean;
  onClose: () => void;
}

export const AuditInspectorSheet: React.FC<AuditInspectorSheetProps> = ({ open, onClose }) => {
  const { auditLogs, loadAuditLogs, isBusy } = useAppServices();

  useEffect(() => {
    if (open) {
      loadAuditLogs().catch(() => {});
    }
  }, [open, loadAuditLogs]);

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title="Append-Only Audit Trail"
      subtitle="Immutable custody & security accountability log"
    >
      {isBusy && auditLogs.length === 0 ? (
        <ActivityIndicator color={SDO_COLORS.navy} />
      ) : auditLogs.length === 0 ? (
        <Text style={styles.emptyText}>No audit log entries retrieved yet.</Text>
      ) : (
        auditLogs.map((entry) => (
          <View key={entry.id} style={styles.card}>
            <View style={styles.topRow}>
              <View style={styles.actionPill}>
                <Text style={styles.actionText}>{entry.action.toUpperCase()}</Text>
              </View>
              <Text style={styles.time}>{formatShortTimestamp(entry.createdAt)}</Text>
            </View>
            <Text style={styles.summary}>{entry.summary}</Text>
            <Text style={styles.meta}>
              {entry.actorName} ({entry.actorOfficeCode})
              {entry.trackingCode ? ` · ${entry.trackingCode}` : ''} · {entry.deviceLabel}
            </Text>
          </View>
        ))
      )}
      <View style={styles.footerNotice}>
        <ShieldAlert size={15} color={SDO_COLORS.textMuted} />
        <Text style={styles.footerText}>
          Audit repository is append-only; mobile clients have read access only.
        </Text>
      </View>
    </ModalSheet>
  );
};

const styles = StyleSheet.create({
  emptyText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    color: SDO_COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
  },
  card: {
    borderRadius: 16,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 13,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionPill: {
    borderRadius: 6,
    backgroundColor: SDO_COLORS.navy,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  actionText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: SDO_FONTS.mono,
    color: '#FFFFFF',
  },
  time: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    color: SDO_COLORS.textMuted,
  },
  summary: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  meta: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    color: SDO_COLORS.textSecondary,
  },
  footerNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 12,
  },
  footerText: {
    fontFamily: SDO_FONTS.sans,
    flex: 1,
    fontSize: 11,
    color: SDO_COLORS.textSecondary,
  },
});
