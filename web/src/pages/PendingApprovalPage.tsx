import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  LogIn,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { AppIconBadge } from '../components/AppIconBadge';
import { useWebApp } from '../state/WebAppContext';

const AUTO_POLL_MS = 15_000;

export const PendingApprovalPage: React.FC = () => {
  const {
    pendingRegistration,
    checkPendingRegistrationStatus,
    proceedFromPendingToLogin,
    dismissPendingRegistration,
    navigate,
  } = useWebApp();

  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!pendingRegistration) return;
    if (pendingRegistration.status !== 'pending' || !pendingRegistration.statusToken) return;

    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void checkPendingRegistrationStatus(true);
    }, AUTO_POLL_MS);

    return () => window.clearInterval(timer);
  }, [pendingRegistration, checkPendingRegistrationStatus]);

  if (!pendingRegistration) {
    return (
      <div className="auth-page" data-testid="web-pending-approval-page">
        <div className="auth-card" style={{ maxWidth: 480, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <AppIconBadge size={54} animated interactive />
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--navy-ink)' }}>
                No Pending Registration
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                Sign in or submit a new registration request.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ minHeight: 46, width: '100%' }}
            onClick={() => navigate('login')}
          >
            <LogIn size={15} /> Go to Sign In
          </button>
        </div>
      </div>
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

  const formattedCheckedAt = pendingRegistration.checkedAt
    ? new Date(pendingRegistration.checkedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null;

  return (
    <div className="auth-page" data-testid="web-pending-approval-page">
      <div className="auth-card" style={{ maxWidth: 500, width: '100%', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <AppIconBadge size={56} animated interactive />
          <div style={{ flex: 1 }}>
            <div
              className={`pill ${
                isApproved ? 'pill-emerald' : isRejected ? 'pill-rose' : 'pill-amber'
              }`}
              data-testid="web-pending-status-pill"
              style={{ marginBottom: 6, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {isApproved ? (
                <>
                  <CheckCircle2 size={13} /> Account Approved
                </>
              ) : isRejected ? (
                <>
                  <ShieldAlert size={13} /> Registration Not Approved
                </>
              ) : (
                <>
                  <Clock size={13} /> Awaiting Administrator Verification
                </>
              )}
            </div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--navy-ink)' }}>
              {isApproved
                ? 'Your Tracely Account Is Ready'
                : isRejected
                  ? 'Registration Declined'
                  : 'Account Pending Approval'}
            </h1>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
          {isApproved
            ? 'Your account is active. You can sign in now.'
            : isRejected
              ? pendingRegistration.message
              : 'Your account is waiting for administrator approval.'}
        </p>

        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 14,
            background: 'var(--surface-soft)',
            padding: '14px 16px',
            display: 'grid',
            gap: 8,
            fontSize: 13,
          }}
          data-testid="web-pending-summary-card"
        >
          {pendingRegistration.fullName ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Full Name</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700, textAlign: 'right' }}>
                {pendingRegistration.fullName}
              </span>
            </div>
          ) : null}
          {pendingRegistration.employeeId ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Employee ID</span>
              <span className="mono" style={{ color: 'var(--navy)', fontWeight: 700 }}>
                {pendingRegistration.employeeId}
              </span>
            </div>
          ) : null}
          {pendingRegistration.email ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Work Email</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right' }}>
                {pendingRegistration.email}
              </span>
            </div>
          ) : null}
          {pendingRegistration.officeCode || pendingRegistration.officeName ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Office / Unit</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right' }}>
                {pendingRegistration.officeCode
                  ? `${pendingRegistration.officeCode}${
                      pendingRegistration.officeName &&
                      pendingRegistration.officeName !== pendingRegistration.officeCode
                        ? ` — ${pendingRegistration.officeName}`
                        : ''
                    }`
                  : pendingRegistration.officeName}
              </span>
            </div>
          ) : null}
          {pendingRegistration.position ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Position</span>
              <span style={{ color: 'var(--text-primary)', textAlign: 'right' }}>
                {pendingRegistration.position}
              </span>
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {isApproved ? (
            <button
              type="button"
              className="btn btn-primary"
              data-testid="web-pending-proceed-signin-btn"
              style={{ minHeight: 46, width: '100%' }}
              onClick={() => proceedFromPendingToLogin(true)}
            >
              Proceed to Sign In <ArrowRight size={15} />
            </button>
          ) : isPending ? (
            <>
              <button
                type="button"
                className="btn btn-primary"
                data-testid="web-pending-check-status-btn"
                disabled={checking}
                style={{ minHeight: 46, width: '100%' }}
                onClick={() => void handleManualCheck()}
              >
                <RefreshCw size={15} />
                {checking ? 'Checking Approval Status…' : 'Check Approval Status'}
              </button>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                {pendingRegistration.statusToken
                  ? formattedCheckedAt
                    ? `Auto-checks every 15s · Last checked ${formattedCheckedAt}`
                    : 'Auto-checks every 15s while this page is open.'
                  : 'Once approved by an administrator, sign in using your registered credentials.'}
              </div>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              data-testid="web-pending-back-login-btn"
              style={{ minHeight: 46, width: '100%' }}
              onClick={() => dismissPendingRegistration()}
            >
              <LogIn size={15} /> Return to Sign In / Register
            </button>
          )}

          {!isRejected ? (
            <button
              type="button"
              className="btn btn-outline"
              data-testid="web-pending-switch-account-btn"
              style={{ minHeight: 42, width: '100%' }}
              onClick={() => proceedFromPendingToLogin(false)}
            >
              Sign in with a different account
            </button>
          ) : null}
        </div>

        <div
          style={{
            paddingTop: 12,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            className="unlock-fallback-toggle"
            onClick={() => navigate('verify')}
          >
            <ShieldCheck size={13} /> Verify Printed QR
          </button>
          <a
            href="/download"
            className="unlock-fallback-toggle"
            style={{ textDecoration: 'none' }}
          >
            <Smartphone size={13} /> Download Android App
          </a>
        </div>
      </div>
    </div>
  );
};
