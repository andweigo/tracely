import React, { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { AuthInputPolicy } from '../domain/authPolicy';
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!actor?.mustChangePassword) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!currentPass) {
      setErrorMsg('Enter your temporary password.');
      return;
    }
    const rules = AuthInputPolicy.evaluatePasswordRules(newPass);
    if (!rules.allSatisfied) {
      setErrorMsg('New password must be 8–32 characters with uppercase, lowercase, number, and symbol.');
      return;
    }
    if (newPass !== confirmPass) {
      setErrorMsg('Password confirmation does not match.');
      return;
    }
    try {
      await changePassword(currentPass, newPass);
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
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
          <input
            id="force-pw-current"
            type="password"
            className="input"
            value={currentPass}
            onChange={(e) => setCurrentPass(e.target.value)}
            placeholder="Enter temporary password"
            autoFocus
          />
        </div>
        <div className="field-group">
          <label className="field-label" htmlFor="force-pw-new">
            New Personal Password
          </label>
          <input
            id="force-pw-new"
            type="password"
            className="input"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            placeholder="8–32 chars with upper, lower, number, symbol"
          />
        </div>
        <div className="field-group">
          <label className="field-label" htmlFor="force-pw-confirm">
            Confirm New Password
          </label>
          <input
            id="force-pw-confirm"
            type="password"
            className="input"
            value={confirmPass}
            onChange={(e) => setConfirmPass(e.target.value)}
            placeholder="Re-enter new password"
          />
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
