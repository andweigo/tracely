import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import { Document } from '../../domain/entities/Document';
import {
  AvailabilityStatus,
  DocumentLifecycleStatus,
  ReceiptStatus,
} from '../../domain/enums/DomainEnums';
import { DISPOSITION_REMARK_PRESETS } from '../../repositories/contracts/IDocumentRepository';
import { useAppServices } from '../../state/AppServiceContext';
import { AvailabilityBadge } from '../components/Badges';
import { ModalSheet } from '../components/ModalSheet';
import { SDO_COLORS } from '../theme/tokens';

interface ForwardSheetProps {
  open: boolean;
  document?: Document | null;
  documents?: ReadonlyArray<Document>;
  onForwarded?: () => void;
  onClose: () => void;
}

export const ForwardSheet: React.FC<ForwardSheetProps> = ({
  open,
  document,
  documents,
  onForwarded,
  onClose,
}) => {
  const { actor, personnelDirectory, offices, forwardDocument, batchForwardDocuments, isBusy } =
    useAppServices();
  const [scopeMode, setScopeMode] = useState<'inter_office' | 'internal_office'>('inter_office');
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>('');
  const [officeMenuOpen, setOfficeMenuOpen] = useState(false);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>('');
  const [routeToDelegate, setRouteToDelegate] = useState(true);
  const [remarks, setRemarks] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const targetDocs = useMemo(() => {
    if (documents && documents.length > 0) return documents;
    return document ? [document] : [];
  }, [document, documents]);

  const pendingBlockReason = useMemo(() => {
    for (const item of targetDocs) {
      if (item.lifecycleStatus === DocumentLifecycleStatus.ARCHIVED) {
        return `${item.trackingCode} is archived and closed — it can no longer be forwarded.`;
      }
      const latest = item.latestTransaction;
      if (latest?.receiptStatus === ReceiptStatus.PENDING) {
        if (actor && latest.isPendingForOffice(actor.office.id)) {
          return 'Confirm receipt of this incoming document before forwarding it onward.';
        }
        return 'Transfer is currently in transit awaiting recipient acknowledgment.';
      }
    }
    return null;
  }, [targetDocs, actor]);

  const availableOffices = useMemo(() => {
    if (!actor) return [];
    if (scopeMode === 'internal_office') return [actor.office];
    return offices.filter((o) => o.id !== actor.office.id);
  }, [actor, offices, scopeMode]);

  const effectiveOffice =
    availableOffices.find((o) => o.id === selectedOfficeId) ?? availableOffices[0] ?? null;
  const effectiveOfficeId = effectiveOffice?.id ?? '';

  const officePersonnel = useMemo(
    () =>
      personnelDirectory.filter(
        (p) => p.office.id === effectiveOfficeId && p.id !== actor?.id && p.isActive,
      ),
    [personnelDirectory, effectiveOfficeId, actor],
  );

  const chosenRecipient =
    officePersonnel.find((p) => p.id === selectedRecipientId) ?? officePersonnel[0] ?? null;

  const delegateTarget = useMemo(() => {
    if (!chosenRecipient?.delegateId) return null;
    return personnelDirectory.find((p) => p.id === chosenRecipient.delegateId) ?? null;
  }, [chosenRecipient, personnelDirectory]);

  const isOnLeave = chosenRecipient?.availability === AvailabilityStatus.ON_LEAVE;
  const disabled =
    isBusy ||
    Boolean(pendingBlockReason) ||
    targetDocs.length === 0 ||
    !chosenRecipient ||
    (isOnLeave && (!delegateTarget || !routeToDelegate));

  const handleSubmit = async () => {
    if (!chosenRecipient || disabled) return;
    setFormError(null);
    const payload = {
      recipientUserId: chosenRecipient.id,
      remarks,
      routeToDelegateIfOnLeave: routeToDelegate,
    };
    try {
      if (targetDocs.length === 1) {
        await forwardDocument(targetDocs[0], {
          ...payload,
          documentId: targetDocs[0].id,
        });
      } else {
        await batchForwardDocuments(targetDocs, payload);
      }
      setRemarks('');
      setVerified(false);
      onForwarded?.();
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to forward document.');
    }
  };

  if (targetDocs.length === 0) return null;

  const sheetTitle =
    targetDocs.length > 1 ? `Forward ${targetDocs.length} documents` : 'Forward document';
  const sheetSubtitle =
    targetDocs.length > 1
      ? targetDocs.map((d) => d.trackingCode).join(', ')
      : `${targetDocs[0].trackingCode} · ${targetDocs[0].title}`;

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={sheetTitle}
      subtitle={sheetSubtitle}
    >
      {pendingBlockReason || formError ? (
        <View style={styles.warnBanner}>
          <Text style={styles.warnBannerText}>{pendingBlockReason ?? formError}</Text>
        </View>
      ) : null}

      <View style={styles.segmentRow}>
        {(
          [
            { id: 'inter_office', label: 'Inter-office transfer' },
            { id: 'internal_office', label: 'Within my office' },
          ] as const
        ).map((tab) => {
          const active = scopeMode === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => {
                setScopeMode(tab.id);
                setOfficeMenuOpen(false);
                setSelectedRecipientId('');
              }}
              style={[styles.segmentBtn, active && styles.segmentBtnActive]}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {scopeMode === 'inter_office' && effectiveOffice ? (
        <View style={styles.block}>
          <Text style={styles.label}>Destination office</Text>
          <Pressable
            onPress={() => setOfficeMenuOpen((v) => !v)}
            style={styles.dropdownBox}
          >
            <Text style={styles.dropdownText}>{effectiveOffice.name}</Text>
            <ChevronDown size={17} color={SDO_COLORS.navy} />
          </Pressable>

          {officeMenuOpen ? (
            <View style={styles.officeMenu}>
              {availableOffices.map((off) => {
                const selected = off.id === effectiveOfficeId;
                return (
                  <Pressable
                    key={off.id}
                    onPress={() => {
                      setSelectedOfficeId(off.id);
                      setSelectedRecipientId('');
                      setOfficeMenuOpen(false);
                    }}
                    style={[styles.officeMenuItem, selected && styles.officeMenuItemSelected]}
                  >
                    <Text style={styles.officeMenuText}>
                      {off.code} · {off.name}
                    </Text>
                    {selected ? <Check size={15} color={SDO_COLORS.navy} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.block}>
        <Text style={styles.label}>Route to personnel</Text>
        {officePersonnel.length === 0 ? (
          <Text style={styles.emptyText}>No active personnel available in this unit.</Text>
        ) : (
          <View style={styles.listGap}>
            {officePersonnel.map((person) => {
              const selected = chosenRecipient?.id === person.id;
              const statusHint =
                person.availability === AvailabilityStatus.ON_LEAVE
                  ? 'Delegate required before forwarding'
                  : person.availability === AvailabilityStatus.OFFICIAL_BUSINESS
                    ? `${person.position} · Official business`
                    : `${person.position} · Can receive now`;

              return (
                <Pressable
                  key={person.id}
                  onPress={() => setSelectedRecipientId(person.id)}
                  style={styles.personCard}
                >
                  <View style={styles.personLeft}>
                    <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                      {selected ? <View style={styles.radioInner} /> : null}
                    </View>
                    <View style={styles.personCopy}>
                      <Text style={styles.personName}>{person.fullName}</Text>
                      <Text style={styles.personPos}>{statusHint}</Text>
                    </View>
                  </View>
                  <AvailabilityBadge status={person.availability} />
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {isOnLeave ? (
        <View style={styles.leaveWarn}>
          <Text style={styles.leaveTitle}>On leave? Route through a delegate.</Text>
          {delegateTarget ? (
            <>
              <Text style={styles.leaveIntro}>
                {chosenRecipient?.fullName} cannot receive directly. Their available delegate is
                selected below.
              </Text>
              <Pressable
                onPress={() => setRouteToDelegate((prev) => !prev)}
                style={styles.delegateRow}
              >
                <View style={styles.delegateCopy}>
                  <Text style={styles.delegateName}>
                    {delegateTarget.fullName} - {delegateTarget.office.name}
                  </Text>
                  <Text style={styles.delegateSub}>
                    {routeToDelegate
                      ? 'Available · Assigned delegate'
                      : 'Tap to enable delegate routing'}
                  </Text>
                </View>
                {routeToDelegate ? <Check size={16} color={SDO_COLORS.emeraldText} /> : null}
              </Pressable>
            </>
          ) : (
            <Text style={styles.leaveIntro}>
              Direct routing is blocked because this staff member has no active delegate.
            </Text>
          )}
        </View>
      ) : null}

      <View style={styles.remarksCard}>
        <Text style={styles.remarksLabel}>Remarks / Disposition (optional)</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetRow}
        >
          {DISPOSITION_REMARK_PRESETS.slice(0, 5).map((preset) => {
            const active = remarks === preset;
            return (
              <Pressable
                key={preset}
                onPress={() => setRemarks(preset)}
                style={[styles.presetChip, active && styles.presetChipActive]}
              >
                <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>
                  {preset}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <TextInput
          multiline
          value={remarks}
          onChangeText={setRemarks}
          placeholder="For review and appropriate action."
          placeholderTextColor={SDO_COLORS.textSecondary}
          style={styles.remarksInput}
        />
      </View>

      {!pendingBlockReason && chosenRecipient ? (
        <Pressable
          testID="mobile-forward-verify-toggle"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: verified }}
          onPress={() => setVerified((v) => !v)}
          style={styles.verifyRow}
        >
          <View style={[styles.verifyBox, verified && styles.verifyBoxOn]}>
            {verified ? <Check size={13} color="#FFFFFF" /> : null}
          </View>
          <Text style={styles.verifyText}>
            I confirm {chosenRecipient.office.code} · {chosenRecipient.fullName} is the correct
            recipient and the document (with attachments / hard copy) is complete.
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        disabled={disabled || !verified}
        onPress={handleSubmit}
        style={[styles.submitBtn, (disabled || !verified) && styles.submitDisabled]}
      >
        <Text style={styles.submitText}>
          {isOnLeave && delegateTarget && routeToDelegate
            ? 'Forward to delegate'
            : 'Forward document'}
        </Text>
      </Pressable>

      <Text style={styles.footerNote}>
        Custody changes only after the recipient confirms receipt.
      </Text>
    </ModalSheet>
  );
};

const styles = StyleSheet.create({
  verifyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: SDO_COLORS.surfaceSoft,
    marginBottom: 10,
  },
  verifyBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: SDO_COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  verifyBoxOn: { backgroundColor: SDO_COLORS.navy },
  verifyText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: SDO_COLORS.textPrimary },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surface,
  },
  segmentBtnActive: {
    borderColor: SDO_COLORS.navyInk,
    backgroundColor: SDO_COLORS.navyInk,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  block: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: SDO_COLORS.textMuted,
  },
  dropdownBox: {
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: SDO_COLORS.surfaceSoft,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dropdownText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  officeMenu: {
    borderRadius: 16,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 6,
    gap: 2,
  },
  officeMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  officeMenuItemSelected: {
    backgroundColor: SDO_COLORS.surface,
  },
  officeMenuText: {
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  listGap: {
    gap: 8,
  },
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 18,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 13,
  },
  personLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  radioOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: SDO_COLORS.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioOuterSelected: {
    borderColor: SDO_COLORS.navyInk,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SDO_COLORS.navyInk,
  },
  personCopy: {
    flex: 1,
  },
  personName: {
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  personPos: {
    fontSize: 11,
    color: SDO_COLORS.textMuted,
    marginTop: 2,
  },
  emptyText: {
    fontSize: 12,
    color: SDO_COLORS.textMuted,
    padding: 10,
  },
  leaveWarn: {
    borderRadius: 18,
    backgroundColor: SDO_COLORS.amberSoft,
    padding: 14,
    gap: 6,
  },
  leaveTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.amberText,
  },
  leaveIntro: {
    fontSize: 11,
    lineHeight: 16,
    color: SDO_COLORS.amberText,
  },
  delegateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  delegateCopy: {
    flex: 1,
    gap: 1,
  },
  delegateName: {
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  delegateSub: {
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.emeraldText,
  },
  remarksCard: {
    borderRadius: 18,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 14,
    gap: 4,
  },
  remarksLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.textMuted,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
  },
  presetChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  presetChipActive: {
    backgroundColor: SDO_COLORS.skySoft,
    borderColor: SDO_COLORS.navy,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  presetChipTextActive: {
    color: SDO_COLORS.navy,
  },
  remarksInput: {
    fontSize: 13,
    color: SDO_COLORS.textPrimary,
    padding: 0,
    minHeight: 36,
    textAlignVertical: 'top',
  },
  submitBtn: {
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.amber,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  submitDisabled: {
    opacity: 0.45,
  },
  submitText: {
    fontSize: 14,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  footerNote: {
    fontSize: 11,
    color: SDO_COLORS.textMuted,
    textAlign: 'center',
  },
  warnBanner: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SDO_COLORS.roseBorder,
    backgroundColor: SDO_COLORS.roseSoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  warnBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: SDO_COLORS.roseText,
  },
});
