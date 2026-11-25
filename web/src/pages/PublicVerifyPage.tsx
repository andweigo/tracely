import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Lock, Search, ShieldCheck } from 'lucide-react';
import { useWebApp } from '../state/WebAppContext';
import { AppIconBadge } from '../components/AppIconBadge';

interface VerificationResult {
  readonly trackingCode: string;
  readonly lifecycleStatus: string;
  readonly currentOfficeName: string;
  readonly latestChecksumShort: string;
  readonly milestoneCount: number;
}

/**
 * Public, no-login QR verification page (#/verify or #/verify/<token>).
 * Verifies printed Tracely transmittal sheet authenticity and current office location
 * without exposing confidential document titles or internal notes.
 */
export const PublicVerifyPage: React.FC = () => {
  const { verifyToken, verifyPublicTransmittal, navigate, actor } = useWebApp();
  const [tokenInput, setTokenInput] = useState(verifyToken ?? '');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [verified, setVerified] = useState<VerificationResult | null>(null);

  const runVerify = useCallback(
    async (raw: string) => {
      const clean = raw.trim();
      if (!clean) return;
      setLoading(true);
      setErrorMsg(null);
      try {
        const result = await verifyPublicTransmittal(clean);
        setVerified(result);
      } catch (err) {
        setVerified(null);
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'No authentic Tracely transmittal matches this verification code.',
        );
      } finally {
        setLoading(false);
      }
    },
    [verifyPublicTransmittal],
  );

  useEffect(() => {
    if (verifyToken) {
      setTokenInput(verifyToken);
      void runVerify(verifyToken);
    }
  }, [verifyToken, runVerify]);

  return (
    <div className="auth-page" data-testid="web-public-verify-page">
      <div className="auth-card" style={{ maxWidth: 500 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AppIconBadge size={44} />
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--navy-ink)' }}>
                Tracely Verification
              </h1>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                Public Transmittal &amp; Custody Check
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-soft"
            style={{ fontSize: 12, minHeight: 34 }}
            onClick={() => navigate(actor ? 'inbox' : 'login')}
          >
            <ArrowLeft size={14} /> {actor ? 'Workspace' : 'Sign In'}
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runVerify(tokenInput);
          }}
          style={{ display: 'flex', gap: 8 }}
        >
          <input
            aria-label="Verification Code or Tracking Code"
            className="input mono"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="TRC-2026-000142 or TRC-QR:VERIFY:..."
            style={{ flex: 1 }}
          />
          <button
            type="submit"
            className="btn btn-amber"
            data-testid="web-public-verify-submit"
            disabled={!tokenInput.trim() || loading}
          >
            <Search size={14} /> {loading ? 'Checking...' : 'Verify'}
          </button>
        </form>

        {errorMsg ? (
          <div role="alert" className="pill pill-rose" style={{ borderRadius: 12, padding: '10px 12px' }}>
            {errorMsg}
          </div>
        ) : null}

        {verified ? (
          <div className="card-soft" data-testid="web-public-verify-result" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <span className="pill pill-emerald">
                <CheckCircle2 size={12} /> Authentic Tracely Record
              </span>
              <span className="mono" style={{ fontSize: 12, fontWeight: 800, color: 'var(--navy)' }}>
                {verified.trackingCode}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="workload-tile" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                <span className="workload-label">Current Office</span>
                <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                  {verified.currentOfficeName}
                </strong>
              </div>
              <div className="workload-tile" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                <span className="workload-label">Custody Status</span>
                <strong style={{ fontSize: 13, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                  {verified.lifecycleStatus.replace(/_/g, ' ')}
                </strong>
              </div>
              <div className="workload-tile" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                <span className="workload-label">Recorded Checkpoints</span>
                <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                  {verified.milestoneCount} milestone(s)
                </strong>
              </div>
              <div className="workload-tile" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                <span className="workload-label">Integrity Digest</span>
                <strong className="mono" style={{ fontSize: 12, color: 'var(--navy)' }}>
                  {verified.latestChecksumShort}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-secondary)' }}>
              <Lock size={12} />
              <span>Document titles and files remain private.</span>
            </div>
          </div>
        ) : (
          <div className="card-soft" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
            <ShieldCheck size={16} color="var(--navy)" style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Enter a tracking code or scan a printed QR to verify a document.</span>
          </div>
        )}
      </div>
    </div>
  );
};
