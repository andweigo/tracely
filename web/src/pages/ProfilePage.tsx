import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Check,
  KeyRound,
  Laptop,
  LogOut,
  Plus,
  Radio,
  RefreshCw,
  Shield,
  UserCog,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { AvailabilityStatus, SentContributionReport } from '../domain/types';
import { useWebApp } from '../state/WebAppContext';
import { IdentityWalletCard } from '../components/IdentityWalletCard';
import { ModalDialog } from '../components/Modals';
import { paginateList, PaginationBar } from '../components/PaginationBar';
import {
  buildLocalSentContributions,
  SentContributionGraph,
} from '../components/SentContributionGraph';
import { formatClockTime, formatCompactDate } from '../utils/formatters';

const ADMIN_APPROVALS_PER_PAGE = 8;
const ADMIN_PERSONNEL_PER_PAGE = 8;
const ADMIN_OFFICES_PER_PAGE = 10;
const PROFILE_SESSIONS_PER_PAGE = 6;

const ADMIN_ROLE_OPTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'staff', label: 'Staff' },
  { id: 'unit_head', label: 'Unit Head' },
  { id: 'records_officer', label: 'Records Officer' },
  { id: 'legal_officer', label: 'Legal Officer' },
  { id: 'ict_admin', label: 'ICT Admin' },
];

export const ProfilePage: React.FC = () => {
  const {
    actor,
    documents,
    trackedSnapshots,
    offices,
    activeSessions,
    securityPrefs,
    canApproveAccounts,
    pendingApprovals,
    adminUsers,
    realtimeStatus,
    fcmConfigured,
    isBusy,
    updateAvailability,
    updateSecurityPrefs,
    getSentContributions,
    loadActiveSessions,
    revokeOtherSessions,
    changePassword,
    loadPendingUsers,
    approvePendingUser,
    rejectPendingUser,
    loadAdminUsers,
    updateAdminUser,
    createAdminOffice,
    updateAdminOffice,
    signOut,
    navigate,
  } = useWebApp();

  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currPass, setCurrPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [adminTab, setAdminTab] = useState<'approvals' | 'personnel' | 'offices'>('approvals');
  const [userSearch, setUserSearch] = useState('');
  const [approvalsPage, setApprovalsPage] = useState(1);
  const [personnelPage, setPersonnelPage] = useState(1);
  const [officesPage, setOfficesPage] = useState(1);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [serverContributions, setServerContributions] = useState<SentContributionReport | null>(
    null,
  );

  const localContributions = useMemo(
    () => buildLocalSentContributions(documents, actor),
    [documents, actor],
  );

  useEffect(() => {
    if (!actor) {
      setServerContributions(null);
      return;
    }
    let cancelled = false;
    getSentContributions()
      .then((report) => {
        if (!cancelled) setServerContributions(report);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [actor?.id, documents.length, getSentContributions]);

  const contributionReport = serverContributions ?? localContributions;
  const [newOfficeCode, setNewOfficeCode] = useState('');
  const [newOfficeName, setNewOfficeName] = useState('');
  const [editingOfficeId, setEditingOfficeId] = useState<string | null>(null);
  const [editingOfficeName, setEditingOfficeName] = useState('');

  useEffect(() => {
    if (actor && canApproveAccounts) {
      loadPendingUsers().catch(() => {});
      loadAdminUsers().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor?.id, canApproveAccounts]);

  const filteredAdminUsers = useMemo(
    () =>
      adminUsers.filter((u) => {
        const q = userSearch.trim().toLowerCase();
        if (!q) return true;
        return (
          u.fullName.toLowerCase().includes(q) ||
          u.employeeId.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.office.code.toLowerCase().includes(q)
        );
      }),
    [adminUsers, userSearch],
  );

  const pagedApprovals = useMemo(
    () => paginateList(pendingApprovals, approvalsPage, ADMIN_APPROVALS_PER_PAGE),
    [pendingApprovals, approvalsPage],
  );
  const pagedPersonnel = useMemo(
    () => paginateList(filteredAdminUsers, personnelPage, ADMIN_PERSONNEL_PER_PAGE),
    [filteredAdminUsers, personnelPage],
  );
  const pagedOffices = useMemo(
    () => paginateList(offices, officesPage, ADMIN_OFFICES_PER_PAGE),
    [offices, officesPage],
  );
  const pagedSessions = useMemo(
    () => paginateList(activeSessions, sessionsPage, PROFILE_SESSIONS_PER_PAGE),
    [activeSessions, sessionsPage],
  );

  const incomingCount = actor
    ? documents.filter(
        (d) =>
          d.currentOffice.id === actor.office.id &&
          d.transactions[d.transactions.length - 1]?.status === 'pending',
      ).length
    : 0;
  const inReviewCount = actor
    ? documents.filter(
        (d) =>
          d.currentOffice.id === actor.office.id &&
          d.transactions[d.transactions.length - 1]?.status !== 'pending' &&
          d.lifecycleStatus === 'in_review',
      ).length
    : 0;
  const returnedCount = actor
    ? documents.filter((d) => d.lifecycleStatus === 'returned_for_revision').length
    : 0;

  return (
    <div className="profile-grid">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <IdentityWalletCard
          testId="web-profile-wallet-card"
          fullName={actor?.fullName ?? 'Tracely Workspace'}
          employeeId={actor?.employeeId ?? 'EMP-2026-0001'}
          position={actor?.position ?? 'Records Officer'}
          officeCode={actor?.office.code ?? 'RECORDS'}
          officeName={actor?.office.name ?? 'Records & Registry'}
          roleLabel={actor?.roleLabel ?? 'Records Officer'}
          email={actor?.email}
          accentColor={actor?.avatarColor}
          activeDocsCount={incomingCount + inReviewCount + returnedCount}
          completedDocsCount={
            documents.filter(
              (d) => d.lifecycleStatus === 'approved' || d.lifecycleStatus === 'archived',
            ).length
          }
          actionLabel="Edit User Profile"
          onActionClick={() => navigate('user_profile')}
          defaultMasked={true}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            padding: '4px 2px',
          }}
        >
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigate('user_profile')}
          >
            <UserCog size={15} /> Edit Profile
          </button>
          {actor ? (
            <button type="button" className="btn btn-amber" onClick={() => void signOut()}>
              <LogOut size={15} /> Sign Out
            </button>
          ) : (
            <button type="button" className="btn btn-amber" onClick={() => navigate('login')}>
              Sign In
            </button>
          )}
        </div>

        {actor ? (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h4 className="section-title" style={{ fontSize: 15 }}>
              Routing Availability
            </h4>
            <div className="chip-row">
              {(
                [
                  { id: 'available', label: 'Available' },
                  { id: 'official_business', label: 'Official Business' },
                  { id: 'on_leave', label: 'On Leave' },
                ] as ReadonlyArray<{ id: AvailabilityStatus; label: string }>
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`tab-pill ${actor.availability === opt.id ? 'tab-pill-active' : ''}`}
                  style={actor.availability !== opt.id ? { background: 'var(--surface)', border: '1px solid var(--border)' } : undefined}
                  onClick={() => void updateAvailability(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {actor && canApproveAccounts ? (
          <div
            className="card"
            data-testid="web-admin-approvals"
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={16} color="var(--navy)" />
                <h4 className="section-title" style={{ fontSize: 15 }}>
                  ICT / HR Admin Console
                </h4>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-soft"
                  style={{ minHeight: 30, padding: '4px 10px', fontSize: 12 }}
                  disabled={isBusy}
                  onClick={() => {
                    void loadPendingUsers();
                    void loadAdminUsers();
                  }}
                >
                  <RefreshCw size={13} /> Refresh
                </button>
              </div>
            </div>

            <div className="segmented-control" role="tablist" aria-label="Admin console sections">
              <button
                type="button"
                role="tab"
                aria-selected={adminTab === 'approvals'}
                className={`segment-btn ${adminTab === 'approvals' ? 'segment-btn-active' : ''}`}
                onClick={() => setAdminTab('approvals')}
              >
                <UserPlus size={13} /> Approvals ({pendingApprovals.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={adminTab === 'personnel'}
                className={`segment-btn ${adminTab === 'personnel' ? 'segment-btn-active' : ''}`}
                onClick={() => {
                  setAdminTab('personnel');
                  if (adminUsers.length === 0) void loadAdminUsers();
                }}
              >
                <Users size={13} /> Personnel ({adminUsers.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={adminTab === 'offices'}
                className={`segment-btn ${adminTab === 'offices' ? 'segment-btn-active' : ''}`}
                onClick={() => setAdminTab('offices')}
              >
                <Building2 size={13} /> Offices ({offices.length})
              </button>
            </div>

            {adminTab === 'approvals' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pendingApprovals.length === 0 ? (
                  <p className="doc-meta" style={{ margin: 0 }}>
                    No pending account registration requests awaiting administrator approval.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {pagedApprovals.pageItems.map((candidate) => (
                      <div
                        key={candidate.id}
                        className="card-soft"
                        data-testid={`pending-user-${candidate.id}`}
                        style={{
                          padding: 12,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-primary)' }}>
                            {candidate.fullName}{' '}
                            <span className="mono" style={{ fontSize: 11, color: 'var(--navy)' }}>
                              ({candidate.employeeId})
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {candidate.position} · {candidate.office.code} ({candidate.office.name})
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {candidate.email}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ minHeight: 34, padding: '4px 12px', fontSize: 12 }}
                            disabled={isBusy}
                            onClick={() => void approvePendingUser(candidate.id)}
                          >
                            <Check size={13} /> Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger-outline"
                            style={{ minHeight: 34, padding: '4px 12px', fontSize: 12 }}
                            disabled={isBusy}
                            onClick={() => void rejectPendingUser(candidate.id)}
                          >
                            <X size={13} /> Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <PaginationBar
                  totalItems={pendingApprovals.length}
                  page={pagedApprovals.safePage}
                  pageSize={ADMIN_APPROVALS_PER_PAGE}
                  itemLabel="pending requests"
                  onPageChange={setApprovalsPage}
                  testId="web-profile-approvals-pagination"
                  compact
                />
              </div>
            ) : adminTab === 'personnel' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                  className="input"
                  aria-label="Filter team directory"
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    setPersonnelPage(1);
                  }}
                  placeholder="Search personnel by name, ID, email, or office..."
                />
                {filteredAdminUsers.length === 0 ? (
                  <p className="doc-meta" style={{ margin: 0 }}>
                    No personnel records match this filter.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {pagedPersonnel.pageItems.map((person) => {
                      const isSelf = person.id === actor.id;
                      const isActive = person.active !== false;
                      return (
                        <div
                          key={person.id}
                          className="card-soft"
                          data-testid={`admin-user-row-${person.id}`}
                          style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <div>
                              <strong style={{ fontSize: 13 }}>{person.fullName}</strong>{' '}
                              <span className="mono" style={{ fontSize: 11, color: 'var(--navy)' }}>
                                {person.employeeId}
                              </span>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                {person.position} · {person.email}
                              </div>
                            </div>
                            <span className={`pill ${isActive ? 'pill-emerald' : 'pill-rose'}`}>
                              {isActive ? 'Active' : 'Deactivated'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <select
                              aria-label={`Role for ${person.fullName}`}
                              className="select"
                              style={{ width: 'auto', minHeight: 32, padding: '4px 10px', fontSize: 12 }}
                              value={person.role ?? 'staff'}
                              disabled={isBusy}
                              onChange={(e) => void updateAdminUser(person.id, { role: e.target.value })}
                            >
                              {ADMIN_ROLE_OPTIONS.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>

                            <select
                              aria-label={`Office for ${person.fullName}`}
                              className="select"
                              style={{ width: 'auto', minHeight: 32, padding: '4px 10px', fontSize: 12 }}
                              value={person.office.id}
                              disabled={isBusy}
                              onChange={(e) => void updateAdminUser(person.id, { officeId: e.target.value })}
                            >
                              {offices.map((off) => (
                                <option key={off.id} value={off.id}>
                                  {off.code} — {off.name}
                                </option>
                              ))}
                            </select>

                            {!isSelf ? (
                              <button
                                type="button"
                                className={`btn ${isActive ? 'btn-danger-outline' : 'btn-primary'}`}
                                style={{ minHeight: 32, padding: '4px 10px', fontSize: 12, marginLeft: 'auto' }}
                                disabled={isBusy}
                                onClick={() => void updateAdminUser(person.id, { active: !isActive })}
                              >
                                {isActive ? 'Deactivate' : 'Reactivate'}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <PaginationBar
                  totalItems={filteredAdminUsers.length}
                  page={pagedPersonnel.safePage}
                  pageSize={ADMIN_PERSONNEL_PER_PAGE}
                  itemLabel="personnel"
                  onPageChange={setPersonnelPage}
                  testId="web-profile-personnel-pagination"
                  compact
                />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newOfficeCode.trim() || !newOfficeName.trim()) return;
                    await createAdminOffice({
                      code: newOfficeCode.trim().toUpperCase(),
                      name: newOfficeName.trim(),
                    });
                    setNewOfficeCode('');
                    setNewOfficeName('');
                  }}
                  style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
                >
                  <input
                    className="input mono"
                    aria-label="New office code"
                    style={{ width: 110 }}
                    maxLength={20}
                    value={newOfficeCode}
                    onChange={(e) => setNewOfficeCode(e.target.value.toUpperCase())}
                    placeholder="CODE"
                  />
                  <input
                    className="input"
                    aria-label="New office name"
                    style={{ flex: 1, minWidth: 160 }}
                    maxLength={120}
                    value={newOfficeName}
                    onChange={(e) => setNewOfficeName(e.target.value)}
                    placeholder="Office / Department Name"
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isBusy || newOfficeCode.trim().length < 2 || newOfficeName.trim().length < 3}
                  >
                    <Plus size={14} /> Add Office
                  </button>
                </form>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {pagedOffices.pageItems.map((off) => (
                    <div
                      key={off.id}
                      className="card-soft"
                      style={{
                        padding: '8px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      {editingOfficeId === off.id ? (
                        <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                          <input
                            className="input"
                            style={{ padding: '5px 8px', fontSize: 12 }}
                            value={editingOfficeName}
                            onChange={(e) => setEditingOfficeName(e.target.value)}
                          />
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ minHeight: 30, padding: '2px 10px', fontSize: 11 }}
                            onClick={async () => {
                              await updateAdminOffice(off.id, { name: editingOfficeName.trim() });
                              setEditingOfficeId(null);
                            }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline"
                            style={{ minHeight: 30, padding: '2px 10px', fontSize: 11 }}
                            onClick={() => setEditingOfficeId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <div>
                            <span className="mono" style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--navy)' }}>
                              {off.code}
                            </span>{' '}
                            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{off.name}</span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-soft"
                            style={{ minHeight: 28, padding: '2px 10px', fontSize: 11 }}
                            onClick={() => {
                              setEditingOfficeId(off.id);
                              setEditingOfficeName(off.name);
                            }}
                          >
                            Rename
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <PaginationBar
                  totalItems={offices.length}
                  page={pagedOffices.safePage}
                  pageSize={ADMIN_OFFICES_PER_PAGE}
                  itemLabel="offices"
                  onPageChange={setOfficesPage}
                  testId="web-profile-offices-pagination"
                  compact
                />
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h4 className="section-title" style={{ fontSize: 15 }}>
            Desk Workload Overview
          </h4>
          <div className="workload-grid">
            <div className="workload-tile">
              <span className="workload-value">{incomingCount}</span>
              <span className="workload-label">Pending Receipt</span>
            </div>
            <div className="workload-tile">
              <span className="workload-value">{inReviewCount}</span>
              <span className="workload-label">In Review</span>
            </div>
            <div className="workload-tile">
              <span className="workload-value">{returnedCount}</span>
              <span className="workload-label">Returned</span>
            </div>
            <div className="workload-tile">
              <span className="workload-value">{trackedSnapshots.length}</span>
              <span className="workload-label">Tracked Docs</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h4 className="section-title" style={{ fontSize: 15 }}>
          Security & Server Configuration
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
              ? 'Real-Time Live Pulse Active (3s instant sync)'
              : 'Live Workspace Sync Enabled'}
          </span>
          <span className={`pill ${fcmConfigured ? 'pill-emerald' : 'pill-sky'}`} style={{ fontSize: 10 }}>
            {fcmConfigured ? 'FCM Push Live' : 'SSE & Push Ready'}
          </span>
        </div>

        <label
          className="switch-row"
          style={{
            padding: '10px 0',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={14} color="var(--navy)" />
              <span>Confidential File Lock</span>
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

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={async () => {
              if (actor) await loadActiveSessions();
              setSessionsOpen(true);
            }}
          >
            <Laptop size={15} /> Active Devices
          </button>

          {actor ? (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setPasswordOpen(true)}
            >
              <KeyRound size={15} /> Change Account Password
            </button>
          ) : null}
        </div>
      </div>
      </div>

      {actor ? (
        <div style={{ gridColumn: '1 / -1' }}>
          <SentContributionGraph
            report={contributionReport}
            defaultScope="user"
            testId="web-profile-sent-contributions"
          />
        </div>
      ) : null}

      <ModalDialog
        open={sessionsOpen}
        onClose={() => setSessionsOpen(false)}
        title="Active Devices"
      >
        {!actor ? (
          <p className="doc-meta">Sign in to view your active devices.</p>
        ) : activeSessions.length === 0 ? (
          <p className="doc-meta">No active sessions.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pagedSessions.pageItems.map((sess) => (
              <div key={sess.id} className="card-soft" style={{ padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>
                  {sess.deviceName} {sess.current ? '· Current' : ''}
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
              pageSize={PROFILE_SESSIONS_PER_PAGE}
              itemLabel="sessions"
              onPageChange={setSessionsPage}
              testId="web-profile-sessions-pagination"
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
      </ModalDialog>

      <ModalDialog
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        title="Change Account Password"
        subtitle="Applies across all Tracely Mobile and Web sessions"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await changePassword(currPass, newPass);
            setCurrPass('');
            setNewPass('');
            setPasswordOpen(false);
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <input
            type="password"
            className="input"
            value={currPass}
            onChange={(e) => setCurrPass(e.target.value)}
            placeholder="Current password"
          />
          <input
            type="password"
            className="input"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            placeholder="New password (8–32 chars)"
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-outline" onClick={() => setPasswordOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!currPass || newPass.length < 8}>
              Update Password
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
};
