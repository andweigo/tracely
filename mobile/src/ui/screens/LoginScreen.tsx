import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  EyeOff,
  Lock,
  X,
} from 'lucide-react-native';
import { OfficeSummary } from '../../domain/entities/Personnel';
import { LegalDocumentType } from '../../domain/legal/LegalPolicies';
import { AUTH_INPUT_LIMITS, AuthInputPolicy } from '../../domain/security/AuthInputPolicy';
import { normalizeMobileErrorMessage } from '../../network/ApiClient';
import { useAppServices } from '../../state/AppServiceContext';
import { AppIconBadge } from '../components/AppIconBadge';
import { MobileIdentityWalletCard } from '../components/MobileIdentityWalletCard';
import { LegalPolicySheet } from '../sheets/LegalPolicySheet';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';

type AuthMode = 'signin' | 'register' | 'forgot';

const CUSTOM_OFFICE_KEY = '__CUSTOM__';

const DEFAULT_OFFICES: ReadonlyArray<OfficeSummary> = [
  { id: 'off-records', code: 'RECORDS', name: 'Records & Registry' },
  { id: 'off-osds', code: 'EXEC', name: 'Executive Office' },
  { id: 'off-cid', code: 'PROG', name: 'Program Management Office' },
  { id: 'off-sgod', code: 'OPS', name: 'Operations & Facilities Unit' },
  { id: 'off-budget', code: 'BUDGET', name: 'Budget & Finance Unit' },
  { id: 'off-acct', code: 'ACCT', name: 'Accounting Unit' },
  { id: 'off-hr', code: 'HR', name: 'Human Resources Unit' },
  { id: 'off-legal', code: 'LEGAL', name: 'Legal & Compliance Unit' },
  { id: 'off-ict', code: 'ICT', name: 'IT & Systems Unit' },
];

interface AuthFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly placeholder: string;
  readonly maxLength: number;
  readonly isPassword?: boolean;
  readonly monospace?: boolean;
  readonly errorText?: string | null;
  readonly helperText?: string | null;
  readonly keyboardType?: TextInputProps['keyboardType'];
  readonly autoCapitalize?: TextInputProps['autoCapitalize'];
}

const AuthField: React.FC<AuthFieldProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  maxLength,
  isPassword = false,
  monospace = false,
  errorText = null,
  helperText = null,
  keyboardType = 'default',
  autoCapitalize = 'none',
}) => {
  const [hidden, setHidden] = useState(isPassword);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <View style={[styles.inputRow, Boolean(errorText) && styles.inputRowError]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={SDO_COLORS.textMuted}
          maxLength={maxLength}
          secureTextEntry={isPassword && hidden}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          spellCheck={false}
          contextMenuHidden={isPassword}
          autoComplete={isPassword ? 'off' : undefined}
          importantForAutofill={isPassword ? 'no' : 'auto'}
          style={[styles.input, monospace && styles.monoInput]}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setHidden((prev) => !prev)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={hidden ? `Show ${label}` : `Hide ${label}`}
            style={styles.eyeBtn}
          >
            {hidden ? (
              <Eye size={16} color={SDO_COLORS.textMuted} />
            ) : (
              <EyeOff size={16} color={SDO_COLORS.textSecondary} />
            )}
          </Pressable>
        ) : null}
      </View>

      {errorText ? (
        <Text style={styles.fieldError}>{errorText}</Text>
      ) : helperText ? (
        <Text style={styles.fieldHelper}>{helperText}</Text>
      ) : null}
    </View>
  );
};

interface PasswordRequirementChipProps {
  readonly label: string;
  readonly satisfied: boolean;
}

const PasswordRequirementChip: React.FC<PasswordRequirementChipProps> = ({ label, satisfied }) => (
  <View style={[styles.ruleChip, satisfied && styles.ruleChipSatisfied]}>
    {satisfied ? <Check size={10} color={SDO_COLORS.emeraldText} /> : null}
    <Text style={[styles.ruleChipText, satisfied && styles.ruleChipTextSatisfied]}>{label}</Text>
  </View>
);

export const LoginScreen: React.FC = () => {
  const {
    signIn,
    registerAccount,
    requestPasswordReset,
    confirmPasswordReset,
    pendingRegistration,
    prefillLoginIdentifier,
    setActiveTab,
    isBusy,
    requireAuth,
    offices,
    goBack,
  } = useAppServices();

  const officeChoices = useMemo(
    () => (offices.length > 0 ? offices : DEFAULT_OFFICES),
    [offices],
  );

  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [legalSheetTab, setLegalSheetTab] = useState<LegalDocumentType | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [lanyardDragging, setLanyardDragging] = useState(false);
  const [identifier, setIdentifier] = useState(prefillLoginIdentifier);

  useEffect(() => {
    if (prefillLoginIdentifier) {
      setIdentifier(prefillLoginIdentifier);
      setAuthMode('signin');
    }
  }, [prefillLoginIdentifier]);
  const [password, setPassword] = useState('');

  const [fullName, setFullName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [email, setEmail] = useState('');
  const [position, setPosition] = useState('');
  const [selectedOfficeKey, setSelectedOfficeKey] = useState(
    officeChoices[0]?.code ?? 'RECORDS',
  );
  const [officeDropdownOpen, setOfficeDropdownOpen] = useState(false);
  const [customOfficeCode, setCustomOfficeCode] = useState('');
  const [customOfficeName, setCustomOfficeName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPass, setResetNewPass] = useState('');
  const [resetConfirmPass, setResetConfirmPass] = useState('');

  const isCustomOffice = selectedOfficeKey === CUSTOM_OFFICE_KEY;
  const selectedPresetOffice = isCustomOffice
    ? null
    : (officeChoices.find((item) => item.code === selectedOfficeKey) ?? officeChoices[0] ?? null);

  // Defer live ID card preview values so typing on Android Fabric never lags or duplicates IME input
  const deferredFullName = useDeferredValue(fullName);
  const deferredEmployeeId = useDeferredValue(employeeId);
  const deferredPosition = useDeferredValue(position);
  const deferredEmail = useDeferredValue(email);
  const deferredCustomCode = useDeferredValue(customOfficeCode);
  const deferredCustomName = useDeferredValue(customOfficeName);

  const passwordChecks = useMemo(() => {
    const cleanEmailLocal = email.trim().toLowerCase().split('@')[0] ?? '';
    return AuthInputPolicy.evaluatePassword(regPassword, [employeeId.trim(), cleanEmailLocal]);
  }, [regPassword, employeeId, email]);

  const confirmMismatch =
    confirmPassword.length > 0 && confirmPassword !== regPassword
      ? 'Passwords do not match.'
      : null;

  const emailInlineError = useMemo(() => {
    const clean = email.trim();
    if (!clean) return null;
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean)
      ? null
      : 'Enter a valid work email address (e.g. name@tracely.app).';
  }, [email]);

  const handleModeSwitch = (mode: AuthMode) => {
    setAuthMode(mode);
    setFormError(null);
    if (mode === 'signin') {
      setPendingNotice(null);
    }
  };

  const handleRequestReset = async () => {
    setFormError(null);
    setPendingNotice(null);
    try {
      const res = await requestPasswordReset(resetIdentifier);
      setPendingNotice(
        res.devResetCode ? `${res.message} (Dev code: ${res.devResetCode})` : res.message,
      );
      setResetStep('confirm');
    } catch (err) {
      setFormError(normalizeMobileErrorMessage(err, 'Unable to request reset code.'));
    }
  };

  const handleConfirmReset = async () => {
    setFormError(null);
    setPendingNotice(null);
    try {
      const msg = await confirmPasswordReset(
        resetIdentifier,
        resetCode,
        resetNewPass,
        resetConfirmPass,
      );
      setPendingNotice(msg);
      setIdentifier(resetIdentifier.trim());
      setPassword('');
      setResetCode('');
      setResetNewPass('');
      setResetConfirmPass('');
      setResetStep('request');
      setAuthMode('signin');
    } catch (err) {
      setFormError(normalizeMobileErrorMessage(err, 'Unable to reset password.'));
    }
  };

  const handleLogin = async () => {
    setFormError(null);
    try {
      await signIn(identifier, password);
      setPassword('');
    } catch (err) {
      setFormError(normalizeMobileErrorMessage(err, 'Unable to sign in.'));
    }
  };

  const handleRegister = async () => {
    setFormError(null);
    if (!acceptedTerms) {
      setFormError('Please agree to the Terms and Conditions and Privacy Policy to continue.');
      return;
    }
    try {
      const effectiveOfficeCode = isCustomOffice
        ? customOfficeCode.trim().toUpperCase()
        : (selectedPresetOffice?.code ?? selectedOfficeKey);

      const outcome = await registerAccount({
        fullName,
        employeeId: employeeId.trim().toUpperCase(),
        email,
        position,
        officeCode: effectiveOfficeCode,
        isCustomOffice,
        customOfficeName: isCustomOffice ? customOfficeName : undefined,
        password: regPassword,
        confirmPassword,
      });

      setRegPassword('');
      setConfirmPassword('');
      if (outcome.pendingApproval) {
        setPendingNotice(outcome.message);
        setIdentifier(email.trim().toLowerCase() || employeeId.trim().toUpperCase());
      }
    } catch (err) {
      setFormError(normalizeMobileErrorMessage(err, 'Unable to submit registration.'));
    }
  };

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
        scrollEnabled={!lanyardDragging}
      >
        {!requireAuth ? (
          <View style={styles.topRow}>
            <Pressable
              onPress={() => goBack()}
              accessibilityRole="button"
              style={styles.backPill}
            >
              <ArrowLeft size={15} color={SDO_COLORS.navy} />
              <Text style={styles.backPillText}>Back</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.brandHeader}>
          <AppIconBadge size={56} animated={false} interactive={false} />
          <View style={styles.brandCopy}>
            <Text style={styles.brandTitle}>Tracely</Text>
            <Text style={styles.brandSubtitle}>Document Tracking</Text>
          </View>
        </View>

        {pendingRegistration ? (
          <Pressable
            testID="mobile-login-pending-banner"
            onPress={() => setActiveTab('pending_approval')}
            style={styles.pendingBanner}
          >
            <View style={styles.pendingBannerLeft}>
              <Clock size={14} color={SDO_COLORS.amberText} />
              <Text style={styles.pendingBannerText}>
                {pendingRegistration.status === 'approved'
                  ? 'Registration approved — view details'
                  : 'Registration pending administrator approval'}
              </Text>
            </View>
            <Text style={styles.pendingBannerAction}>View →</Text>
          </Pressable>
        ) : null}

        <View style={styles.segmentWrap}>
          <Pressable
            onPress={() => handleModeSwitch('signin')}
            accessibilityRole="tab"
            accessibilityState={{ selected: authMode === 'signin' }}
            style={[styles.segmentBtn, authMode === 'signin' && styles.segmentBtnActive]}
          >
            <Text style={[styles.segmentText, authMode === 'signin' && styles.segmentTextActive]}>
              Sign In
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleModeSwitch('register')}
            accessibilityRole="tab"
            accessibilityState={{ selected: authMode === 'register' }}
            style={[styles.segmentBtn, authMode === 'register' && styles.segmentBtnActive]}
          >
            <Text
              style={[styles.segmentText, authMode === 'register' && styles.segmentTextActive]}
            >
              Create Account
            </Text>
          </Pressable>
        </View>

        {authMode === 'signin' ? (
          <View style={styles.card}>
            <Text style={styles.cardLead}>
              Sign in with your Employee ID or work email.
            </Text>

            {formError ? (
              <View style={styles.errorBanner}>
                <AlertCircle size={15} color={SDO_COLORS.roseText} />
                <Text style={styles.errorBannerText}>{formError}</Text>
              </View>
            ) : null}

            <AuthField
              label="Employee ID or Work Email"
              value={identifier}
              onChangeText={(text) => {
                setFormError(null);
                setIdentifier(text);
              }}
              placeholder="e.g. EMP-2026-0001 or name@tracely.app"
              maxLength={AUTH_INPUT_LIMITS.identifierMax}
              keyboardType="email-address"
            />

            <AuthField
              label="Password"
              value={password}
              onChangeText={(text) => {
                setFormError(null);
                setPassword(text);
              }}
              placeholder="Enter password"
              maxLength={AUTH_INPUT_LIMITS.passwordMax}
              isPassword
            />

            <Pressable
              onPress={handleLogin}
              disabled={isBusy || !identifier.trim() || !password}
              accessibilityRole="button"
              style={[
                styles.primaryBtn,
                (isBusy || !identifier.trim() || !password) && styles.disabled,
              ]}
            >
              {isBusy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Sign In</Text>
              )}
            </Pressable>

            <Pressable
              testID="mobile-forgot-password-btn"
              onPress={() => {
                setResetIdentifier(identifier);
                setResetStep('request');
                setFormError(null);
                setPendingNotice(null);
                setAuthMode('forgot');
              }}
              style={styles.switchPrompt}
            >
              <Text style={styles.switchPromptLink}>Forgot password?</Text>
            </Pressable>

            <Pressable
              onPress={() => handleModeSwitch('register')}
              style={styles.switchPrompt}
            >
              <Text style={styles.switchPromptText}>
                Need access? <Text style={styles.switchPromptLink}>Create an account</Text>
              </Text>
            </Pressable>
          </View>
        ) : authMode === 'forgot' ? (
          <View style={styles.card}>
            <Text style={styles.cardLead}>
              {resetStep === 'request'
                ? 'Request a 15-minute reset code for your Tracely account.'
                : 'Enter your 6-character reset code and choose a new strong password.'}
            </Text>

            {pendingNotice ? (
              <View style={styles.noticeCard}>
                <Text style={styles.noticeBody}>{pendingNotice}</Text>
              </View>
            ) : null}

            {formError ? (
              <View style={styles.errorBanner}>
                <AlertCircle size={15} color={SDO_COLORS.roseText} />
                <Text style={styles.errorBannerText}>{formError}</Text>
              </View>
            ) : null}

            {resetStep === 'request' ? (
              <>
                <AuthField
                  label="Employee ID or Work Email"
                  value={resetIdentifier}
                  onChangeText={setResetIdentifier}
                  placeholder="e.g. EMP-2026-0001 or name@tracely.app"
                  maxLength={AUTH_INPUT_LIMITS.identifierMax}
                  keyboardType="email-address"
                />
                <Pressable
                  testID="mobile-forgot-send-code-btn"
                  onPress={handleRequestReset}
                  disabled={isBusy || !resetIdentifier.trim()}
                  style={[
                    styles.primaryBtn,
                    (isBusy || !resetIdentifier.trim()) && styles.disabled,
                  ]}
                >
                  <Text style={styles.primaryBtnText}>Send Reset Code</Text>
                </Pressable>
              </>
            ) : (
              <>
                <AuthField
                  label="6-Character Reset Code"
                  value={resetCode}
                  onChangeText={setResetCode}
                  placeholder="e.g. K7P-492"
                  maxLength={16}
                  monospace
                />
                <AuthField
                  label="New Password"
                  value={resetNewPass}
                  onChangeText={setResetNewPass}
                  placeholder="8–32 chars strong password"
                  maxLength={AUTH_INPUT_LIMITS.passwordMax}
                  isPassword
                />
                <AuthField
                  label="Confirm New Password"
                  value={resetConfirmPass}
                  onChangeText={setResetConfirmPass}
                  placeholder="Re-enter new password"
                  maxLength={AUTH_INPUT_LIMITS.passwordMax}
                  isPassword
                />
                <Pressable
                  testID="mobile-forgot-confirm-btn"
                  onPress={handleConfirmReset}
                  disabled={isBusy || !resetCode.trim() || !resetNewPass}
                  style={[
                    styles.primaryBtn,
                    (isBusy || !resetCode.trim() || !resetNewPass) && styles.disabled,
                  ]}
                >
                  <Text style={styles.primaryBtnText}>Reset Password</Text>
                </Pressable>
              </>
            )}

            <Pressable
              onPress={() => handleModeSwitch('signin')}
              style={styles.switchPrompt}
            >
              <Text style={styles.switchPromptLink}>Back to Sign In</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <MobileIdentityWalletCard
              testID="mobile-register-live-card"
              compact
              onDragChange={setLanyardDragging}
              fullName={deferredFullName}
              employeeId={deferredEmployeeId.toUpperCase()}
              position={deferredPosition}
              officeCode={isCustomOffice ? deferredCustomCode.toUpperCase() || 'NEW' : selectedOfficeKey}
              officeName={
                isCustomOffice
                  ? deferredCustomName || 'Custom Department'
                  : selectedPresetOffice?.name
              }
              email={deferredEmail}
              roleLabel="New Registration"
              actionLabel={
                isCustomOffice
                  ? deferredCustomCode.trim().toUpperCase() || 'Declare Office'
                  : selectedOfficeKey
              }
              defaultMasked={false}
            />

            <Text style={styles.cardLead}>
              Create your Tracely account for verified QR document tracking.
            </Text>

            {pendingNotice ? (
              <View style={styles.noticeCard}>
                <View style={styles.noticeTitleRow}>
                  <CheckCircle2 size={16} color={SDO_COLORS.navy} />
                  <Text style={styles.noticeTitle}>Registration Submitted</Text>
                </View>
                <Text style={styles.noticeBody}>{pendingNotice}</Text>
                <Pressable
                  onPress={() => handleModeSwitch('signin')}
                  style={styles.noticeLinkBtn}
                >
                  <Text style={styles.noticeLinkText}>Return to Sign In</Text>
                </Pressable>
              </View>
            ) : null}

            {formError ? (
              <View style={styles.errorBanner}>
                <AlertCircle size={15} color={SDO_COLORS.roseText} />
                <Text style={styles.errorBannerText}>{formError}</Text>
              </View>
            ) : null}

            <AuthField
              label="Full Name"
              value={fullName}
              onChangeText={(text) => {
                setFormError(null);
                setFullName(text);
              }}
              placeholder="e.g. Juan Dela Crus"
              maxLength={AUTH_INPUT_LIMITS.fullNameMax}
              autoCapitalize="words"
            />

            <AuthField
              label="Employee ID"
              value={employeeId}
              onChangeText={(text) => {
                setFormError(null);
                setEmployeeId(text);
              }}
              placeholder="e.g. EMP-2026-0142"
              maxLength={AUTH_INPUT_LIMITS.employeeIdMax}
              autoCapitalize="characters"
              monospace
            />

            <AuthField
              label="Work Email"
              value={email}
              onChangeText={(text) => {
                setFormError(null);
                setEmail(text);
              }}
              placeholder="e.g. name@tracely.app"
              maxLength={AUTH_INPUT_LIMITS.emailMax}
              keyboardType="email-address"
              errorText={emailInlineError}
            />

            <AuthField
              label="Position / Designation"
              value={position}
              onChangeText={(text) => {
                setFormError(null);
                setPosition(text);
              }}
              placeholder="e.g. Administrative Officer IV"
              maxLength={AUTH_INPUT_LIMITS.positionMax}
              autoCapitalize="words"
            />

            <View style={styles.field}>
              <Text style={styles.label}>Office / Unit</Text>
              <Pressable
                testID="mobile-register-office-dropdown"
                onPress={() => setOfficeDropdownOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Select Office or Unit"
                style={styles.dropdownTrigger}
              >
                <Text numberOfLines={1} style={styles.dropdownTriggerText}>
                  {isCustomOffice
                    ? 'Other / Custom Office'
                    : selectedPresetOffice
                      ? `${selectedPresetOffice.name} (${selectedPresetOffice.code})`
                      : 'Select office'}
                </Text>
                <ChevronDown size={17} color={SDO_COLORS.textSecondary} />
              </Pressable>

              <Modal
                visible={officeDropdownOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setOfficeDropdownOpen(false)}
              >
                <Pressable
                  style={styles.dropdownBackdrop}
                  onPress={() => setOfficeDropdownOpen(false)}
                >
                  <Pressable
                    style={styles.dropdownSheet}
                    onPress={() => {
                      // Prevent backdrop dismiss when interacting inside modal
                    }}
                  >
                    <View style={styles.dropdownHeader}>
                      <Text style={styles.dropdownTitle}>Select Office / Unit</Text>
                      <Pressable
                        onPress={() => setOfficeDropdownOpen(false)}
                        accessibilityLabel="Close office picker"
                        style={styles.dropdownCloseBtn}
                      >
                        <X size={16} color={SDO_COLORS.textSecondary} />
                      </Pressable>
                    </View>
                    <ScrollView style={styles.dropdownList}>
                      {officeChoices.map((office) => {
                        const selected =
                          !isCustomOffice && office.code === selectedPresetOffice?.code;
                        return (
                          <Pressable
                            key={office.id}
                            testID={`mobile-office-option-${office.code}`}
                            onPress={() => {
                              setFormError(null);
                              setSelectedOfficeKey(office.code);
                              setOfficeDropdownOpen(false);
                            }}
                            style={[
                              styles.dropdownOption,
                              selected && styles.dropdownOptionActive,
                            ]}
                          >
                            <View style={styles.dropdownOptionCopy}>
                              <Text
                                style={[
                                  styles.dropdownOptionName,
                                  selected && styles.dropdownOptionNameActive,
                                ]}
                              >
                                {office.name}
                              </Text>
                              <Text style={styles.dropdownOptionCode}>{office.code}</Text>
                            </View>
                            {selected ? <Check size={16} color={SDO_COLORS.navy} /> : null}
                          </Pressable>
                        );
                      })}
                      <Pressable
                        testID="mobile-office-option-custom"
                        onPress={() => {
                          setFormError(null);
                          setSelectedOfficeKey(CUSTOM_OFFICE_KEY);
                          setOfficeDropdownOpen(false);
                        }}
                        style={[
                          styles.dropdownOption,
                          isCustomOffice && styles.dropdownOptionActive,
                        ]}
                      >
                        <View style={styles.dropdownOptionCopy}>
                          <Text
                            style={[
                              styles.dropdownOptionName,
                              isCustomOffice && styles.dropdownOptionNameActive,
                            ]}
                          >
                            Other / Custom Office
                          </Text>
                          <Text style={styles.dropdownOptionCode}>Enter custom unit details</Text>
                        </View>
                        {isCustomOffice ? <Check size={16} color={SDO_COLORS.navy} /> : null}
                      </Pressable>
                    </ScrollView>
                  </Pressable>
                </Pressable>
              </Modal>

              {isCustomOffice ? (
                <View style={styles.customOfficeBox}>
                  <AuthField
                    label="Custom Office / Unit Code"
                    value={customOfficeCode}
                    onChangeText={(text) => {
                      setFormError(null);
                      setCustomOfficeCode(text);
                    }}
                    placeholder="e.g. SUPPLY"
                    maxLength={AUTH_INPUT_LIMITS.officeCodeMax}
                    autoCapitalize="characters"
                    monospace
                  />
                  <AuthField
                    label="Custom Office / Unit Name"
                    value={customOfficeName}
                    onChangeText={(text) => {
                      setFormError(null);
                      setCustomOfficeName(text);
                    }}
                    placeholder="e.g. Supply and Property Unit"
                    maxLength={AUTH_INPUT_LIMITS.customOfficeNameMax}
                    autoCapitalize="words"
                  />
                </View>
              ) : null}
            </View>

            <View style={styles.passwordGroup}>
              <AuthField
                label="Password"
                value={regPassword}
                onChangeText={(text) => {
                  setFormError(null);
                  setRegPassword(text);
                }}
                placeholder={`At least ${AUTH_INPUT_LIMITS.passwordMin} characters`}
                maxLength={AUTH_INPUT_LIMITS.passwordMax}
                isPassword
                errorText={
                  regPassword.length > 0 && !passwordChecks.noWeakPattern
                    ? 'Avoid common words or your Employee ID/email.'
                    : null
                }
              />

              {regPassword.length > 0 ? (
                <View style={styles.ruleGrid}>
                  <PasswordRequirementChip
                    label={`${AUTH_INPUT_LIMITS.passwordMin}–${AUTH_INPUT_LIMITS.passwordMax} chars`}
                    satisfied={passwordChecks.lengthValid}
                  />
                  <PasswordRequirementChip
                    label="Upper & lower"
                    satisfied={passwordChecks.hasUppercase && passwordChecks.hasLowercase}
                  />
                  <PasswordRequirementChip label="Number" satisfied={passwordChecks.hasDigit} />
                  <PasswordRequirementChip
                    label="Symbol (!@#)"
                    satisfied={passwordChecks.hasSymbol}
                  />
                </View>
              ) : null}
            </View>

            <AuthField
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={(text) => {
                setFormError(null);
                setConfirmPassword(text);
              }}
              placeholder="Re-enter password"
              maxLength={AUTH_INPUT_LIMITS.passwordMax}
              isPassword
              errorText={confirmMismatch}
            />

            <Text style={styles.permissionsNoteBody}>
              Permissions for camera, notifications, and sync can be managed anytime in Settings.
            </Text>

            <View style={styles.consentRow}>
              <Pressable
                testID="mobile-register-terms-checkbox"
                onPress={() => {
                  setFormError(null);
                  setAcceptedTerms((prev) => !prev);
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acceptedTerms }}
                accessibilityLabel="Agree to Terms and Conditions and Privacy Policy"
                style={[styles.checkboxBox, acceptedTerms && styles.checkboxBoxChecked]}
              >
                {acceptedTerms ? <Check size={13} color="#FFFFFF" strokeWidth={3} /> : null}
              </Pressable>
              <Text style={styles.consentText}>
                I have read and agree to the{' '}
                <Text
                  testID="mobile-register-terms-link"
                  style={styles.consentLink}
                  onPress={() => setLegalSheetTab('terms')}
                >
                  Terms and Conditions
                </Text>{' '}
                and{' '}
                <Text
                  testID="mobile-register-privacy-link"
                  style={styles.consentLink}
                  onPress={() => setLegalSheetTab('privacy')}
                >
                  Privacy Policy
                </Text>
                .
              </Text>
            </View>

            <Pressable
              onPress={handleRegister}
              disabled={isBusy}
              accessibilityRole="button"
              style={[styles.primaryBtn, isBusy && styles.disabled]}
            >
              {isBusy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Submit Registration</Text>
              )}
            </Pressable>

            <Text style={styles.approvalNote}>
              New accounts require administrator approval before sign-in.
            </Text>
          </View>
        )}

        <View style={styles.legalLinksRow}>
          <Pressable
            onPress={() => setLegalSheetTab('terms')}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={styles.legalFooterLink}>Terms &amp; Conditions</Text>
          </Pressable>
          <Text style={styles.legalDot}>·</Text>
          <Pressable
            onPress={() => setLegalSheetTab('privacy')}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={styles.legalFooterLink}>Privacy Policy</Text>
          </Pressable>
        </View>

        <View style={styles.securityFooter}>
          <Lock size={12} color={SDO_COLORS.textMuted} />
          <Text style={styles.securityFooterText}>Tracely</Text>
        </View>
      </ScrollView>

      <LegalPolicySheet
        open={legalSheetTab !== null}
        initialTab={legalSheetTab ?? 'terms'}
        onClose={() => setLegalSheetTab(null)}
      />
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
    paddingTop: 14,
    paddingBottom: 28,
    gap: 18,
    backgroundColor: SDO_COLORS.bg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surfaceSoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  backPillText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  permissionsNoteBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surfaceSoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
  },
  permissionsNoteTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  permissionsNoteBody: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    lineHeight: 16,
    color: SDO_COLORS.textSecondary,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 2,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxBoxChecked: {
    backgroundColor: SDO_COLORS.navy,
    borderColor: SDO_COLORS.navy,
  },
  consentText: {
    flex: 1,
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    lineHeight: 18,
    color: SDO_COLORS.textSecondary,
  },
  consentLink: {
    fontFamily: SDO_FONTS.sans,
    fontWeight: '700',
    color: SDO_COLORS.navy,
    textDecorationLine: 'underline',
  },
  legalLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  legalFooterLink: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  legalDot: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    color: SDO_COLORS.textMuted,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SDO_COLORS.amberBorder,
    backgroundColor: SDO_COLORS.amberSoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pendingBannerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingBannerText: {
    fontFamily: SDO_FONTS.sans,
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.amberText,
  },
  pendingBannerAction: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '800',
    color: SDO_COLORS.amberText,
  },
  brandHeader: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 6,
  },
  brandCopy: {
    alignItems: 'center',
    gap: 3,
  },
  brandTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: SDO_COLORS.textPrimary,
  },
  brandSubtitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    color: SDO_COLORS.textMuted,
  },
  segmentWrap: {
    flexDirection: 'row',
    borderRadius: 14,
    backgroundColor: SDO_COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: SDO_COLORS.surface,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '600',
    color: SDO_COLORS.textMuted,
  },
  segmentTextActive: {
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surface,
    padding: 18,
    gap: 14,
  },
  cardLead: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    lineHeight: 18,
    color: SDO_COLORS.textSecondary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SDO_COLORS.roseBorder,
    backgroundColor: SDO_COLORS.roseSoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorBannerText: {
    fontFamily: SDO_FONTS.sans,
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: SDO_COLORS.roseText,
  },
  field: {
    gap: 5,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '600',
    color: SDO_COLORS.textPrimary,
  },
  charCount: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    color: SDO_COLORS.textMuted,
  },
  charCountWarn: {
    color: SDO_COLORS.amberText,
    fontWeight: '600',
  },
  charCountMax: {
    color: SDO_COLORS.rose,
    fontWeight: '700',
  },
  inputRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surfaceMuted,
    paddingLeft: 14,
    paddingRight: 10,
  },
  inputRowError: {
    borderColor: SDO_COLORS.rose,
  },
  input: {
    fontFamily: SDO_FONTS.sans,
    flex: 1,
    fontSize: 14,
    color: SDO_COLORS.textPrimary,
    paddingVertical: 10,
  },
  monoInput: {
    fontFamily: SDO_FONTS.mono,
    fontSize: 13,
  },
  eyeBtn: {
    padding: 6,
  },
  fieldHelper: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    color: SDO_COLORS.textMuted,
  },
  fieldError: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '600',
    color: SDO_COLORS.rose,
  },
  officeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  officeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surfaceMuted,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  officeChipActive: {
    borderColor: SDO_COLORS.navy,
    backgroundColor: SDO_COLORS.navy,
  },
  officeChipText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  officeChipTextActive: {
    color: '#FFFFFF',
  },
  officeHint: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    color: SDO_COLORS.textMuted,
  },
  customOfficeBox: {
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 12,
    gap: 10,
  },
  passwordGroup: {
    gap: 8,
  },
  ruleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  ruleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surfaceMuted,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  ruleChipSatisfied: {
    borderColor: SDO_COLORS.emeraldBorder,
    backgroundColor: SDO_COLORS.emeraldSoft,
  },
  ruleChipText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '600',
    color: SDO_COLORS.textMuted,
  },
  ruleChipTextSatisfied: {
    color: SDO_COLORS.emeraldText,
  },
  primaryBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: SDO_COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  disabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  switchPrompt: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  switchPromptText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    color: SDO_COLORS.textMuted,
  },
  switchPromptLink: {
    fontFamily: SDO_FONTS.sans,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  noticeCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SDO_COLORS.skyBorder,
    backgroundColor: SDO_COLORS.skySoft,
    padding: 12,
    gap: 6,
  },
  noticeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noticeTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  noticeBody: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    lineHeight: 17,
    color: SDO_COLORS.textSecondary,
  },
  noticeLinkBtn: {
    alignSelf: 'flex-start',
    paddingTop: 2,
  },
  noticeLinkText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  approvalNote: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    color: SDO_COLORS.textMuted,
  },
  securityFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 6,
  },
  securityFooterText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    color: SDO_COLORS.textMuted,
  },
  dropdownTrigger: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surfaceSoft,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dropdownTriggerText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13.5,
    fontWeight: '600',
    color: SDO_COLORS.textPrimary,
    flex: 1,
  },
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  dropdownSheet: {
    borderRadius: 18,
    backgroundColor: SDO_COLORS.surface,
    maxHeight: '72%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: SDO_COLORS.border,
  },
  dropdownTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 15,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  dropdownCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: SDO_COLORS.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownList: {
    padding: 8,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
  },
  dropdownOptionActive: {
    backgroundColor: SDO_COLORS.skySoft,
  },
  dropdownOptionCopy: {
    flex: 1,
    gap: 1,
  },
  dropdownOptionName: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13.5,
    fontWeight: '600',
    color: SDO_COLORS.textPrimary,
  },
  dropdownOptionNameActive: {
    fontWeight: '800',
    color: SDO_COLORS.navy,
  },
  dropdownOptionCode: {
    fontFamily: SDO_FONTS.mono,
    fontSize: 11,
    color: SDO_COLORS.textSecondary,
  },
});
