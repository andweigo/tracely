import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Check,
  KeyRound,
  Laptop,
  Lock,
  LogOut,
  MapPin,
  Palette,
  Phone,
  Radio,
  Save,
  Settings,
  Shield,
  SlidersHorizontal,
  UserCircle2,
} from 'lucide-react';
import {
  AVATAR_COLOR_OPTIONS,
  DISPOSITION_REMARK_PRESETS,
  LandingScreenPreference,
  RoutingScope,
} from '../domain/types';
import { useWebApp } from '../state/WebAppContext';
import { IdentityWalletCard } from '../components/IdentityWalletCard';
import { paginateList, PaginationBar } from '../components/PaginationBar';
import { formatClockTime, formatCompactDate } from '../utils/formatters';

type UserProfileTab = 'info' | 'preferences' | 'settings';
const USER_SESSIONS_PER_PAGE = 6;

export const UserProfilePage: React.FC = () => {
  const {
    actor,
    activeSessions,
    securityPrefs,
    userPreferences,
    realtimeStatus,
    fcmConfigured,
    isBusy,
    updateProfile,
    updateUserPreferences,
    updateSecurityPrefs,
    loadActiveSessions,
    revokeOtherSessions,
    changePassword,
    signOut,
    navigate,
  } = useWebApp();

  const [tab, setTab] = useState<UserProfileTab>('info');
  const [sessionsPage, setSessionsPage] = useState(1);
  const pagedSessions = paginateList(activeSessions, sessionsPage, USER_SESSIONS_PER_PAGE);

  // Personal Info form state
  const [fullName, setFullName] = useState(actor?.fullName ?? '');
  const [email, setEmail] = useState(actor?.email ?? '');
  const [position, setPosition] = useState(actor?.position ?? '');
  const [contactNumber, setContactNumber] = useState(actor?.contactNumber ?? '');
  const [deskNote, setDeskNote] = useState(actor?.deskNote ?? '');
  const [avatarColor, setAvatarColor] = useState(actor?.avatarColor ?? '#0D3472');

  // Preferences form state
  const [defaultCopyFormat, setDefaultCopyFormat] = useState<'digital' | 'hard_copy'>(
    userPreferences.defaultCopyFormat,
  );
  const [defaultRoutingScope, setDefaultRoutingScope] = useState<RoutingScope>(
    userPreferences.defaultRoutingScope,
  );
  const [defaultRemarks, setDefaultRemarks] = useState(userPreferences.defaultRemarks);
  const [defaultLandingScreen, setDefaultLandingScreen] = useState<LandingScreenPreference>(
    userPreferences.defaultLandingScreen,
  );
  const [compactDensity, setCompactDensity] = useState(userPreferences.compactDensity);
  const [desktopNotifications, setDesktopNotifications] = useState(
    userPreferences.desktopNotifications,
  );
  const [notificationSound, setNotificationSound] = useState(userPreferences.notificationSound);
  const [hideLockScreenTitles, setHideLockScreenTitles] = useState(
    userPreferences.hideLockScreenTitles,
  );

  // Settings password state
  const [currPass, setCurrPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passError, setPassError] = useState<string | null>(null);

  useEffect(() => {
    if (!actor) return;
    setFullName(actor.fullName);
    setEmail(actor.email);
    setPosition(actor.position);
    setContactNumber(actor.contactNumber ?? '');
    setDeskNote(actor.deskNote ?? '');
    setAvatarColor(actor.avatarColor ?? '#0D3472');
  }, [actor]);

  useEffect(() => {
    setDefaultCopyFormat(userPreferences.defaultCopyFormat);
    setDefaultRoutingScope(userPreferences.defaultRoutingScope);
    setDefaultRemarks(userPreferences.defaultRemarks);
    setDefaultLandingScreen(userPreferences.defaultLandingScreen);
    setCompactDensity(userPreferences.compactDensity);
    setDesktopNotifications(userPreferences.desktopNotifications);
    setNotificationSound(userPreferences.notificationSound);
    setHideLockScreenTitles(userPreferences.hideLockScreenTitles);
  }, [userPreferences]);

  useEffect(() => {
    if (tab === 'settings' && actor) {
      loadActiveSessions().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, actor?.id]);

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({
      fullName: fullName.trim(),
      email: actor?.email ?? email.trim(),
      position: position.trim(),
      contactNumber: contactNumber.trim() || null,
      deskNote: deskNote.trim() || null,
      avatarColor,
    });
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateUserPreferences({
      defaultCopyFormat,
      defaultRoutingScope,
      defaultRemarks: defaultRemarks.trim(),
      defaultLandingScreen,
      compactDensity,
      desktopNotifications,
      notificationSound,
      hideLockScreenTitles,
    });
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    if (newPass !== confirmPass) {
      setPassError('New password and confirmation do not match.');
      return;
    }
    await changePassword(currPass, newPass);
    setCurrPass('');
    setNewPass('');
    setConfirmPass('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} data-testid="web-user-profile-page">
      <IdentityWalletCard
        testId="web-user-profile-wallet-card"
        liveSyncBadge="Live ID Preview"
        fullName={fullName || actor?.fullName || 'User Profile'}
        employeeId={actor?.employeeId ?? 'EMP-2026-0001'}
        position={position || actor?.position || 'Staff'}
        officeCode={actor?.office.code ?? 'RECORDS'}
        officeName={actor?.office.name ?? 'Records & Registry'}
        roleLabel={actor?.roleLabel ?? 'Authorized Personnel'}
        email={actor?.email ?? email}
        accentColor={avatarColor}
        actionLabel={contactNumber.trim() || deskNote.trim() || 'Active Pass'}
        onActionClick={() => setTab('info')}
        defaultMasked={false}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div
          className="segmented-control"
          role="tablist"
          aria-label="User profile sections"
          style={{ maxWidth: 560 }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'info'}
            className={`segment-btn ${tab === 'info' ? 'segment-btn-active' : ''}`}
            onClick={() => setTab('info')}
          >
            <UserCircle2 size={14} /> Personal Info
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'preferences'}
            className={`segment-btn ${tab === 'preferences' ? 'segment-btn-active' : ''}`}
            onClick={() => setTab('preferences')}
          >
            <SlidersHorizontal size={14} /> Preferences
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'settings'}
            className={`segment-btn ${tab === 'settings' ? 'segment-btn-active' : ''}`}
            onClick={() => setTab('settings')}
          >
            <Settings size={14} /> Settings
          </button>
        </div>

        <button
          type="button"
          className="btn btn-outline"
          onClick={() => navigate('profile')}
        >
          <ArrowLeft size={15} /> Back to Desk & Office Profile
        </button>
      </div>

      {tab === 'info' ? (
        <div style={{ maxWidth: 760, width: '100%' }}>
          <form
            className="card"
            onSubmit={handleSaveInfo}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <h4 className="section-title" style={{ fontSize: 15 }}>
                Edit Personal Information
              </h4>
              <span className="pill pill-sky" style={{ fontSize: 10 }}>
                Synced to Directory
              </span>
            </div>

            <div>
              <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Palette size={13} /> Avatar Theme Accent
              </label>
              <div className="chip-row" style={{ marginTop: 6 }}>
                {AVATAR_COLOR_OPTIONS.map((swatch) => {
                  const selected = avatarColor === swatch.hex;
                  return (
                    <button
                      key={swatch.hex}
                      type="button"
                      aria-label={`Avatar color ${swatch.label}`}
                      onClick={() => setAvatarColor(swatch.hex)}
                      className={`tab-pill ${selected ? 'tab-pill-active' : ''}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        border: selected ? `2px solid ${swatch.hex}` : '1px solid var(--border)',
                        background: selected ? swatch.hex : 'var(--surface)',
                        color: selected ? '#FFFFFF' : 'var(--text-primary)',
                      }}
                    >
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background: swatch.hex,
                          border: '1px solid rgba(255,255,255,0.6)',
                        }}
                      />
                      {swatch.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div>
                <label className="field-label" htmlFor="user-profile-fullname">
                  Full Name
                </label>
                <input
                  id="user-profile-fullname"
                  aria-label="Profile Full Name"
                  className="input"
                  value={fullName}
                  maxLength={50}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Marco A. Villareal"
                  required
                />
              </div>

              <div>
                <label
                  className="field-label"
                  htmlFor="user-profile-email"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <Lock size={11} /> Official Email Address (Read-Only)
                </label>
                <input
                  id="user-profile-email"
                  aria-label="Profile Official Email"
                  type="email"
                  className="input"
                  value={actor?.email ?? email}
                  readOnly
                  disabled
                  style={{
                    background: 'var(--surface-soft)',
                    color: 'var(--text-secondary)',
                    cursor: 'not-allowed',
                  }}
                />
              </div>

              <div>
                <label className="field-label" htmlFor="user-profile-position">
                  Position / Designation
                </label>
                <input
                  id="user-profile-position"
                  aria-label="Profile Position"
                  className="input"
                  value={position}
                  maxLength={80}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="e.g. Administrative Officer V"
                  required
                />
              </div>

              <div>
                <label className="field-label" htmlFor="user-profile-contact">
                  <Phone size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  Contact Number / Local Ext.
                </label>
                <input
                  id="user-profile-contact"
                  aria-label="Profile Contact Number"
                  className="input"
                  value={contactNumber}
                  maxLength={32}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="e.g. +63 917 555 0142"
                />
              </div>
            </div>

            <div>
              <label className="field-label" htmlFor="user-profile-desknote">
                <MapPin size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Desk Location / Receiving Note
              </label>
              <input
                id="user-profile-desknote"
                aria-label="Profile Desk Note"
                className="input"
                value={deskNote}
                maxLength={160}
                onChange={(e) => setDeskNote(e.target.value)}
                placeholder="e.g. 2nd Floor Finance Wing · Window 3 (Drop hard-copy folders at tray B)"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isBusy || !actor || fullName.trim().length < 2 || position.trim().length < 2}
              >
                <Save size={15} /> Save Profile Info
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {tab === 'preferences' ? (
        <form
          className="profile-grid"
          onSubmit={handleSavePreferences}
          data-testid="user-preferences-form"
        >
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h4 className="section-title" style={{ fontSize: 15 }}>
              Workflow & Routing Defaults
            </h4>

            <div>
              <label className="field-label" htmlFor="pref-copy-format">
                Default Send Document Format
              </label>
              <select
                id="pref-copy-format"
                aria-label="Default Send Document Format"
                className="select"
                value={defaultCopyFormat}
                onChange={(e) => setDefaultCopyFormat(e.target.value as 'digital' | 'hard_copy')}
              >
                <option value="digital">Soft Copy (PDF / Scanned Image Upload)</option>
                <option value="hard_copy">Hard Copy (Physical Folder + QR Slip)</option>
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor="pref-routing-scope">
                Default Forwarding Scope
              </label>
              <select
                id="pref-routing-scope"
                aria-label="Default Forwarding Scope"
                className="select"
                value={defaultRoutingScope}
                onChange={(e) => setDefaultRoutingScope(e.target.value as RoutingScope)}
              >
                <option value="inter_office">Inter-Office (Across Departments)</option>
                <option value="internal_office">Internal Office (Same Unit Staff)</option>
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor="pref-default-remarks">
                Default Disposition / Routing Remark
              </label>
              <select
                id="pref-default-remarks"
                aria-label="Default Disposition Remark"
                className="select"
                value={defaultRemarks}
                onChange={(e) => setDefaultRemarks(e.target.value)}
              >
                <option value="">None (Leave blank by default)</option>
                {DISPOSITION_REMARK_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor="pref-landing-screen">
                Default Workspace Start Screen
              </label>
              <select
                id="pref-landing-screen"
                aria-label="Default Workspace Start Screen"
                className="select"
                value={defaultLandingScreen}
                onChange={(e) => setDefaultLandingScreen(e.target.value as LandingScreenPreference)}
              >
                <option value="inbox">Dashboard & Inbox</option>
                <option value="sent">Sent Files</option>
                <option value="track">Track Documents</option>
              </select>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h4 className="section-title" style={{ fontSize: 15 }}>
              Display & Notification Preferences
            </h4>

            <label className="switch-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>Compact Table & Card Density</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Fit more incoming and sent documents per screen
                </div>
              </div>
              <span className="switch-control">
                <input
                  type="checkbox"
                  aria-label="Compact Table & Card Density"
                  className="switch-input"
                  checked={compactDensity}
                  onChange={(e) => setCompactDensity(e.target.checked)}
                />
                <span className="switch-track" aria-hidden="true">
                  <span className="switch-thumb" />
                </span>
              </span>
            </label>

            <label className="switch-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Bell size={14} color="var(--navy)" /> Browser Desktop Notification Popups
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Show OS toast popups when new documents arrive in your queue
                </div>
              </div>
              <span className="switch-control">
                <input
                  type="checkbox"
                  aria-label="Browser Desktop Notification Popups"
                  className="switch-input"
                  checked={desktopNotifications}
                  onChange={(e) => setDesktopNotifications(e.target.checked)}
                />
                <span className="switch-track" aria-hidden="true">
                  <span className="switch-thumb" />
                </span>
              </span>
            </label>

            <label className="switch-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>Notification Alert Chime</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Play subtle audio cue on high-priority SLA or QR custody alerts
                </div>
              </div>
              <span className="switch-control">
                <input
                  type="checkbox"
                  aria-label="Notification Alert Chime"
                  className="switch-input"
                  checked={notificationSound}
                  onChange={(e) => setNotificationSound(e.target.checked)}
                />
                <span className="switch-track" aria-hidden="true">
                  <span className="switch-thumb" />
                </span>
              </span>
            </label>

            <label className="switch-row" style={{ padding: '8px 0' }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>Mask Titles on Lock-Screen Previews</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Enforce privacy masking on push notification banners
                </div>
              </div>
              <span className="switch-control">
                <input
                  type="checkbox"
                  aria-label="Mask Titles on Lock-Screen Previews"
                  className="switch-input"
                  checked={hideLockScreenTitles}
                  onChange={(e) => setHideLockScreenTitles(e.target.checked)}
                />
                <span className="switch-track" aria-hidden="true">
                  <span className="switch-thumb" />
                </span>
              </span>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
              <button type="submit" className="btn btn-primary" disabled={isBusy}>
                <Check size={15} /> Save Preferences
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {tab === 'settings' ? (
        <div className="profile-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h4 className="section-title" style={{ fontSize: 15 }}>
                <KeyRound size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Change Account Password
              </h4>
              <form
                onSubmit={handlePasswordSubmit}
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <input
                  type="password"
                  aria-label="Current account password"
                  className="input"
                  value={currPass}
                  onChange={(e) => setCurrPass(e.target.value)}
                  placeholder="Current password"
                />
                <input
                  type="password"
                  aria-label="New account password"
                  className="input"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="New password (8–32 chars, upper/lower/number/symbol)"
                />
                <input
                  type="password"
                  aria-label="Confirm new account password"
                  className="input"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="Confirm new password"
                />
                {passError ? (
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--rose-text)', fontWeight: 700 }}>
                    {passError}
                  </p>
                ) : null}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isBusy || !actor || !currPass || newPass.length < 8}
                  >
                    <Lock size={14} /> Update Password
                  </button>
                </div>
              </form>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h4 className="section-title" style={{ fontSize: 15 }}>
                Privacy & Server Connection
              </h4>

              <div
                className="card-soft"
                style={{
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--navy)' }}>
                  <Radio size={14} color={realtimeStatus === 'live' ? 'var(--emerald-text)' : 'var(--navy)'} />
                  {realtimeStatus === 'live'
                    ? 'Real-Time Live Pulse Active (3s)'
                    : 'Live Workspace Sync Enabled'}
                </span>
                <span className={`pill ${fcmConfigured ? 'pill-emerald' : 'pill-sky'}`} style={{ fontSize: 10 }}>
                  {fcmConfigured ? 'FCM Push Live' : 'SSE & Push Ready'}
                </span>
              </div>

              <label className="switch-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Shield size={14} color="var(--navy)" /> Device Lock for Confidential Docs
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Require session verification before opening 60s Confidential files
                  </div>
                </div>
                <span className="switch-control">
                  <input
                    type="checkbox"
                    className="switch-input"
                    checked={securityPrefs.biometricLock}
                    onChange={(e) => updateSecurityPrefs({ biometricLock: e.target.checked })}
                  />
                  <span className="switch-track" aria-hidden="true">
                    <span className="switch-thumb" />
                  </span>
                </span>
              </label>

              {actor ? (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-danger-outline"
                    onClick={() => void signOut()}
                  >
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <h4 className="section-title" style={{ fontSize: 15 }}>
                <Laptop size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Active Devices & Sanctum Sessions
              </h4>
              {actor ? (
                <button
                  type="button"
                  className="btn btn-soft"
                  style={{ minHeight: 30, padding: '4px 10px', fontSize: 12 }}
                  onClick={() => void loadActiveSessions()}
                >
                  Refresh
                </button>
              ) : null}
            </div>

            {!actor ? (
              <p className="doc-meta" style={{ margin: 0 }}>
                Sign in to inspect and revoke connected Android and Web sessions.
              </p>
            ) : activeSessions.length === 0 ? (
              <p className="doc-meta" style={{ margin: 0 }}>
                No active remote sessions reported by the server.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pagedSessions.pageItems.map((sess) => (
                  <div key={sess.id} className="card-soft" style={{ padding: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>
                      {sess.deviceName} {sess.current ? '· Current Device' : ''}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {sess.ipHint} · Last active {formatCompactDate(sess.lastActiveAt)}{' '}
                      {formatClockTime(sess.lastActiveAt)}
                    </div>
                  </div>
                ))}
                <PaginationBar
                  totalItems={activeSessions.length}
                  page={pagedSessions.safePage}
                  pageSize={USER_SESSIONS_PER_PAGE}
                  itemLabel="sessions"
                  onPageChange={setSessionsPage}
                  testId="web-user-sessions-pagination"
                  compact
                />
                <button
                  type="button"
                  className="btn btn-danger-outline"
                  onClick={() => void revokeOtherSessions()}
                >
                  Revoke All Other Devices
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
