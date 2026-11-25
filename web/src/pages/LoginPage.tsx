import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Clock, Eye, EyeOff, KeyRound, Lock, ShieldCheck, Smartphone } from 'lucide-react';
import { AUTH_INPUT_LIMITS, AuthInputPolicy } from '../domain/authPolicy';
import { OfficeSummary } from '../domain/types';
import { useWebApp } from '../state/WebAppContext';
import { normalizeWebErrorMessage } from '../services/webApiClient';
import { AppIconBadge } from '../components/AppIconBadge';
import { IdentityWalletCard } from '../components/IdentityWalletCard';
import { LegalPolicyModal } from '../components/LegalPolicyModal';
import { LegalDocumentType } from '../domain/legalPolicies';

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

export const LoginPage: React.FC = () => {
  const {
    offices,
    signIn,
    registerAccount,
    requestPasswordReset,
    confirmPasswordReset,
    pendingRegistration,
    prefillLoginIdentifier,
    navigate,
    requireAuth,
    isBusy,
  } = useWebApp();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [identifier, setIdentifier] = useState(prefillLoginIdentifier);

  useEffect(() => {
    if (prefillLoginIdentifier) {
      setIdentifier(prefillLoginIdentifier);
      setMode('signin');
    }
  }, [prefillLoginIdentifier]);
  const [password, setPassword] = useState('');
  const [showSignInPass, setShowSignInPass] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPass, setResetNewPass] = useState('');
  const [resetConfirmPass, setResetConfirmPass] = useState('');

  const [fullName, setFullName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [email, setEmail] = useState('');
  const [position, setPosition] = useState('');
  const [selectedOfficeCode, setSelectedOfficeCode] = useState('RECORDS');
  const [customOfficeCode, setCustomOfficeCode] = useState('');
  const [customOfficeName, setCustomOfficeName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [infoBanner, setInfoBanner] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<LegalDocumentType | null>(null);

  const availableOffices = offices.length > 0 ? offices : DEFAULT_OFFICES;
  const isCustomOffice = selectedOfficeCode === CUSTOM_OFFICE_KEY;
  const passwordRules = useMemo(
    () => AuthInputPolicy.evaluatePasswordRules(regPassword),
    [regPassword],
  );

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setInfoBanner(null);
    try {
      await signIn(identifier, password);
    } catch (err) {
      setFormError(normalizeWebErrorMessage(err, 'Unable to sign in.'));
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setInfoBanner(null);
    if (!resetIdentifier.trim()) {
      setFormError('Enter your Employee ID or Work Email.');
      return;
    }
    try {
      const res = await requestPasswordReset(resetIdentifier.trim());
      setInfoBanner(
        res.devResetCode
          ? `${res.message} (Dev code: ${res.devResetCode})`
          : res.message,
      );
      setResetStep('confirm');
    } catch (err) {
      setFormError(normalizeWebErrorMessage(err, 'Unable to request password reset.'));
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setInfoBanner(null);
    if (!resetCode.trim()) {
      setFormError('Enter the 6-character reset code.');
      return;
    }
    if (!AuthInputPolicy.evaluatePasswordRules(resetNewPass).allSatisfied) {
      setFormError('New password must be 8–32 characters with upper, lower, number, and symbol.');
      return;
    }
    if (resetNewPass !== resetConfirmPass) {
      setFormError('Password confirmation does not match.');
      return;
    }
    try {
      const msg = await confirmPasswordReset(resetIdentifier.trim(), resetCode.trim(), resetNewPass);
      setInfoBanner(msg);
      setIdentifier(resetIdentifier.trim());
      setPassword('');
      setResetCode('');
      setResetNewPass('');
      setResetConfirmPass('');
      setResetStep('request');
      setMode('signin');
    } catch (err) {
      setFormError(normalizeWebErrorMessage(err, 'Unable to reset password.'));
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setInfoBanner(null);
    if (!acceptedTerms) {
      setFormError('Please agree to the Terms and Conditions and Privacy Policy to continue.');
      return;
    }
    try {
      const outcome = await registerAccount({
        fullName,
        employeeId,
        email,
        position,
        officeCode: isCustomOffice ? customOfficeCode : selectedOfficeCode,
        isCustomOffice,
        customOfficeName,
        password: regPassword,
        confirmPassword,
      });
      if (outcome.pendingApproval) {
        setPassword('');
        setRegPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setFormError(normalizeWebErrorMessage(err, 'Unable to submit registration.'));
    }
  };

  return (
    <div className="auth-page">
      <div
        className="auth-card"
        style={mode === 'register' ? { maxWidth: 540, width: '100%' } : undefined}
      >
        {!requireAuth ? (
          <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
            <button type="button" className="btn btn-soft" onClick={() => navigate('inbox')}>
              <ArrowLeft size={15} /> Back to Workspace
            </button>
          </div>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <AppIconBadge size={60} animated interactive />
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--navy-ink)' }}>
              Tracely
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
              Document Custody & QR Tracking
            </p>
          </div>
        </div>

        <div className="segmented-control" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            className={`segment-btn ${mode === 'signin' ? 'segment-btn-active' : ''}`}
            onClick={() => {
              setMode('signin');
              setFormError(null);
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={`segment-btn ${mode === 'register' ? 'segment-btn-active' : ''}`}
            onClick={() => {
              setMode('register');
              setFormError(null);
            }}
          >
            Create Account
          </button>
        </div>

        {pendingRegistration ? (
          <button
            type="button"
            data-testid="web-login-pending-banner"
            onClick={() => navigate('pending_approval')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              width: '100%',
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid var(--amber-border)',
              background: 'var(--amber-soft)',
              color: 'var(--amber-text)',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Clock size={14} />
              {pendingRegistration.status === 'approved'
                ? 'Your registration was approved — view details'
                : 'Registration pending administrator approval'}
            </span>
            <span>View →</span>
          </button>
        ) : null}

        {infoBanner ? (
          <div className="pill pill-emerald" style={{ padding: '10px 12px', borderRadius: 12 }}>
            {infoBanner}
          </div>
        ) : null}

        {formError ? (
          <div className="pill pill-rose" style={{ padding: '10px 12px', borderRadius: 12 }}>
            {formError}
          </div>
        ) : null}

        {mode === 'signin' ? (
          <form onSubmit={(e) => void handleSignIn(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="field-group">
              <div className="field-label-row">
                <label className="field-label" htmlFor="login-id">
                  Employee ID or Work Email
                </label>
                <span className="field-hint">
                  {identifier.length}/{AUTH_INPUT_LIMITS.identifierMax}
                </span>
              </div>
              <input
                id="login-id"
                className="input"
                maxLength={AUTH_INPUT_LIMITS.identifierMax}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. EMP-2026-0001 or name@tracely.app"
              />
            </div>

            <div className="field-group">
              <div className="field-label-row">
                <label className="field-label" htmlFor="login-pass">
                  Password
                </label>
                <span className="field-hint">
                  {password.length}/{AUTH_INPUT_LIMITS.passwordMax}
                </span>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-pass"
                  type={showSignInPass ? 'text' : 'password'}
                  className="input"
                  maxLength={AUTH_INPUT_LIMITS.passwordMax}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  style={{ paddingRight: 42 }}
                />
                <button
                  type="button"
                  aria-label="Toggle password visibility"
                  onClick={() => setShowSignInPass((v) => !v)}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 0,
                    background: 'transparent',
                    color: 'var(--text-muted)',
                  }}
                >
                  {showSignInPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isBusy}
              style={{ minHeight: 46, width: '100%' }}
            >
              <Lock size={15} /> Sign In to Tracely
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="unlock-fallback-toggle"
                data-testid="web-forgot-password-btn"
                onClick={() => {
                  setResetIdentifier(identifier);
                  setResetStep('request');
                  setFormError(null);
                  setInfoBanner(null);
                  setMode('forgot');
                }}
              >
                <KeyRound size={13} /> Forgot password?
              </button>
              <button
                type="button"
                className="unlock-fallback-toggle"
                data-testid="web-public-verify-link"
                onClick={() => navigate('verify')}
              >
                <ShieldCheck size={13} /> Verify Printed QR
              </button>
            </div>
          </form>
        ) : mode === 'forgot' ? (
          resetStep === 'request' ? (
            <form
              onSubmit={(e) => void handleRequestReset(e)}
              data-testid="web-forgot-request-form"
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <div className="field-group">
                <label className="field-label" htmlFor="reset-id-input">
                  Employee ID or Work Email
                </label>
                <input
                  id="reset-id-input"
                  className="input"
                  value={resetIdentifier}
                  onChange={(e) => setResetIdentifier(e.target.value)}
                  placeholder="e.g. EMP-2026-0001 or name@tracely.app"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="btn btn-amber"
                data-testid="web-forgot-send-code-btn"
                disabled={isBusy}
                style={{ minHeight: 44, width: '100%' }}
              >
                <KeyRound size={15} /> Send Reset Code
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setMode('signin');
                  setFormError(null);
                }}
              >
                Back to Sign In
              </button>
            </form>
          ) : (
            <form
              onSubmit={(e) => void handleConfirmReset(e)}
              data-testid="web-forgot-confirm-form"
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div className="field-group">
                <label className="field-label" htmlFor="reset-code-input">
                  6-Character Reset Code
                </label>
                <input
                  id="reset-code-input"
                  className="input mono"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  placeholder="e.g. K7P-492"
                  autoFocus
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="reset-new-pass-input">
                  New Password
                </label>
                <input
                  id="reset-new-pass-input"
                  type="password"
                  className="input"
                  value={resetNewPass}
                  onChange={(e) => setResetNewPass(e.target.value)}
                  placeholder="8–32 chars with upper, lower, number, symbol"
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="reset-confirm-pass-input">
                  Confirm New Password
                </label>
                <input
                  id="reset-confirm-pass-input"
                  type="password"
                  className="input"
                  value={resetConfirmPass}
                  onChange={(e) => setResetConfirmPass(e.target.value)}
                  placeholder="Re-enter new password"
                />
              </div>
              <button
                type="submit"
                className="btn btn-amber"
                data-testid="web-forgot-confirm-btn"
                disabled={isBusy}
                style={{ minHeight: 44, width: '100%' }}
              >
                <KeyRound size={15} /> Reset Password
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setResetStep('request')}
              >
                Request a New Code
              </button>
            </form>
          )
        ) : (
          <form onSubmit={(e) => void handleRegister(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <IdentityWalletCard
              testId="web-register-live-card"
              compact
              lanyardHeight={315}
              fullName={fullName}
              employeeId={employeeId}
              position={position}
              officeCode={isCustomOffice ? customOfficeCode || 'NEW' : selectedOfficeCode}
              officeName={
                isCustomOffice
                  ? customOfficeName || 'Custom Department'
                  : availableOffices.find((o) => o.code === selectedOfficeCode)?.name
              }
              email={email}
              roleLabel="New Registration"
              actionLabel={
                isCustomOffice
                  ? customOfficeCode.trim() || 'Declare Office'
                  : selectedOfficeCode
              }
              defaultMasked={false}
            />

            <div className="field-group">
              <div className="field-label-row">
                <label className="field-label" htmlFor="reg-name">
                  Full Name
                </label>
                <span className="field-hint">
                  {fullName.length}/{AUTH_INPUT_LIMITS.fullNameMax}
                </span>
              </div>
              <input
                id="reg-name"
                className="input"
                maxLength={AUTH_INPUT_LIMITS.fullNameMax}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Juan Dela Crus"
              />
            </div>

            <div className="hardcopy-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="field-group">
                <div className="field-label-row">
                  <label className="field-label" htmlFor="reg-emp">
                    Employee ID
                  </label>
                  <span className="field-hint">
                    {employeeId.length}/{AUTH_INPUT_LIMITS.employeeIdMax}
                  </span>
                </div>
                <input
                  id="reg-emp"
                  className="input mono"
                  maxLength={AUTH_INPUT_LIMITS.employeeIdMax}
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                  placeholder="e.g. EMP-2026-0142"
                />
              </div>

              <div className="field-group">
                <div className="field-label-row">
                  <label className="field-label" htmlFor="reg-email">
                    Work Email
                  </label>
                  <span className="field-hint">
                    {email.length}/{AUTH_INPUT_LIMITS.emailMax}
                  </span>
                </div>
                <input
                  id="reg-email"
                  type="email"
                  className="input"
                  maxLength={AUTH_INPUT_LIMITS.emailMax}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. name@tracely.app"
                />
              </div>
            </div>

            <div className="field-group">
              <div className="field-label-row">
                <label className="field-label" htmlFor="reg-pos">
                  Designation / Position
                </label>
                <span className="field-hint">
                  {position.length}/{AUTH_INPUT_LIMITS.positionMax}
                </span>
              </div>
              <input
                id="reg-pos"
                className="input"
                maxLength={AUTH_INPUT_LIMITS.positionMax}
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="e.g. Administrative Officer IV"
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="reg-office-select">
                Office / Unit
              </label>
              <select
                id="reg-office-select"
                data-testid="web-register-office-select"
                className="input"
                value={selectedOfficeCode}
                onChange={(e) => setSelectedOfficeCode(e.target.value)}
                style={{ cursor: 'pointer', background: 'var(--surface)' }}
              >
                {availableOffices.map((off) => (
                  <option key={off.code} value={off.code}>
                    {off.name} ({off.code})
                  </option>
                ))}
                <option value={CUSTOM_OFFICE_KEY}>Other / Custom Office</option>
              </select>
            </div>

            {isCustomOffice ? (
              <div className="hardcopy-row" style={{ gridTemplateColumns: '140px 1fr' }}>
                <div className="field-group">
                  <div className="field-label-row">
                    <label className="field-label" htmlFor="reg-custom-code">
                      Custom Office / Unit Code
                    </label>
                    <span className="field-hint">
                      {customOfficeCode.length}/{AUTH_INPUT_LIMITS.officeCodeMax}
                    </span>
                  </div>
                  <input
                    id="reg-custom-code"
                    className="input mono"
                    maxLength={AUTH_INPUT_LIMITS.officeCodeMax}
                    value={customOfficeCode}
                    onChange={(e) => setCustomOfficeCode(e.target.value.toUpperCase())}
                    placeholder="e.g. BAC"
                  />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="reg-custom-name">
                    Custom Office / Unit Name
                  </label>
                  <input
                    id="reg-custom-name"
                    className="input"
                    maxLength={AUTH_INPUT_LIMITS.customOfficeNameMax}
                    value={customOfficeName}
                    onChange={(e) => setCustomOfficeName(e.target.value)}
                    placeholder="e.g. Bids and Awards Committee"
                  />
                </div>
              </div>
            ) : null}

            <div className="field-group">
              <div className="field-label-row">
                <label className="field-label" htmlFor="reg-pass">
                  Create Password
                </label>
                <span className="field-hint">
                  {regPassword.length}/{AUTH_INPUT_LIMITS.passwordMax}
                </span>
              </div>
              <input
                id="reg-pass"
                type="password"
                className="input"
                maxLength={AUTH_INPUT_LIMITS.passwordMax}
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>

            {regPassword.length > 0 ? (
              <div className="rule-chip-wrap">
                <span className={`rule-chip ${passwordRules.lengthValid ? 'rule-chip-ok' : ''}`}>
                  8–32 chars
                </span>
                <span
                  className={`rule-chip ${
                    passwordRules.hasUppercase && passwordRules.hasLowercase ? 'rule-chip-ok' : ''
                  }`}
                >
                  Upper & lower
                </span>
                <span className={`rule-chip ${passwordRules.hasDigit ? 'rule-chip-ok' : ''}`}>
                  Number
                </span>
                <span className={`rule-chip ${passwordRules.hasSymbol ? 'rule-chip-ok' : ''}`}>
                  Symbol
                </span>
              </div>
            ) : null}

            <div className="field-group">
              <label className="field-label" htmlFor="reg-pass-confirm">
                Confirm Password
              </label>
              <input
                id="reg-pass-confirm"
                type="password"
                className="input"
                maxLength={AUTH_INPUT_LIMITS.passwordMax}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
              />
            </div>

            <div
              className="card-soft"
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                fontSize: 12,
                lineHeight: 1.5,
                color: 'var(--text-secondary)',
              }}
            >
              <strong style={{ display: 'block', color: 'var(--navy-ink)', marginBottom: 2 }}>
                Device &amp; Service Permissions
              </strong>
              Tracely may request Browser Notifications (custody alerts), Camera access (QR
              scanning when used), and Local Storage &amp; Live Sync. You can review or adjust all
              permissions anytime in Settings.
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 9,
                fontSize: 12.5,
                lineHeight: 1.5,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                data-testid="web-register-terms-checkbox"
                checked={acceptedTerms}
                onChange={(e) => {
                  setFormError(null);
                  setAcceptedTerms(e.target.checked);
                }}
                style={{ marginTop: 3, width: 16, height: 16, accentColor: 'var(--navy)' }}
              />
              <span>
                I have read and agree to the{' '}
                <button
                  type="button"
                  data-testid="web-register-terms-link"
                  onClick={() => setLegalModalTab('terms')}
                  style={{
                    border: 'none',
                    background: 'none',
                    padding: 0,
                    color: 'var(--navy)',
                    fontWeight: 700,
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontSize: 'inherit',
                  }}
                >
                  Terms and Conditions
                </button>{' '}
                and{' '}
                <button
                  type="button"
                  data-testid="web-register-privacy-link"
                  onClick={() => setLegalModalTab('privacy')}
                  style={{
                    border: 'none',
                    background: 'none',
                    padding: 0,
                    color: 'var(--navy)',
                    fontWeight: 700,
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontSize: 'inherit',
                  }}
                >
                  Privacy Policy
                </button>
                .
              </span>
            </label>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isBusy}
              style={{ minHeight: 46, width: '100%' }}
            >
              Submit Registration
            </button>
          </form>
        )}

        <div
          style={{
            marginTop: 4,
            paddingTop: 12,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <a
            href="/download"
            className="unlock-fallback-toggle"
            style={{ textDecoration: 'none' }}
          >
            <Smartphone size={13} /> Download Tracely Android App (.apk)
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
            <button
              type="button"
              onClick={() => setLegalModalTab('terms')}
              style={{
                border: 'none',
                background: 'none',
                padding: 0,
                color: 'var(--text-secondary)',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Terms &amp; Conditions
            </button>
            <span style={{ color: 'var(--text-muted)' }}>·</span>
            <button
              type="button"
              onClick={() => setLegalModalTab('privacy')}
              style={{
                border: 'none',
                background: 'none',
                padding: 0,
                color: 'var(--text-secondary)',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Privacy Policy
            </button>
          </div>
        </div>
      </div>

      <LegalPolicyModal
        open={legalModalTab !== null}
        initialTab={legalModalTab ?? 'terms'}
        onClose={() => setLegalModalTab(null)}
      />
    </div>
  );
};
