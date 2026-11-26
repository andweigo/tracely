import React, { useMemo, useState } from 'react';
import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { AUTH_INPUT_LIMITS, AuthInputPolicy } from '../domain/authPolicy';
import { useWebApp } from '../state/WebAppContext';
import { ModalDialog } from './Modals';

/**
 * Prompts users to set a personal strong password immediately upon first sign-in
 * after an administrator resets or provisions a temporary password.
 */
export const ForcePasswordChangeModal: React.FC = () => {
  const { actor, changePassword, isBusy } = useWebApp();
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const rules = useMemo(
    () =>
      AuthInputPolicy.evaluatePasswordRules(
        newPass,
        actor ? [actor.employeeId, actor.email.split('@')[0] ?? ''] : [],
      ),
    [newPass, actor],
  );

  if (!actor?.mustChangePassword) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!currentPass) {
      setErrorMsg('Enter your temporary password.');
      return;
    }
    const passError = AuthInputPolicy.getPasswordError(
      newPass,
      'New password',
      [actor.employeeId, actor.email.split('@')[0] ?? ''],
    );
    if (passError) {
      setErrorMsg(passError);
      return;
    }
    const confirmError = AuthInputPolicy.getConfirmPasswordError(
      newPass,
      confirmPass,
      'New password',
    );
    if (confirmError) {
      setErrorMsg(confirmError);
      return;
    }
    try {
      await changePassword(currentPass, newPass);
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
      setShowCurrentPass(false);
      setShowNewPass(false);
      setShowConfirmPass(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update password.');
    }
  };

  return (
    <ModalDialog
      open
      onClose={() => {}}
      title="Password Update Required"
      subtitle="Your administrator reset your password. Choose a personal password to continue."
    >
      <form
        onSubmit={(e) => void handleSubmit(e)}
        data-testid="web-force-password-change-modal"
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <div className="field-group">
          <label className="field-label" htmlFor="force-pw-current">
            Temporary / Current Password
          </label>
          <div className="password-input-wrap">
            <input
              id="force-pw-current"
              type={showCurrentPass ? 'text' : 'password'}
              className="input"
              value={currentPass}
              onChange={(e) => setCurrentPass(e.target.value)}
              placeholder="Enter temporary password"
              autoFocus
              style={{ paddingRight: 42 }}
            />
            <button
              type="button"
              className="password-toggle-btn"
              aria-label={showCurrentPass ? 'Hide current password' : 'Show current password'}
              onClick={() => setShowCurrentPass((v) => !v)}
            >
              {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div className="field-group">
          <div className="field-label-row">
            <label className="field-label" htmlFor="force-pw-new">
              New Personal Password
            </label>
            <span className="field-hint">
              {newPass.length}/{AUTH_INPUT_LIMITS.passwordMax}
            </span>
          </div>
          <div className="password-input-wrap">
            <input
              id="force-pw-new"
              type={showNewPass ? 'text' : 'password'}
              className="input"
              maxLength={AUTH_INPUT_LIMITS.passwordMax}
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="8–32 chars with upper, lower, number, symbol"
              style={{ paddingRight: 42 }}
            />
            <button
              type="button"
              className="password-toggle-btn"
              aria-label={showNewPass ? 'Hide new password' : 'Show new password'}
              onClick={() => setShowNewPass((v) => !v)}
            >
              {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {newPass.length > 0 ? (
            <div className="rule-chip-wrap">
              <span className={`rule-chip ${rules.lengthValid ? 'rule-chip-ok' : ''}`}>
                8–32 chars
              </span>
              <span
                className={`rule-chip ${
                  rules.hasUppercase && rules.hasLowercase ? 'rule-chip-ok' : ''
                }`}
              >
                Upper & lower
              </span>
              <span className={`rule-chip ${rules.hasDigit ? 'rule-chip-ok' : ''}`}>Number</span>
              <span className={`rule-chip ${rules.hasSymbol ? 'rule-chip-ok' : ''}`}>Symbol</span>
            </div>
          ) : null}
        </div>
        <div className="field-group">
          <label className="field-label" htmlFor="force-pw-confirm">
            Confirm New Password
          </label>
          <div className="password-input-wrap">
            <input
              id="force-pw-confirm"
              type={showConfirmPass ? 'text' : 'password'}
              className="input"
              maxLength={AUTH_INPUT_LIMITS.passwordMax}
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              placeholder="Re-enter new password"
              style={{ paddingRight: 42 }}
            />
            <button
              type="button"
              className="password-toggle-btn"
              aria-label={showConfirmPass ? 'Hide confirm password' : 'Show confirm password'}
              onClick={() => setShowConfirmPass((v) => !v)}
            >
              {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        {errorMsg ? (
          <div role="alert" className="pill pill-rose" style={{ borderRadius: 10, padding: '7px 11px' }}>
            {errorMsg}
          </div>
        ) : null}
        <button
          type="submit"
          className="btn btn-amber"
          data-testid="web-force-password-submit"
          disabled={isBusy}
          style={{ width: '100%' }}
        >
          <KeyRound size={15} /> {isBusy ? 'Updating...' : 'Save New Password & Continue'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-secondary)' }}>
          <ShieldCheck size={13} color="var(--navy)" />
          <span>Your new password is encrypted and never visible to administrators.</span>
        </div>
      </form>
    </ModalDialog>
  );
};
