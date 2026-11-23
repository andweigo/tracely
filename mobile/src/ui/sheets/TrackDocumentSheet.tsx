import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, MapPin, Search, X } from 'lucide-react-native';
import type { DocumentTrackingSnapshot } from '../../domain/security/AccessPolicy';
import { useAppServices } from '../../state/AppServiceContext';
import { ModalSheet } from '../components/ModalSheet';
import {
  TrackingGroupedList,
  TrackingLocationCard,
} from '../components/TrackingLocationCard';
import { SDO_COLORS } from '../theme/tokens';

interface TrackDocumentSheetProps {
  open: boolean;
  onClose: () => void;
}

type TrackerScope = 'sent' | 'all_office';

export const TrackDocumentSheet: React.FC<TrackDocumentSheetProps> = ({ open, onClose }) => {
  const { actor, trackedSnapshots, trackDocumentByCode, openDocument, isBusy } = useAppServices();
  const [searchQuery, setSearchQuery] = useState('');
  const [scope, setScope] = useState<TrackerScope>('sent');
  const [lookupResult, setLookupResult] = useState<DocumentTrackingSnapshot | null>(null);

  const sentByOfficeSnapshots = useMemo(
    () => trackedSnapshots.filter((snap) => snap.sentByActorOffice),
    [trackedSnapshots],
  );

  const activeList = useMemo(() => {
    const base =
      scope === 'sent' && sentByOfficeSnapshots.length > 0
        ? sentByOfficeSnapshots
        : trackedSnapshots;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (snap) =>
        snap.trackingCode.toLowerCase().includes(q) ||
        snap.displayTitle.toLowerCase().includes(q) ||
        snap.currentOffice.name.toLowerCase().includes(q) ||
        snap.currentOffice.code.toLowerCase().includes(q),
    );
  }, [scope, sentByOfficeSnapshots, trackedSnapshots, searchQuery]);

  const handleServerLookup = async () => {
    if (!searchQuery.trim() || isBusy) return;
    try {
      const result = await trackDocumentByCode(searchQuery);
      setLookupResult(result);
    } catch {
      // Error surfaced via AppServiceContext toast
    }
  };

  const handleClose = () => {
    setLookupResult(null);
    setSearchQuery('');
    onClose();
  };

  const officeCode = actor?.office.code ?? 'Your Office';

  return (
    <ModalSheet
      open={open}
      onClose={handleClose}
      title="Tracking"
      subtitle={`Browse documents sent by ${officeCode} and expand any card for timestamps`}
    >
      {lookupResult ? (
        <View style={styles.detailWrap}>
          <Pressable onPress={() => setLookupResult(null)} style={styles.backBtn}>
            <ArrowLeft size={14} color={SDO_COLORS.navy} />
            <Text style={styles.backBtnText}>Back to {officeCode} document list</Text>
          </Pressable>

          <TrackingLocationCard
            snapshot={lookupResult}
            defaultExpanded
            onOpenDocument={(docId) => {
              handleClose();
              openDocument(docId);
            }}
          />
        </View>
      ) : (
        <View style={styles.listWrap}>
          <View style={styles.inputRow}>
            <Search size={16} color={SDO_COLORS.textMuted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Filter office docs or type tracking code..."
              placeholderTextColor={SDO_COLORS.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.input}
            />
            {searchQuery.length > 0 ? (
              <Pressable onPress={() => setSearchQuery('')} accessibilityLabel="Clear filter">
                <X size={15} color={SDO_COLORS.textMuted} />
              </Pressable>
            ) : null}
          </View>

          {trackedSnapshots.length > 0 ? (
            <View style={styles.scopeRow}>
              <Pressable
                onPress={() => setScope('sent')}
                style={[styles.scopePill, scope === 'sent' && styles.scopePillActive]}
              >
                <Text style={[styles.scopeText, scope === 'sent' && styles.scopeTextActive]}>
                  Sent by {officeCode} ({sentByOfficeSnapshots.length})
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setScope('all_office')}
                style={[styles.scopePill, scope === 'all_office' && styles.scopePillActive]}
              >
                <Text
                  style={[styles.scopeText, scope === 'all_office' && styles.scopeTextActive]}
                >
                  All Office Docs ({trackedSnapshots.length})
                </Text>
              </Pressable>
            </View>
          ) : null}

          {activeList.length > 0 ? (
            <TrackingGroupedList
              snapshots={activeList}
              expandSingleItem={false}
              onOpenDocument={(docId) => {
                handleClose();
                openDocument(docId);
              }}
            />
          ) : (
            <View style={styles.emptyBox}>
              <MapPin size={22} color={SDO_COLORS.textMuted} />
              <Text style={styles.emptyTitle}>
                {searchQuery.trim()
                  ? 'No matching document in local list'
                  : `No documents listed for ${officeCode} yet`}
              </Text>
              <Text style={styles.emptyBody}>
                {searchQuery.trim()
                  ? 'Tap below to query the Tracely server directly for this tracking code.'
                  : 'Once connected to your Tracely server, documents originated or sent by your office appear here with live received timestamps.'}
              </Text>
            </View>
          )}

          {searchQuery.trim().length > 0 ? (
            <Pressable
              disabled={isBusy}
              onPress={handleServerLookup}
              style={[styles.lookupBtn, isBusy && styles.disabled]}
            >
              <MapPin size={16} color={SDO_COLORS.navyInk} />
              <Text style={styles.lookupBtnText}>
                {isBusy ? 'Checking Server...' : `Check "${searchQuery.trim()}" on Server`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </ModalSheet>
  );
};

const styles = StyleSheet.create({
  detailWrap: {
    gap: 12,
  },
  backBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.skySoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  listWrap: {
    gap: 12,
  },
  inputRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surfaceSoft,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'monospace',
    color: SDO_COLORS.textPrimary,
  },
  scopeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scopePill: {
    flex: 1,
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  scopePillActive: {
    backgroundColor: SDO_COLORS.navyInk,
  },
  scopeText: {
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  scopeTextActive: {
    color: '#FFFFFF',
  },
  emptyBox: {
    borderRadius: 18,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 18,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 12,
    lineHeight: 17,
    color: SDO_COLORS.textSecondary,
    textAlign: 'center',
  },
  lookupBtn: {
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.amber,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  lookupBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  disabled: {
    opacity: 0.45,
  },
});
