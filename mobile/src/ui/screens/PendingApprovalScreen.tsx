import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Lock,
  LogIn,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react-native';
import { useAppServices } from '../../state/AppServiceContext';
import { AppIconBadge } from '../components/AppIconBadge';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';

const AUTO_POLL_MS = 15_000;

export const PendingApprovalScreen: React.FC = () => {
  const {
    pendingRegistration,
    checkPendingRegistrationStatus,
    proceedFromPendingToLogin,
    dismissPendingRegistration,
    setActiveTab,
  } = useAppServices();

  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!pendingRegistration) return;
    if (pendingRegistration.status !== 'pending' || !pendingRegistration.statusToken) return;

    const timer = setInterval(() => {
      void checkPendingRegistrationStatus(true);
    }, AUTO_POLL_MS);

    return () => clearInterval(timer);
  }, [pendingRegistration, checkPendingRegistrationStatus]);

  if (!pendingRegistration) {
    return (
      <View style={styles.flex} testID="mobile-pending-approval-screen">
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.brandHeader}>
            <AppIconBadge size={64} animated interactive />
            <Text style={styles.brandTitle}>No Pending Registration</Text>
            <Text style={styles.brandSubtitle}>
              Sign in or submit a new registration request to access Tracely.
            </Text>
          </View>
          <Pressable
            onPress={() => setActiveTab('login')}
            style={styles.primaryBtn}
            accessibilityRole="button"
          >
            <LogIn size={16} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Go to Sign In</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  const isApproved = pendingRegistration.status === 'approved';
  const isRejected = pendingRegistration.status === 'rejected';
  const isPending = pendingRegistration.status === 'pending';

  const handleManualCheck = async () => {
    setChecking(true);
    try {
      await checkPendingRegistrationStatus(false);
    } finally {
      setChecking(false);
    }
  };

  const checkedTimeLabel = pendingRegistration.checkedAt
    ? new Date(pendingRegistration.checkedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <View style={styles.flex} testID="mobile-pending-approval-screen">
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandHeader}>
          <AppIconBadge size={68} animated interactive />
          <View
            testID="mobile-pending-status-pill"
            style={[
              styles.statusPill,
              isApproved
                ? styles.pillApproved
                : isRejected
                  ? styles.pillRejected
                  : styles.pillPending,
            ]}
          >
            {isApproved ? (
              <CheckCircle2 size={13} color={SDO_COLORS.emeraldText} />
            ) : isRejected ? (
              <ShieldAlert size={13} color={SDO_COLORS.roseText} />
            ) : (
              <Clock size={13} color={SDO_COLORS.amberText} />
            )}
            <Text
              style={[
                styles.statusPillText,
                isApproved
                  ? styles.pillTextApproved
                  : isRejected
                    ? styles.pillTextRejected
                    : styles.pillTextPending,
              ]}
            >
              {isApproved
                ? 'Account Approved'
                : isRejected
                  ? 'Registration Declined'
                  : 'Awaiting Administrator Verification'}
            </Text>
          </View>

          <Text style={styles.brandTitle}>
            {isApproved
              ? 'Your Tracely Account Is Ready'
              : isRejected
                ? 'Registration Not Approved'
                : 'Account Pending Approval'}
          </Text>
          <Text style={styles.brandSubtitle}>
            {isApproved
              ? 'Your account is active. You can sign in now.'
              : isRejected
                ? pendingRegistration.message
                : 'Your account is waiting for administrator approval.'}
          </Text>
        </View>

        <View style={styles.card} testID="mobile-pending-summary-card">
          <Text style={styles.sectionLabel}>SUBMITTED REGISTRATION</Text>

          {pendingRegistration.fullName ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Full Name</Text>
              <Text style={styles.rowValue}>{pendingRegistration.fullName}</Text>
            </View>
          ) : null}
          {pendingRegistration.employeeId ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Employee ID</Text>
              <Text style={[styles.rowValue, styles.monoValue]}>
                {pendingRegistration.employeeId}
              </Text>
            </View>
          ) : null}
          {pendingRegistration.email ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Work Email</Text>
              <Text style={styles.rowValue}>{pendingRegistration.email}</Text>
            </View>
          ) : null}
          {pendingRegistration.officeCode || pendingRegistration.officeName ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Office / Unit</Text>
              <Text style={styles.rowValue}>
                {pendingRegistration.officeCode
                  ? `${pendingRegistration.officeCode}${
                      pendingRegistration.officeName &&
                      pendingRegistration.officeName !== pendingRegistration.officeCode
                        ? ` — ${pendingRegistration.officeName}`
                        : ''
                    }`
                  : pendingRegistration.officeName}
              </Text>
            </View>
          ) : null}
          {pendingRegistration.position ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Position</Text>
              <Text style={styles.rowValue}>{pendingRegistration.position}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.actionsWrap}>
          {isApproved ? (
            <Pressable
              testID="mobile-pending-proceed-signin-btn"
              onPress={() => proceedFromPendingToLogin(true)}
              style={styles.primaryBtn}
              accessibilityRole="button"
            >
              <Text style={styles.primaryBtnText}>Proceed to Sign In</Text>
              <ArrowRight size={16} color="#FFFFFF" />
            </Pressable>
          ) : isPending ? (
            <>
              <Pressable
                testID="mobile-pending-check-status-btn"
                onPress={() => void handleManualCheck()}
                disabled={checking}
                style={[styles.primaryBtn, checking && styles.disabled]}
                accessibilityRole="button"
              >
                {checking ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <RefreshCw size={15} color="#FFFFFF" />
                )}
                <Text style={styles.primaryBtnText}>
                  {checking ? 'Checking Approval Status…' : 'Check Approval Status'}
                </Text>
              </Pressable>
              <Text style={styles.pollHint}>
                {pendingRegistration.statusToken
                  ? checkedTimeLabel
                    ? `Auto-checks every 15s · Last checked ${checkedTimeLabel}`
                    : 'Auto-checks every 15s while this screen is open.'
                  : 'Once approved by an administrator, sign in with your registered credentials.'}
              </Text>
            </>
          ) : (
            <Pressable
              testID="mobile-pending-back-login-btn"
              onPress={() => dismissPendingRegistration()}
              style={styles.primaryBtn}
              accessibilityRole="button"
            >
              <LogIn size={15} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Return to Sign In / Register</Text>
            </Pressable>
          )}

          {!isRejected ? (
            <Pressable
              testID="mobile-pending-switch-account-btn"
              onPress={() => proceedFromPendingToLogin(false)}
              style={styles.secondaryBtn}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryBtnText}>Sign in with a different account</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.securityFooter}>
          <Lock size={12} color={SDO_COLORS.textMuted} />
          <Text style={styles.securityFooterText}>Tracely</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: SDO_COLORS.bg,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 32,
    gap: 18,
    backgroundColor: SDO_COLORS.bg,
  },
  brandHeader: {
    alignItems: 'center',
    gap: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 4,
  },
  pillPending: {
    backgroundColor: SDO_COLORS.amberSoft,
    borderColor: SDO_COLORS.amberBorder,
  },
  pillApproved: {
    backgroundColor: SDO_COLORS.emeraldSoft,
    borderColor: SDO_COLORS.emeraldBorder,
  },
  pillRejected: {
    backgroundColor: SDO_COLORS.roseSoft,
    borderColor: SDO_COLORS.roseBorder,
  },
  statusPillText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '700',
  },
  pillTextPending: {
    color: SDO_COLORS.amberText,
  },
  pillTextApproved: {
    color: SDO_COLORS.emeraldText,
  },
  pillTextRejected: {
    color: SDO_COLORS.roseText,
  },
  brandTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 21,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
    textAlign: 'center',
  },
  brandSubtitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    lineHeight: 19,
    color: SDO_COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surface,
    padding: 16,
    gap: 10,
  },
  sectionLabel: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: SDO_COLORS.textMuted,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  rowLabel: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12.5,
    fontWeight: '600',
    color: SDO_COLORS.textMuted,
  },
  rowValue: {
    fontFamily: SDO_FONTS.sans,
    flex: 1,
    fontSize: 12.5,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
    textAlign: 'right',
  },
  monoValue: {
    fontFamily: SDO_FONTS.mono,
    color: SDO_COLORS.navy,
  },
  actionsWrap: {
    gap: 10,
  },
  primaryBtn: {
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.navy,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  primaryBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  pollHint: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    color: SDO_COLORS.textMuted,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.55,
  },
  securityFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 4,
  },
  securityFooterText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    color: SDO_COLORS.textMuted,
    fontWeight: '600',
  },
});
