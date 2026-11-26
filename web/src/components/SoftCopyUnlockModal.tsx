import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Keyboard,
  KeyRound,
  RefreshCw,
  Smartphone,
} from 'lucide-react';
import { DocumentUnlockChallenge } from '../domain/types';
import { useWebApp } from '../state/WebAppContext';
import { isPendingReceiptForActor } from '../utils/sentFilter';
import { ModalDialog } from './Modals';
import { QrCodeGraphic } from './QrCodeGraphic';

function formatCountdown(expiresAt: string, nowMs: number): string {
  const diffSec = Math.max(0, Math.floor((new Date(expiresAt).getTime() - nowMs) / 1000));
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * Live Desktop -> Mobile Soft Copy Unlock QR Modal.
 * Displays a persistent 5-minute Unlock QR & 6-char code that stays active across
 * modal close/reopen until its timer expires, with an attached auto-focused Code
 * Input directly on the QR modal (for users with no mobile available) plus an
 * account-password fallback.
 */
export const SoftCopyUnlockModal: React.FC = () => {
  const {
    actor,
    documents,
    softCopyUnlockDocId,
    closeSoftCopyUnlock,
    createUnlockChallenge,
    unlockWithCode,
    unlockWithPassword,
    subscribeInstantSync,
    openDocument,
    notify,
    isBusy,
  } = useWebApp();

  const doc = useMemo(
    () => (softCopyUnlockDocId ? documents.find((d) => d.id === softCopyUnlockDocId) ?? null : null),
    [documents, softCopyUnlockDocId],
  );

  const [challenge, setChallenge] = useState<DocumentUnlockChallenge | null>(null);
  const [loadingChallenge, setLoadingChallenge] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [submittingCode, setSubmittingCode] = useState(false);
  const [qrPulseHighlight, setQrPulseHighlight] = useState(false);
  const [showPasswordFallback, setShowPasswordFallback] = useState(false);
  const [password, setPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submittingPassword, setSubmittingPassword] = useState(false);

  const codeInputRef = useRef<HTMLInputElement | null>(null);

  const focusCodeInput = useCallback(() => {
    setShowPasswordFallback(false);
    setQrPulseHighlight(true);
    window.setTimeout(() => {
      codeInputRef.current?.focus();
      codeInputRef.current?.select?.();
    }, 0);
    window.setTimeout(() => setQrPulseHighlight(false), 700);
  }, []);

  const loadChallenge = useCallback(
    async (documentId: string) => {
      setLoadingChallenge(true);
      setChallengeError(null);
      try {
        const created = await createUnlockChallenge(documentId);
        setChallenge(created);
        setNowMs(Date.now());
      } catch (err) {
        setChallenge(null);
        setChallengeError(
          err instanceof Error ? err.message : 'Unable to generate unlock QR right now.',
        );
      } finally {
        setLoadingChallenge(false);
      }
    },
    [createUnlockChallenge],
  );

  // Load (or reuse active unexpired) challenge whenever opened for a document
  useEffect(() => {
    if (!softCopyUnlockDocId) {
      setChallenge(null);
      setChallengeError(null);
      setCodeInput('');
      setCodeError(null);
      setSubmittingCode(false);
      setShowPasswordFallback(false);
      setPassword('');
      setPasswordError(null);
      return;
    }
    void loadChallenge(softCopyUnlockDocId);
  }, [softCopyUnlockDocId, loadChallenge]);

  // Auto-focus attached code input once the QR modal is ready so web users without mobile can type immediately
  useEffect(() => {
    if (!softCopyUnlockDocId || loadingChallenge || showPasswordFallback) return;
    const timer = window.setTimeout(() => {
      codeInputRef.current?.focus();
    }, 40);
    return () => window.clearTimeout(timer);
  }, [softCopyUnlockDocId, loadingChallenge, showPasswordFallback]);

  // Countdown tick every second while challenge is visible
  useEffect(() => {
    if (!softCopyUnlockDocId || !challenge) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [softCopyUnlockDocId, challenge]);

  // Auto-detect when Tracely Mobile unlocks this document via Realtime / live sync
  const isStillSealed = Boolean(
    doc && (isPendingReceiptForActor(doc, actor) || Boolean(doc.isSealed)),
  );

  useEffect(() => {
    if (!softCopyUnlockDocId || !doc) return;
    if (!isStillSealed) {
      const unlockedId = doc.id;
      closeSoftCopyUnlock();
      notify('success', 'Soft Copy unlocked & synced across your devices.');
      openDocument(unlockedId);
    }
  }, [softCopyUnlockDocId, doc, isStillSealed, closeSoftCopyUnlock, notify, openDocument]);

  // Instant SSE stream (with automatic fallback poll) while waiting on Tracely Mobile
  useEffect(() => {
    if (!softCopyUnlockDocId || !challenge || showPasswordFallback) return;
    return subscribeInstantSync();
  }, [softCopyUnlockDocId, challenge, showPasswordFallback, subscribeInstantSync]);

  if (!softCopyUnlockDocId || !doc) return null;

  const latest = doc.transactions[doc.transactions.length - 1] ?? null;
  const fromOffice = latest?.fromOffice ?? doc.originOffice;
  const fromUser = latest?.fromUserName ?? doc.originUserName;
  const isExpired = Boolean(challenge && new Date(challenge.expiresAt).getTime() <= nowMs);

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = codeInput.trim();
    if (!clean) {
      setCodeError('Enter the 6-character unlock code or tracking code.');
      return;
    }
    if (
      isExpired &&
      challenge &&
      clean.replace(/[^A-Z0-9]/gi, '').toUpperCase() ===
        challenge.shortCode.replace(/[^A-Z0-9]/gi, '').toUpperCase()
    ) {
      setCodeError('This unlock code has expired. Click Generate New Code to get a fresh one.');
      return;
    }
    setCodeError(null);
    setSubmittingCode(true);
    try {
      const unlocked = await unlockWithCode(doc.id, clean);
      setCodeInput('');
      closeSoftCopyUnlock();
      openDocument(unlocked.id);
    } catch (err) {
      setCodeError(
        err instanceof Error
          ? err.message
          : 'Invalid or expired unlock code. Please check the active code and try again.',
      );
    } finally {
      setSubmittingCode(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = password.trim();
    if (!clean) {
      setPasswordError('Enter your Tracely account password.');
      return;
    }
    setPasswordError(null);
    setSubmittingPassword(true);
    try {
      const unlocked = await unlockWithPassword(doc.id, clean);
      setPassword('');
      closeSoftCopyUnlock();
      openDocument(unlocked.id);
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : 'Incorrect account password. Please try again.',
      );
    } finally {
      setSubmittingPassword(false);
    }
  };

  return (
    <ModalDialog
      open={Boolean(softCopyUnlockDocId)}
      onClose={closeSoftCopyUnlock}
      title="Scan QR or Enter Unlock Code"
      subtitle={`Soft Copy from ${fromOffice.code}${fromUser ? ` · ${fromUser}` : ''}`}
    >
      <div className="unlock-qr-stage" data-testid="web-soft-copy-unlock-modal">
        {loadingChallenge ? (
          <div className="unlock-qr-placeholder">Loading active Unlock QR...</div>
        ) : challengeError ? (
          <div className="unlock-qr-error">
            <span>{challengeError}</span>
            <button
              type="button"
              className="btn btn-soft"
              style={{ minHeight: 32, padding: '4px 12px', fontSize: 12 }}
              onClick={() => void loadChallenge(doc.id)}
            >
              <RefreshCw size={13} /> Try Again
            </button>
          </div>
        ) : challenge ? (
          <>
            <button
              type="button"
              className={`unlock-qr-frame unlock-qr-frame-btn ${isExpired ? 'unlock-qr-frame-expired' : ''}`}
              data-testid="web-unlock-qr-clickable"
              aria-label="Click QR code to enter unlock code on web"
              title="No mobile available? Click QR to enter the unlock code below"
              onClick={focusCodeInput}
            >
              <QrCodeGraphic value={challenge.qrPayload} size={172} />
            </button>

            <div className="unlock-short-code-box">
              <span className="unlock-short-code-label">
                {isExpired
                  ? 'Unlock code expired'
                  : 'Active Unlock Code (stays active until timer ends)'}
              </span>
              <span className="mono unlock-short-code-val" data-testid="web-unlock-short-code">
                {challenge.shortCode}
              </span>
              <span className="unlock-duration-pill" data-testid="web-unlock-duration">
                <Clock size={12} />
                {isExpired
                  ? 'Expired'
                  : `Valid for ${formatCountdown(challenge.expiresAt, nowMs)}`}
              </span>
            </div>

            <div className="unlock-live-row">
              <span className="unlock-live-status">
                <Smartphone size={14} />
                {isExpired
                  ? 'Code expired — generate a new 5-minute code'
                  : `Waiting for Tracely Mobile · ${formatCountdown(challenge.expiresAt, nowMs)}`}
              </span>
              {isExpired ? (
                <button
                  type="button"
                  className="btn btn-amber"
                  data-testid="web-unlock-regenerate-btn"
                  style={{ minHeight: 30, padding: '4px 10px', fontSize: 11.5 }}
                  onClick={() => void loadChallenge(doc.id)}
                >
                  <RefreshCw size={12} /> New Code
                </button>
              ) : null}
            </div>
          </>
        ) : null}

        <form
          onSubmit={(e) => void handleCodeSubmit(e)}
          className={`unlock-code-attach-form ${qrPulseHighlight ? 'unlock-code-attach-highlight' : ''}`}
          data-testid="web-unlock-code-form"
        >
          <label className="field-label" htmlFor="web-unlock-code-input">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Keyboard size={13} /> No mobile available? Enter code here to unlock
            </span>
          </label>
          <div className="unlock-code-inline-row">
            <input
              ref={codeInputRef}
              id="web-unlock-code-input"
              data-testid="web-unlock-code-input"
              aria-label="Unlock Code"
              className={`input mono ${codeError ? 'input-error' : ''}`}
              autoFocus
              value={codeInput}
              onChange={(e) => {
                setCodeInput(e.target.value);
                if (codeError) setCodeError(null);
              }}
              placeholder={
                challenge ? `Type ${challenge.shortCode} or Tracking Code` : 'Enter 6-char code (e.g. K7P-492)'
              }
            />
            <button
              type="submit"
              className="btn btn-amber"
              data-testid="web-unlock-code-submit"
              disabled={!codeInput.trim() || submittingCode || isBusy}
              style={{ flexShrink: 0, minHeight: 40, padding: '0 14px' }}
            >
              <CheckCircle2 size={14} />
              <span>{submittingCode ? 'Unlocking...' : 'Unlock'}</span>
            </button>
          </div>
          {codeError ? (
            <div
              role="alert"
              data-testid="web-unlock-code-error"
              className="pill pill-rose"
              style={{ borderRadius: 10, padding: '6px 10px' }}
            >
              {codeError}
            </div>
          ) : null}
        </form>

        <div className="unlock-fallback-wrap">
          {!showPasswordFallback ? (
            <button
              type="button"
              className="unlock-fallback-toggle"
              data-testid="web-unlock-password-toggle"
              onClick={() => {
                setShowPasswordFallback(true);
                setPasswordError(null);
              }}
            >
              <KeyRound size={13} />
              <span>No phone nearby? Unlock with Password</span>
            </button>
          ) : (
            <form
              onSubmit={(e) => void handlePasswordSubmit(e)}
              className="unlock-fallback-form"
              data-testid="web-unlock-password-form"
            >
              <div className="unlock-fallback-head">
                <span className="unlock-fallback-title">
                  <KeyRound size={13} /> Unlock with Account Password
                </span>
                <button
                  type="button"
                  className="sealed-qr-decline-link"
                  onClick={() => {
                    setShowPasswordFallback(false);
                    setPassword('');
                    setPasswordError(null);
                  }}
                >
                  Hide
                </button>
              </div>
              <p className="doc-meta" style={{ margin: 0, fontSize: 12 }}>
                Confirms digital receipt in Track &amp; Audit Log without scanning on mobile.
              </p>
              <div className="password-input-wrap">
                <input
                  type={showPasswordText ? 'text' : 'password'}
                  aria-label="Account Password"
                  className="input"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError(null);
                  }}
                  placeholder="Enter your Tracely password"
                  style={{ paddingRight: 40 }}
                  autoFocus
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  aria-label="Toggle password visibility"
                  onClick={() => setShowPasswordText((v) => !v)}
                >
                  {showPasswordText ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {passwordError ? (
                <div role="alert" className="pill pill-rose" style={{ borderRadius: 10, padding: '6px 10px' }}>
                  {passwordError}
                </div>
              ) : null}
              <button
                type="submit"
                className="btn btn-amber"
                data-testid="web-unlock-password-submit"
                disabled={submittingPassword || isBusy}
                style={{ width: '100%' }}
              >
                <CheckCircle2 size={15} />
                <span>{submittingPassword ? 'Verifying...' : 'Confirm Receipt & Unlock'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </ModalDialog>
  );
};
