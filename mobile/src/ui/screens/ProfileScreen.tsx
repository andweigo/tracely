import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import {
  ArrowLeft,
  BellOff,
  Building2,
  CalendarClock,
  Check,
  FileText,
  Fingerprint,
  KeyRound,
  Lock,
  LogOut,
  Plus,
  Radio,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  UserCog,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react-native';
import { AvailabilityStatus, SystemRole } from '../../domain/enums/DomainEnums';
import { useAppServices } from '../../state/AppServiceContext';
import { AvailabilityBadge } from '../components/Badges';
import { MobileIdentityWalletCard } from '../components/MobileIdentityWalletCard';
import { MobileScreenHeader } from '../components/MobileTopBars';
import {
  buildMobileLocalSentContributions,
  MobileSentContributionGraph,
} from '../components/MobileSentContributionGraph';
import { SentContributionReport } from '../../repositories/contracts/IDocumentRepository';
import { AuditInspectorSheet } from '../sheets/AuditInspectorSheet';
import {
  ActiveSessionsModal,
  ChangePasswordModal,
} from '../sheets/SecurityActionsSheet';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';
import { formatShortTimestamp } from '../utils/formatters';

function buildReturnIso(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * 3600_000).toISOString();
}

const ADMIN_ROLE_OPTIONS: ReadonlyArray<{ id: SystemRole; label: string }> = [
  { id: SystemRole.STAFF, label: 'Staff' },
  { id: SystemRole.UNIT_HEAD, label: 'Unit Head' },
  { id: SystemRole.RECORDS_OFFICER, label: 'Records' },
  { id: SystemRole.LEGAL_OFFICER, label: 'Legal' },
  { id: SystemRole.ICT_ADMIN, label: 'ICT Admin' },
];

export const ProfileScreen: React.FC = () => {
  const {
    actor,
    documents,
    offices,
    personnelDirectory,
    sessionMetadata,
    securityPrefs,
    workloadSummary,
    canApproveAccounts,
    pendingApprovals,
    adminUsers,
    realtimeStatus,
    fcmConfigured,
    updateAvailability,
    updateSecurityPrefs,
    getSentContributions,
    loadPendingUsers,
    approvePendingUser,
    rejectPendingUser,
    loadAdminUsers,
    updateAdminUser,
    createAdminOffice,
    updateAdminOffice,
    signOutAndWipeCache,
    auditLogs,
    isOnline,
    isBusy,
    pendingOfflineCount,
    setActiveTab,
    goBack,
  } = useAppServices();
  const [showAudit, setShowAudit] = useState(false);
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [lanyardDragging, setLanyardDragging] = useState(false);
  const [adminTab, setAdminTab] = useState<'approvals' | 'personnel' | 'offices'>('approvals');
  const [personnelQuery, setPersonnelQuery] = useState('');
  const [newOfficeCode, setNewOfficeCode] = useState('');
  const [newOfficeName, setNewOfficeName] = useState('');
  const [editingOfficeId, setEditingOfficeId] = useState<string | null>(null);
  const [editOfficeCode, setEditOfficeCode] = useState('');
  const [editOfficeName, setEditOfficeName] = useState('');
  const [serverContributions, setServerContributions] = useState<SentContributionReport | null>(
    null,
  );

  const localContributions = useMemo(
    () => buildMobileLocalSentContributions(documents, actor),
    [documents, actor],
  );

  useEffect(() => {
    if (!actor) {
      setServerContributions(null);
      return;
    }
    let cancelled = false;
    getSentContributions()
      .then((report) => {
        if (!cancelled) setServerContributions(report);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor?.id, documents.length]);

  const contributionReport = serverContributions ?? localContributions;

  useEffect(() => {
    if (actor && canApproveAccounts) {
      loadPendingUsers().catch(() => {});
      loadAdminUsers().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor?.id, canApproveAccounts]);

  const filteredAdminUsers = useMemo(() => {
    const q = personnelQuery.trim().toLowerCase();
    if (!q) return adminUsers;
    return adminUsers.filter(
      (person) =>
        person.fullName.toLowerCase().includes(q) ||
        person.employeeId.toLowerCase().includes(q) ||
        person.office.code.toLowerCase().includes(q) ||
        person.position.toLowerCase().includes(q),
    );
  }, [adminUsers, personnelQuery]);

  // Project strictly minimized peer records (name & position only; never coworker email or ID)
  const officePeers = useMemo(() => {
    if (!actor) return [];
    return personnelDirectory
      .filter((p) => p.office.id === actor.office.id && p.id !== actor.id)
      .map((p) => p.toPeerDirectorySummary());
  }, [actor, personnelDirectory]);

  const showReturnWindow =
    actor?.availability === AvailabilityStatus.ON_LEAVE ||
    actor?.availability === AvailabilityStatus.OFFICIAL_BUSINESS;

  return (
    <View style={styles.screen}>
      <MobileScreenHeader
        title="Profile"
        rightSlot={
          <Pressable
            onPress={() => setShowAudit(true)}
            accessibilityLabel="Inspect audit trail"
            style={styles.circleBtn}
          >
            <FileText size={18} color={SDO_COLORS.navyInk} />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        scrollEnabled={!lanyardDragging}
      >
        <MobileIdentityWalletCard
          testID="mobile-profile-wallet-card"
          onDragChange={setLanyardDragging}
          fullName={actor?.fullName ?? 'Tracely Workspace'}
          employeeId={actor?.employeeId ?? 'EMP-2026-0001'}
          position={actor?.position ?? 'Records Officer'}
          officeCode={actor?.office.code ?? 'RECORDS'}
          officeName={actor?.office.name ?? 'Records & Registry'}
          roleLabel={actor?.roleLabel ?? 'Records Officer'}
          email={actor?.email}
          accentColor={actor?.avatarColor}
          activeDocsCount={
            workloadSummary.pendingReceiptCount +
            workloadSummary.inProgressCount +
            workloadSummary.returnedCount
          }
          completedDocsCount={workloadSummary.inProgressCount}
          actionLabel="Edit Profile"
          onActionPress={() => setActiveTab('user_profile')}
          defaultMasked={true}
        />

        <View style={styles.identityMetaBar}>
          <View style={styles.identityStatusRow}>
            {actor ? <AvailabilityBadge status={actor.availability} /> : null}
          </View>
          <Pressable
            testID="mobile-open-user-profile-btn"
            onPress={() => setActiveTab('user_profile')}
            style={styles.editUserProfileBtn}
          >
            <UserCog size={15} color={SDO_COLORS.navy} />
            <Text style={styles.editUserProfileBtnText}>Edit Profile</Text>
          </Pressable>
        </View>

        <View style={styles.softCard}>
          <Text style={styles.cardHeading}>Overview</Text>
          <View style={styles.statsGrid}>
            {(
              [
                { label: 'Pending Receipt', value: String(workloadSummary.pendingReceiptCount) },
                { label: 'In Review', value: String(workloadSummary.inProgressCount) },
                { label: 'Returned', value: String(workloadSummary.returnedCount) },
                { label: 'SLA On-Time', value: `${workloadSummary.onTimeSlaPercent}%` },
              ] as const
            ).map((stat) => (
              <View key={stat.label} style={styles.statTile}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {actor ? (
          <MobileSentContributionGraph
            report={contributionReport}
            defaultScope="user"
            testID="mobile-profile-sent-contributions"
          />
        ) : null}

        <View style={styles.softCard}>
          <Text style={styles.cardHeading}>Availability</Text>
          <View style={styles.availRow}>
            {(
              [
                { id: AvailabilityStatus.AVAILABLE, label: 'Available' },
                { id: AvailabilityStatus.OFFICIAL_BUSINESS, label: 'Official Bus.' },
                { id: AvailabilityStatus.ON_LEAVE, label: 'On Leave' },
              ] as const
            ).map((opt) => {
              const active = actor?.availability === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  disabled={!actor || isBusy}
                  onPress={() => {
                    updateAvailability(
                      opt.id,
                      opt.id === AvailabilityStatus.ON_LEAVE ? officePeers[0]?.id ?? null : null,
                      opt.id === AvailabilityStatus.AVAILABLE ? null : actor?.availabilityUntil,
                    ).catch(() => {});
                  }}
                  style={[
                    styles.availPill,
                    active && styles.availPillActive,
                    !actor && styles.disabled,
                  ]}
                >
                  <Text style={[styles.availText, active && styles.availTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {showReturnWindow && actor ? (
            <View style={styles.returnBox}>
              <View style={styles.rowLeft}>
                <CalendarClock size={14} color={SDO_COLORS.navy} />
                <Text style={styles.returnTitle}>
                  {actor.availabilityUntil
                    ? `Returns: ${formatShortTimestamp(actor.availabilityUntil)}`
                    : 'Set Expected Return Window'}
                </Text>
              </View>
              <View style={styles.returnChipRow}>
                {(
                  [
                    { label: 'Today 5 PM', hours: 5 },
                    { label: 'Tomorrow', hours: 24 },
                    { label: '+3 Days', hours: 72 },
                  ] as const
                ).map((preset) => (
                  <Pressable
                    key={preset.label}
                    disabled={isBusy}
                    onPress={() => {
                      updateAvailability(
                        actor.availability,
                        actor.delegateId,
                        buildReturnIso(preset.hours),
                      ).catch(() => {});
                    }}
                    style={styles.returnChip}
                  >
                    <Text style={styles.returnChipText}>{preset.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {!actor ? (
            <Text style={styles.helperHint}>
              Sign in to manage your availability and delegate.
            </Text>
          ) : null}

          {actor?.availability === AvailabilityStatus.ON_LEAVE ? (
            <View style={styles.delegateBox}>
              <Text style={styles.delegateTitle}>Assigned Delegate (While On Leave)</Text>
              {officePeers.length > 0 ? (
                officePeers.map((peer) => {
                  const selected = actor.delegateId === peer.id;
                  return (
                    <Pressable
                      key={peer.id}
                      disabled={isBusy}
                      onPress={() => {
                        updateAvailability(
                          AvailabilityStatus.ON_LEAVE,
                          selected ? null : peer.id,
                          actor.availabilityUntil,
                        ).catch(() => {});
                      }}
                      style={[styles.peerBtn, selected && styles.peerBtnSelected]}
                    >
                      <Text style={styles.peerText}>
                        {selected ? '✓ ' : ''}
                        {peer.fullName} ({peer.position})
                      </Text>
                    </Pressable>
                  );
                })
              ) : (
                <Text style={styles.delegateWarn}>
                  No other staff in {actor.office.code}; direct routing to you is blocked.
                </Text>
              )}
            </View>
          ) : null}
        </View>

        {actor && canApproveAccounts ? (
          <View style={styles.softCard} testID="mobile-admin-approvals">
            <View style={styles.rowBetween}>
              <View style={styles.rowLeft}>
                <UserPlus size={16} color={SDO_COLORS.navy} />
                <Text style={styles.cardHeading}>ICT / HR Admin Console</Text>
              </View>
              <Pressable
                disabled={isBusy}
                onPress={() => {
                  loadPendingUsers().catch(() => {});
                  loadAdminUsers().catch(() => {});
                }}
                style={styles.refreshMiniBtn}
              >
                <RefreshCw size={12} color={SDO_COLORS.navy} />
                <Text style={styles.refreshMiniText}>Refresh</Text>
              </Pressable>
            </View>

            <View style={styles.adminTabRow}>
              {(
                [
                  { id: 'approvals', label: `Approvals (${pendingApprovals.length})`, icon: UserPlus },
                  { id: 'personnel', label: `Personnel (${adminUsers.length})`, icon: Users },
                  { id: 'offices', label: `Offices (${offices.length})`, icon: Building2 },
                ] as const
              ).map((tab) => {
                const active = adminTab === tab.id;
                const Icon = tab.icon;
                return (
                  <Pressable
                    key={tab.id}
                    testID={`mobile-admin-tab-${tab.id}`}
                    onPress={() => setAdminTab(tab.id)}
                    style={[styles.adminTabBtn, active && styles.adminTabBtnActive]}
                  >
                    <Icon size={12} color={active ? '#FFFFFF' : SDO_COLORS.textSecondary} />
                    <Text
                      numberOfLines={1}
                      style={[styles.adminTabText, active && styles.adminTabTextActive]}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {adminTab === 'approvals' ? (
              pendingApprovals.length === 0 ? (
                <Text style={styles.approvalEmptyText}>
                  No pending account registrations awaiting administrator approval.
                </Text>
              ) : (
                pendingApprovals.map((candidate) => (
                  <View
                    key={candidate.id}
                    style={styles.approvalRow}
                    testID={`mobile-pending-user-${candidate.id}`}
                  >
                    <View style={styles.approvalCopy}>
                      <Text style={styles.approvalName}>
                        {`${candidate.fullName} (${candidate.employeeId})`}
                      </Text>
                      <Text style={styles.approvalSub}>
                        {`${candidate.position} · ${candidate.office.code}`}
                      </Text>
                      <Text style={styles.approvalEmail}>{candidate.email}</Text>
                    </View>
                    <View style={styles.approvalBtns}>
                      <Pressable
                        disabled={isBusy}
                        onPress={() => {
                          approvePendingUser(candidate.id).catch(() => {});
                        }}
                        style={[styles.approveBtn, isBusy && styles.disabled]}
                      >
                        <Check size={13} color="#FFFFFF" />
                        <Text style={styles.approveBtnText}>Approve</Text>
                      </Pressable>
                      <Pressable
                        disabled={isBusy}
                        onPress={() => {
                          rejectPendingUser(candidate.id).catch(() => {});
                        }}
                        style={[styles.rejectBtn, isBusy && styles.disabled]}
                      >
                        <X size={13} color={SDO_COLORS.roseText} />
                        <Text style={styles.rejectBtnText}>Reject</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )
            ) : null}

            {adminTab === 'personnel' ? (
              <View style={styles.adminSectionStack}>
                <TextInput
                  value={personnelQuery}
                  onChangeText={setPersonnelQuery}
                  placeholder="Search name, employee ID, or office..."
                  placeholderTextColor={SDO_COLORS.textMuted}
                  style={styles.adminInput}
                />
                {filteredAdminUsers.length === 0 ? (
                  <Text style={styles.approvalEmptyText}>
                    No personnel match your search filter.
                  </Text>
                ) : (
                  filteredAdminUsers.map((person) => {
                    const isSelf = person.id === actor.id;
                    return (
                      <View
                        key={person.id}
                        style={styles.approvalRow}
                        testID={`mobile-admin-user-${person.id}`}
                      >
                        <View style={styles.rowBetween}>
                          <View style={styles.approvalCopy}>
                            <Text style={styles.approvalName}>
                              {`${person.fullName} (${person.employeeId})`}
                            </Text>
                            <Text style={styles.approvalSub}>
                              {`${person.position} · ${person.office.code} · ${person.roleLabel}`}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.statusDotPill,
                              !person.isActive && styles.statusDotPillInactive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusDotText,
                                !person.isActive && styles.statusDotTextInactive,
                              ]}
                            >
                              {person.isActive ? 'Active' : 'Inactive'}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.miniSectionLabel}>Role</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View style={styles.chipRow}>
                            {ADMIN_ROLE_OPTIONS.map((roleOpt) => {
                              const selected = person.role === roleOpt.id;
                              return (
                                <Pressable
                                  key={roleOpt.id}
                                  disabled={isBusy || selected}
                                  onPress={() => {
                                    updateAdminUser(person.id, { role: roleOpt.id }).catch(
                                      () => {},
                                    );
                                  }}
                                  style={[styles.miniChip, selected && styles.miniChipActive]}
                                >
                                  <Text
                                    style={[
                                      styles.miniChipText,
                                      selected && styles.miniChipTextActive,
                                    ]}
                                  >
                                    {roleOpt.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </ScrollView>

                        <Text style={styles.miniSectionLabel}>Office Transfer</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View style={styles.chipRow}>
                            {offices.map((office) => {
                              const selected = person.office.id === office.id;
                              return (
                                <Pressable
                                  key={office.id}
                                  disabled={isBusy || selected}
                                  onPress={() => {
                                    updateAdminUser(person.id, { officeId: office.id }).catch(
                                      () => {},
                                    );
                                  }}
                                  style={[styles.miniChip, selected && styles.miniChipActive]}
                                >
                                  <Text
                                    style={[
                                      styles.miniChipText,
                                      selected && styles.miniChipTextActive,
                                    ]}
                                  >
                                    {office.code}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </ScrollView>

                        {!isSelf ? (
                          <Pressable
                            disabled={isBusy}
                            onPress={() => {
                              updateAdminUser(person.id, { active: !person.isActive }).catch(
                                () => {},
                              );
                            }}
                            style={[
                              person.isActive ? styles.rejectBtn : styles.approveBtn,
                              isBusy && styles.disabled,
                            ]}
                          >
                            <Text
                              style={
                                person.isActive ? styles.rejectBtnText : styles.approveBtnText
                              }
                            >
                              {person.isActive
                                ? 'Deactivate Account (Revoke Tokens)'
                                : 'Reactivate Account'}
                            </Text>
                          </Pressable>
                        ) : (
                          <Text style={styles.helperHint}>
                            Current signed-in admin account (self-deactivation blocked).
                          </Text>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            ) : null}

            {adminTab === 'offices' ? (
              <View style={styles.adminSectionStack}>
                <View style={styles.approvalRow}>
                  <Text style={styles.miniSectionLabel}>Register New Office / Unit</Text>
                  <View style={styles.officeFormRow}>
                    <TextInput
                      value={newOfficeCode}
                      onChangeText={setNewOfficeCode}
                      placeholder="Code (e.g. SUPPLY)"
                      placeholderTextColor={SDO_COLORS.textMuted}
                      autoCapitalize="characters"
                      style={[styles.adminInput, styles.officeCodeInput]}
                    />
                    <TextInput
                      value={newOfficeName}
                      onChangeText={setNewOfficeName}
                      placeholder="Full Office Name"
                      placeholderTextColor={SDO_COLORS.textMuted}
                      style={[styles.adminInput, styles.officeNameInput]}
                    />
                  </View>
                  <Pressable
                    disabled={isBusy || !newOfficeCode.trim() || !newOfficeName.trim()}
                    onPress={() => {
                      createAdminOffice({
                        code: newOfficeCode.trim().toUpperCase(),
                        name: newOfficeName.trim(),
                      })
                        .then(() => {
                          setNewOfficeCode('');
                          setNewOfficeName('');
                        })
                        .catch(() => {});
                    }}
                    style={[
                      styles.approveBtn,
                      (isBusy || !newOfficeCode.trim() || !newOfficeName.trim()) && styles.disabled,
                    ]}
                  >
                    <Plus size={13} color="#FFFFFF" />
                    <Text style={styles.approveBtnText}>Add Office</Text>
                  </Pressable>
                </View>

                {offices.map((office) => {
                  const isEditing = editingOfficeId === office.id;
                  return (
                    <View key={office.id} style={styles.approvalRow}>
                      {isEditing ? (
                        <View style={styles.adminSectionStack}>
                          <View style={styles.officeFormRow}>
                            <TextInput
                              value={editOfficeCode}
                              onChangeText={setEditOfficeCode}
                              autoCapitalize="characters"
                              style={[styles.adminInput, styles.officeCodeInput]}
                            />
                            <TextInput
                              value={editOfficeName}
                              onChangeText={setEditOfficeName}
                              style={[styles.adminInput, styles.officeNameInput]}
                            />
                          </View>
                          <View style={styles.approvalBtns}>
                            <Pressable
                              disabled={isBusy || !editOfficeCode.trim() || !editOfficeName.trim()}
                              onPress={() => {
                                updateAdminOffice(office.id, {
                                  code: editOfficeCode.trim().toUpperCase(),
                                  name: editOfficeName.trim(),
                                })
                                  .then(() => setEditingOfficeId(null))
                                  .catch(() => {});
                              }}
                              style={[styles.approveBtn, isBusy && styles.disabled]}
                            >
                              <Check size={13} color="#FFFFFF" />
                              <Text style={styles.approveBtnText}>Save</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => setEditingOfficeId(null)}
                              style={styles.rejectBtn}
                            >
                              <X size={13} color={SDO_COLORS.roseText} />
                              <Text style={styles.rejectBtnText}>Cancel</Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.rowBetween}>
                          <View style={styles.approvalCopy}>
                            <Text style={styles.approvalName}>{office.code}</Text>
                            <Text style={styles.approvalSub}>{office.name}</Text>
                          </View>
                          <Pressable
                            onPress={() => {
                              setEditingOfficeId(office.id);
                              setEditOfficeCode(office.code);
                              setEditOfficeName(office.name);
                            }}
                            style={styles.refreshMiniBtn}
                          >
                            <Text style={styles.refreshMiniText}>Rename</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.softCard}>
          <View style={styles.rowLeft}>
            <ShieldCheck size={16} color={SDO_COLORS.emeraldText} />
            <Text style={styles.cardHeading}>Device Security & Privacy Guard</Text>
          </View>

          {sessionMetadata ? (
            <View style={styles.metaList}>
              <View style={styles.rowBetween}>
                <View style={styles.rowLeft}>
                  <KeyRound size={13} color={SDO_COLORS.textMuted} />
                  <Text style={styles.metaLabel}>Sanctum Token</Text>
                </View>
                <Text style={styles.metaMono}>{sessionMetadata.tokenHint}</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.metaLabel}>Keystore</Text>
                <Text style={styles.metaVal}>Hardware-backed AES-GCM</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.metaLabel}>Expires</Text>
                <Text style={styles.metaVal}>
                  {formatShortTimestamp(sessionMetadata.expiresAt)}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.toggleRow}>
            <View style={styles.toggleIcon}>
              <Fingerprint size={16} color={SDO_COLORS.navy} />
            </View>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleTitle}>Device Lock for Confidential Docs</Text>
              <Text style={styles.toggleSub}>
                Require Android screen lock / biometrics before 60s PDF viewing
              </Text>
            </View>
            <Switch
              value={securityPrefs.biometricGateEnabled}
              disabled={isBusy}
              onValueChange={(next) => {
                updateSecurityPrefs({ biometricGateEnabled: next }).catch(() => {});
              }}
              trackColor={{ false: '#CBD5E1', true: SDO_COLORS.navy }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleIcon}>
              <BellOff size={16} color={SDO_COLORS.navy} />
            </View>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleTitle}>Hide Titles on Lock Screen</Text>
              <Text style={styles.toggleSub}>
                Mask document titles & sender names inside push previews
              </Text>
            </View>
            <Switch
              value={securityPrefs.hideLockScreenTitles}
              disabled={isBusy}
              onValueChange={(next) => {
                updateSecurityPrefs({ hideLockScreenTitles: next }).catch(() => {});
              }}
              trackColor={{ false: '#CBD5E1', true: SDO_COLORS.navy }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleIcon}>
              <Lock size={16} color={SDO_COLORS.navy} />
            </View>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleTitle}>Screenshot Shield (FLAG_SECURE)</Text>
              <Text style={styles.toggleSub}>
                Block Android screenshots & screen recordings inside Tracely
              </Text>
            </View>
            <Switch
              value={securityPrefs.screenshotShieldEnabled}
              disabled={isBusy}
              onValueChange={(next) => {
                updateSecurityPrefs({ screenshotShieldEnabled: next }).catch(() => {});
              }}
              trackColor={{ false: '#CBD5E1', true: SDO_COLORS.navy }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.networkStatusRow, !isOnline && styles.networkStatusOffline]}>
            {isOnline ? (
              <Wifi size={16} color={SDO_COLORS.emeraldText} />
            ) : (
              <WifiOff size={16} color={SDO_COLORS.amberText} />
            )}
            <Text style={[styles.networkStatusText, !isOnline && styles.networkStatusOfflineText]}>
              {isOnline
                ? `Online · Live sync enabled${pendingOfflineCount > 0 ? ` (${pendingOfflineCount} queued)` : ''}`
                : `Offline · ${pendingOfflineCount} capture(s) queued for auto-sync`}
            </Text>
          </View>

          <View style={styles.livePulseRow}>
            <Radio
              size={15}
              color={realtimeStatus === 'live' ? SDO_COLORS.emeraldText : SDO_COLORS.navy}
            />
            <Text style={styles.livePulseText}>
              {realtimeStatus === 'live'
                ? `Real-Time Live Pulse Active (3s) · ${fcmConfigured ? 'FCM Push Live' : 'SSE & Push Ready'}`
                : `Background Sync Polling · ${fcmConfigured ? 'FCM Push Live' : 'SSE & Push Ready'}`}
            </Text>
          </View>

          <Pressable onPress={() => setShowSessionsModal(true)} style={styles.whiteBtn}>
            <Smartphone size={16} color={SDO_COLORS.navy} />
            <Text style={styles.whiteBtnText}>Active Devices & Sanctum Sessions</Text>
          </Pressable>

          <Pressable onPress={() => setShowPasswordModal(true)} style={styles.whiteBtn}>
            <Lock size={16} color={SDO_COLORS.navy} />
            <Text style={styles.whiteBtnText}>Change Account Password</Text>
          </Pressable>

          <Pressable onPress={() => setShowAudit(true)} style={styles.whiteBtn}>
            <FileText size={16} color={SDO_COLORS.navy} />
            <Text style={styles.whiteBtnText}>
              Audit Trail ({auditLogs.length} loaded)
            </Text>
          </Pressable>

          {actor ? (
            <Pressable
              disabled={isBusy}
              onPress={() => {
                signOutAndWipeCache().catch(() => {});
              }}
              style={[styles.wipeBtn, isBusy && styles.disabled]}
            >
              <LogOut size={15} color="#FFFFFF" />
              <Text style={styles.wipeBtnText}>Sign Out & Wipe Local Cache</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <AuditInspectorSheet open={showAudit} onClose={() => setShowAudit(false)} />
      <ActiveSessionsModal open={showSessionsModal} onClose={() => setShowSessionsModal(false)} />
      <ChangePasswordModal open={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SDO_COLORS.bg,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SDO_COLORS.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 16,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  container: {
    paddingHorizontal: 18,
    paddingBottom: 28,
    gap: 14,
  },
  identityMetaBar: {
    gap: 10,
    paddingHorizontal: 2,
  },
  identityStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  hrVerifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SDO_COLORS.emeraldSoft,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  hrVerifiedText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: SDO_COLORS.emeraldText,
  },
  heroStatusPill: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
    backgroundColor: SDO_COLORS.amber,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  editUserProfileBtn: {
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surface,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  editUserProfileBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12.5,
    fontWeight: '800',
    color: SDO_COLORS.navy,
  },
  softCard: {
    borderRadius: 20,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 16,
    gap: 10,
  },
  cardHeading: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 14,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statTile: {
    width: '48%',
    borderRadius: 14,
    backgroundColor: SDO_COLORS.surface,
    paddingVertical: 11,
    paddingHorizontal: 12,
    gap: 2,
  },
  statValue: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 18,
    fontWeight: '800',
    color: SDO_COLORS.navy,
  },
  statLabel: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '600',
    color: SDO_COLORS.textSecondary,
  },
  availRow: {
    flexDirection: 'row',
    gap: 8,
  },
  availPill: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  availPillActive: {
    backgroundColor: SDO_COLORS.navyInk,
  },
  availText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  availTextActive: {
    color: '#FFFFFF',
  },
  returnBox: {
    borderRadius: 14,
    backgroundColor: SDO_COLORS.surface,
    padding: 12,
    gap: 8,
  },
  returnTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  returnChipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  returnChip: {
    borderRadius: 999,
    backgroundColor: SDO_COLORS.skySoft,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  returnChipText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  helperHint: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    lineHeight: 16,
    color: SDO_COLORS.textMuted,
  },
  delegateBox: {
    borderRadius: 14,
    backgroundColor: SDO_COLORS.amberSoft,
    padding: 12,
    gap: 8,
  },
  delegateTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.amberText,
  },
  peerBtn: {
    borderRadius: 12,
    backgroundColor: SDO_COLORS.surface,
    padding: 10,
  },
  peerBtnSelected: {
    borderWidth: 1.5,
    borderColor: SDO_COLORS.navy,
  },
  peerText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '600',
    color: SDO_COLORS.textPrimary,
  },
  delegateWarn: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    color: SDO_COLORS.amberText,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaList: {
    gap: 6,
  },
  metaLabel: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    color: SDO_COLORS.textSecondary,
  },
  metaMono: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: SDO_FONTS.mono,
    color: SDO_COLORS.textPrimary,
  },
  metaVal: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    color: SDO_COLORS.textPrimary,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    backgroundColor: SDO_COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toggleIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: SDO_COLORS.skySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleCopy: {
    flex: 1,
    gap: 1,
  },
  toggleTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  toggleSub: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    lineHeight: 15,
    color: SDO_COLORS.textSecondary,
  },
  networkStatusRow: {
    minHeight: 40,
    borderRadius: 14,
    backgroundColor: SDO_COLORS.emeraldSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  networkStatusOffline: {
    backgroundColor: SDO_COLORS.amberSoft,
  },
  networkStatusText: {
    fontFamily: SDO_FONTS.sans,
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.emeraldText,
  },
  networkStatusOfflineText: {
    color: SDO_COLORS.amberText,
  },
  whiteBtn: {
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  whiteBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  whiteBtnUrl: {
    flex: 1,
    fontSize: 11,
    fontFamily: SDO_FONTS.mono,
    color: SDO_COLORS.navy,
  },
  wipeBtn: {
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.rose,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  wipeBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  refreshMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  refreshMiniText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  approvalEmptyText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    color: SDO_COLORS.textSecondary,
    lineHeight: 17,
  },
  approvalRow: {
    borderRadius: 14,
    backgroundColor: SDO_COLORS.surface,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    padding: 12,
    gap: 8,
  },
  approvalCopy: {
    gap: 2,
  },
  approvalName: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  approvalSub: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    fontWeight: '600',
    color: SDO_COLORS.textSecondary,
  },
  approvalEmail: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    color: SDO_COLORS.textMuted,
  },
  approvalBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  approveBtn: {
    flex: 1,
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.navy,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  approveBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  rejectBtn: {
    flex: 1,
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SDO_COLORS.roseBorder,
    backgroundColor: SDO_COLORS.roseSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  rejectBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '800',
    color: SDO_COLORS.roseText,
  },
  adminTabRow: {
    flexDirection: 'row',
    gap: 6,
  },
  adminTabBtn: {
    flex: 1,
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surface,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  adminTabBtnActive: {
    backgroundColor: SDO_COLORS.navy,
    borderColor: SDO_COLORS.navy,
  },
  adminTabText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  adminTabTextActive: {
    color: '#FFFFFF',
  },
  adminSectionStack: {
    gap: 8,
  },
  adminInput: {
    fontFamily: SDO_FONTS.sans,
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12.5,
    color: SDO_COLORS.textPrimary,
  },
  officeFormRow: {
    flexDirection: 'row',
    gap: 8,
  },
  officeCodeInput: {
    width: 108,
  },
  officeNameInput: {
    flex: 1,
  },
  statusDotPill: {
    borderRadius: 999,
    backgroundColor: SDO_COLORS.emeraldSoft,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  statusDotPillInactive: {
    backgroundColor: SDO_COLORS.roseSoft,
  },
  statusDotText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 10.5,
    fontWeight: '800',
    color: SDO_COLORS.emeraldText,
  },
  statusDotTextInactive: {
    color: SDO_COLORS.roseText,
  },
  miniSectionLabel: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: SDO_COLORS.textMuted,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  miniChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surfaceSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  miniChipActive: {
    backgroundColor: SDO_COLORS.navy,
    borderColor: SDO_COLORS.navy,
  },
  miniChipText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  miniChipTextActive: {
    color: '#FFFFFF',
  },
  livePulseRow: {
    minHeight: 38,
    borderRadius: 14,
    backgroundColor: SDO_COLORS.skySoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  livePulseText: {
    fontFamily: SDO_FONTS.sans,
    flex: 1,
    fontSize: 11.5,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  disabled: {
    opacity: 0.45,
  },
});
