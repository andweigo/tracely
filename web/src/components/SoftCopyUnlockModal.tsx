import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
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
 * Displays a single-use, 5-minute QR & 6-char code for Tracely Mobile to scan,
 * auto-unlocking Desktop in real time when Mobile scans it, plus a clean
 * account-password fallback when no phone is nearby.
 */
export const SoftCopyUnlockModal: React.FC = () => {
  const {
    actor,
    documents,
    softCopyUnlockDocId,
    closeSoftCopyUnlock,
    createUnlockChallenge,
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
  const [showPasswordFallback, setShowPasswordFallback] = useState(false);
  const [password, setPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submittingPassword, setSubmittingPassword] = useState(false);

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

  // Reset modal state & generate fresh challenge whenever opened for a document
  useEffect(() => {
    if (!softCopyUnlockDocId) {
      setChallenge(null);
      setChallengeError(null);
      setShowPasswordFallback(false);
      setPassword('');
      setPasswordError(null);
      return;
    }
    void loadChallenge(softCopyUnlockDocId);
  }, [softCopyUnlockDocId, loadChallenge]);

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
      title="Scan with Tracely Mobile"
      subtitle={`Soft Copy from ${fromOffice.code}${fromUser ? ` · ${fromUser}` : ''}`}
    >
      <div className="unlock-qr-stage" data-testid="web-soft-copy-unlock-modal">
        {loadingChallenge ? (
          <div className="unlock-qr-placeholder">Generating single-use Unlock QR...</div>
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
            <div className={`unlock-qr-frame ${isExpired ? 'unlock-qr-frame-expired' : ''}`}>
              <QrCodeGraphic value={challenge.qrPayload} size={184} />
            </div>

            <div className="unlock-short-code-box">
              <span className="unlock-short-code-label">Or enter code in Tracely Mobile</span>
              <span className="mono unlock-short-code-val" data-testid="web-unlock-short-code">
                {challenge.shortCode}
              </span>
            </div>

            <div className="unlock-live-row">
              <span className="unlock-live-status">
                <Smartphone size={14} />
                {isExpired
                  ? 'QR expired — refresh to scan'
                  : `Waiting for Tracely Mobile · ${formatCountdown(challenge.expiresAt, nowMs)}`}
              </span>
              <button
                type="button"
                className="btn btn-soft"
                style={{ minHeight: 30, padding: '4px 10px', fontSize: 11.5 }}
                onClick={() => void loadChallenge(doc.id)}
              >
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
          </>
        ) : null}

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
              <div style={{ position: 'relative' }}>
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
                  aria-label="Toggle password visibility"
                  onClick={() => setShowPasswordText((v) => !v)}
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
                  {showPasswordText ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {passwordError ? (
                <div className="pill pill-rose" style={{ borderRadius: 10, padding: '6px 10px' }}>
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
