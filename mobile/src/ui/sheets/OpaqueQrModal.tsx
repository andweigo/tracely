import React from 'react';
import { Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Printer, Share2, X } from 'lucide-react-native';
import type { Document } from '../../domain/entities/Document';
import { ConfidentialityTier, DocumentCopyFormat } from '../../domain/enums/DomainEnums';
import { DocumentViewerBridge } from '../../domain/security/DocumentViewerBridge';
import { QrCodeGraphic } from '../components/QrCodeGraphic';
import { SDO_COLORS } from '../theme/tokens';
import { formatCompactDate } from '../utils/formatters';

interface OpaqueQrModalProps {
  open: boolean;
  qrToken: string;
  trackingCode?: string;
  isHardCopy?: boolean;
  document?: Document | null;
  onClose: () => void;
}

const FORMAT_LABELS: Record<DocumentCopyFormat, string> = {
  [DocumentCopyFormat.DIGITAL]: 'Soft Copy',
  [DocumentCopyFormat.HARD_COPY]: 'Hard Copy',
  [DocumentCopyFormat.HYBRID]: 'Hybrid (Hard + Scan)',
};

const TIER_LABELS: Record<ConfidentialityTier, string> = {
  [ConfidentialityTier.STANDARD_INTERNAL]: 'Standard Internal',
  [ConfidentialityTier.RESTRICTED]: 'Restricted',
  [ConfidentialityTier.CONFIDENTIAL]: 'Confidential (Restricted)',
};

/**
 * Centered modal displaying a clean Tracely Routing Slip with
 * opaque QR token (zero PII embedded) and native single-slip printing.
 */
export const OpaqueQrModal: React.FC<OpaqueQrModalProps> = ({
  open,
  qrToken,
  trackingCode,
  isHardCopy = false,
  document: doc,
  onClose,
}) => {
  const fullPayload = `TRC-QR:DOC:${qrToken}`;
  const effectiveCode = trackingCode ?? doc?.trackingCode ?? 'TRC-DOC';
  const isConfidential = doc?.confidentialityTier === ConfidentialityTier.CONFIDENTIAL;
  const displayTitle = doc
    ? isConfidential
      ? 'Confidential Record — Scan QR to Verify'
      : doc.title
    : isHardCopy
      ? 'Hard Copy Folder Slip'
      : 'Tracked Document';

  const formatLabel = doc
    ? FORMAT_LABELS[doc.copyFormat]
    : isHardCopy
      ? 'Hard Copy'
      : 'Tracked Record';
  const tierLabel = doc ? TIER_LABELS[doc.confidentialityTier] : 'Standard Internal';
  const issuedDate = formatCompactDate(doc?.createdAt ?? new Date().toISOString());
  const physicalFolderLabel = doc
    ? [
        doc.physicalReference,
        doc.physicalPageCount ? `${doc.physicalPageCount} pages` : null,
      ]
        .filter(Boolean)
        .join(' · ') || undefined
    : undefined;

  const handleShareSlip = async () => {
    const lines = [
      'Tracely — Official Document Routing Slip',
      `Tracking Code: ${effectiveCode}`,
      `Document: ${displayTitle}`,
      doc?.categoryName ? `Category: ${doc.categoryName}` : null,
      doc?.originOffice ? `Origin: ${doc.originOffice.code} — ${doc.originOffice.name}` : null,
      doc?.currentOffice ? `Current Desk: ${doc.currentOffice.code} — ${doc.currentOffice.name}` : null,
      `Format: ${formatLabel} · ${tierLabel}`,
      `Opaque QR Payload: ${fullPayload}`,
      'Zero PII encoded in QR. Scan inside Tracely to verify desk custody.',
    ].filter(Boolean);
    try {
      await Share.share({
        title: `Routing Slip ${effectiveCode}`,
        message: lines.join('\n'),
      });
    } catch {
      // Share cancelled or unavailable
    }
  };

  const handlePrintSlip = async () => {
    try {
      const printed = await DocumentViewerBridge.printRoutingSlip({
        qrPayload: fullPayload,
        trackingCode: effectiveCode,
        title: doc?.title,
        categoryName: doc?.categoryName,
        copyFormatLabel: formatLabel,
        classificationLabel: tierLabel,
        originOfficeLabel: doc?.originOffice
          ? `${doc.originOffice.code} — ${doc.originOffice.name}`
          : undefined,
        currentOfficeLabel: doc?.currentOffice
          ? `${doc.currentOffice.code} — ${doc.currentOffice.name}`
          : undefined,
        issuedDateLabel: issuedDate,
        physicalFolderLabel,
        isConfidential,
      });
      if (!printed) {
        await handleShareSlip();
      }
    } catch {
      await handleShareSlip();
    }
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{isHardCopy ? 'Routing Slip QR' : 'Document QR Slip'}</Text>
              <Text style={styles.subtitle}>Opaque token · Zero PII embedded</Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityLabel="Close QR modal"
              style={styles.closeBtn}
            >
              <X size={18} color={SDO_COLORS.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.slipCard} testID="mobile-routing-print-slip">
              <View style={styles.slipMasthead}>
                <Text style={styles.slipRepublic}>TRACELY · DOCUMENT TRACKING</Text>
                <View style={styles.slipBannerRow}>
                  <Text style={styles.slipTag}>OFFICIAL ROUTING SLIP</Text>
                  <Text style={styles.slipDate}>{issuedDate}</Text>
                </View>
              </View>

              <View style={styles.slipBody}>
                <View style={styles.qrFrame}>
                  <QrCodeGraphic value={fullPayload} size={142} />
                </View>
                <Text style={styles.codeLabel}>TRACKING CODE</Text>
                <Text selectable style={styles.codeValue}>
                  {effectiveCode}
                </Text>
                <Text numberOfLines={2} style={styles.slipTitle}>
                  {displayTitle}
                </Text>

                <View style={styles.metaGrid}>
                  {doc?.categoryName ? (
                    <View style={styles.metaCell}>
                      <Text style={styles.metaLabel}>CATEGORY</Text>
                      <Text numberOfLines={1} style={styles.metaValue}>
                        {doc.categoryName}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.metaCell}>
                    <Text style={styles.metaLabel}>FORMAT</Text>
                    <Text numberOfLines={1} style={styles.metaValue}>
                      {formatLabel}
                    </Text>
                  </View>
                  {doc?.originOffice ? (
                    <View style={styles.metaCell}>
                      <Text style={styles.metaLabel}>ORIGIN</Text>
                      <Text numberOfLines={1} style={styles.metaValue}>
                        {doc.originOffice.code}
                      </Text>
                    </View>
                  ) : null}
                  {doc?.currentOffice ? (
                    <View style={styles.metaCell}>
                      <Text style={styles.metaLabel}>CURRENT DESK</Text>
                      <Text numberOfLines={1} style={styles.metaValue}>
                        {doc.currentOffice.code}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.receiptBox}>
                  <Text style={styles.receiptHeading}>
                    RECEIVING OFFICE ACKNOWLEDGMENT &amp; REMARKS
                  </Text>
                  <View style={styles.receiptFieldRow}>
                    <Text style={styles.metaLabel}>Received By / Date:</Text>
                    <View style={styles.signatureLine} />
                  </View>
                  <View style={styles.receiptFieldRow}>
                    <Text style={styles.metaLabel}>Remarks / Action:</Text>
                    <View style={styles.signatureLine} />
                  </View>
                </View>
              </View>

              <View style={styles.slipFooter}>
                <Text style={styles.slipFooterText}>
                  Recipient sees a sealed QR card only and must scan this QR or enter {effectiveCode} from this slip to unlock · Zero PII in QR
                </Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.actionsRow}>
            <Pressable
              onPress={handlePrintSlip}
              accessibilityLabel="Print routing slip"
              style={styles.secondaryBtn}
            >
              <Printer size={15} color={SDO_COLORS.navy} />
              <Text numberOfLines={1} style={styles.secondaryText}>
                Print Slip
              </Text>
            </Pressable>
            <Pressable
              onPress={handleShareSlip}
              accessibilityLabel="Share routing slip"
              style={styles.secondaryBtn}
            >
              <Share2 size={15} color={SDO_COLORS.navy} />
              <Text numberOfLines={1} style={styles.secondaryText}>
                Share Slip
              </Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.doneBtn}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.54)',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '90%',
    borderRadius: 24,
    backgroundColor: SDO_COLORS.surface,
    padding: 16,
    gap: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  scrollContent: {
    paddingBottom: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: SDO_COLORS.tealDot,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: SDO_COLORS.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slipCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: SDO_COLORS.navyInk,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  slipMasthead: {
    backgroundColor: SDO_COLORS.navyInk,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 4,
  },
  slipRepublic: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.9,
    color: 'rgba(255,255,255,0.82)',
  },
  slipBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slipTag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: SDO_COLORS.amber,
  },
  slipDate: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  slipBody: {
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  qrFrame: {
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: '#FFFFFF',
  },
  codeLabel: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: SDO_COLORS.textMuted,
  },
  codeValue: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'monospace',
    color: SDO_COLORS.navyInk,
  },
  slipTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
    textAlign: 'center',
    marginTop: 2,
  },
  metaGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: SDO_COLORS.border,
  },
  metaCell: {
    width: '47%',
    gap: 1,
  },
  metaLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: SDO_COLORS.textMuted,
  },
  metaValue: {
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  receiptBox: {
    width: '100%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 10,
    gap: 6,
    marginTop: 4,
  },
  receiptFieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  signatureLine: {
    flex: 1,
    height: 1,
    backgroundColor: SDO_COLORS.border,
    marginBottom: 2,
  },
  receiptHeading: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: SDO_COLORS.navyInk,
  },
  slipFooter: {
    backgroundColor: SDO_COLORS.surfaceSoft,
    borderTopWidth: 1,
    borderTopColor: SDO_COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'center',
  },
  slipFooterText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: SDO_COLORS.textSecondary,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  secondaryBtn: {
    flex: 1,
    minWidth: 112,
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: SDO_COLORS.navy,
    backgroundColor: SDO_COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
  },
  secondaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  doneBtn: {
    minWidth: 82,
    flexGrow: 1,
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.amber,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  doneText: {
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
});
