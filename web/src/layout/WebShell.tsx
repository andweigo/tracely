import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  CheckCircle2,
  FileOutput,
  FileText,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  RefreshCw,
  Search,
  Send,
  Settings,
  UserCheck,
  UserCog,
  X,
} from 'lucide-react';
import { WebRoute } from '../domain/types';
import { useWebApp } from '../state/WebAppContext';
import { AppIconBadge } from '../components/AppIconBadge';
import { QuickSearchModal } from '../components/QuickSearchModal';

interface NavEntry {
  readonly id: WebRoute;
  readonly label: string;
  readonly badge?: number;
  readonly icon: React.ReactNode;
}

const ROUTE_TITLES: Record<WebRoute, { title: string; sub: string }> = {
  dashboard: { title: 'Dashboard', sub: 'Recent tracking and folders' },
  inbox: { title: 'Inbox', sub: 'Incoming and active documents' },
  send: { title: 'Send Document', sub: 'Upload a soft copy or register a hard copy' },
  sent: { title: 'Sent Files', sub: 'Documents sent by your office' },
  completed: { title: 'Completed', sub: 'Approved and archived records' },
  document: { title: 'Document Detail', sub: 'Timeline and file details' },
  track: { title: 'Track Documents', sub: 'Check document status and location' },
  analytics: { title: 'Analytics', sub: 'Office turnaround and volume' },
  categories: { title: 'Categories', sub: 'Browse documents by category' },
  alerts: { title: 'Alerts', sub: 'Document updates and notifications' },
  profile: { title: 'Profile', sub: 'Identity and account security' },
  user_profile: { title: 'User Profile', sub: 'Personal details and preferences' },
  settings: { title: 'Settings', sub: 'Folders, permissions, and app info' },
  verify: { title: 'Verify QR', sub: 'Check printed transmittals' },
  pending_approval: { title: 'Pending Approval', sub: 'Waiting for admin approval' },
  login: { title: 'Sign In', sub: 'Tracely Web Portal' },
};

export const WebShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    route,
    navigate,
    actor,
    pendingReceiptCount,
    pendingSentCount,
    unreadNotificationCount,
    userPreferences,
    realtimeStatus,
    signOut,
    refreshWorkspace,
    isRefreshing,
    toast,
    clearToast,
  } = useWebApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuickSearchOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const navItems: NavEntry[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard size={17} />,
    },
    {
      id: 'inbox',
      label: 'Inbox',
      badge: pendingReceiptCount > 0 ? pendingReceiptCount : undefined,
      icon: <Inbox size={17} />,
    },
    { id: 'send', label: 'Send Document', icon: <Send size={17} /> },
    {
      id: 'sent',
      label: 'Sent Files',
      badge: pendingSentCount > 0 ? pendingSentCount : undefined,
      icon: <FileOutput size={17} />,
    },
    { id: 'completed', label: 'Completed', icon: <CheckCircle2 size={17} /> },
    { id: 'document', label: 'Document Detail', icon: <FileText size={17} /> },
    { id: 'track', label: 'Track Docs', icon: <MapPin size={17} /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={17} /> },
    { id: 'categories', label: 'Categories', icon: <FolderKanban size={17} /> },
    {
      id: 'alerts',
      label: 'Alerts & Sync',
      badge: unreadNotificationCount > 0 ? unreadNotificationCount : undefined,
      icon: <Bell size={17} />,
    },
    { id: 'profile', label: 'Profile', icon: <UserCheck size={17} /> },
  ];

  const meta = ROUTE_TITLES[route];

  const handleNav = (id: WebRoute) => {
    setMobileMenuOpen(false);
    navigate(id);
  };

  return (
    <div className={`web-shell ${userPreferences.compactDensity ? 'web-shell-compact' : ''}`.trim()}>
      {mobileMenuOpen ? (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="Close navigation menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      ) : null}

      <aside className={`web-sidebar ${mobileMenuOpen ? 'web-sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <AppIconBadge size={40} animated interactive />
          <div style={{ minWidth: 0 }}>
            <h1 className="sidebar-brand-title">{actor ? actor.fullName : 'Tracely'}</h1>
            <p className="sidebar-brand-sub">
              {actor ? `${actor.office.code} · ${actor.roleLabel}` : 'Document Custody & QR Tracking'}
            </p>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <span className="sidebar-section-label">WORKSPACE</span>
          {navItems.map((item) => {
            const active = route === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${active ? 'nav-item-active' : ''}`}
                onClick={() => handleNav(item.id)}
              >
                <span className="nav-item-left">
                  {item.icon}
                  <span>{item.label}</span>
                </span>
                {item.badge ? (
                  <span className={`nav-badge ${active ? 'nav-badge-active' : ''}`}>
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}

          <span className="sidebar-section-label" style={{ marginTop: 10 }}>
            ACCOUNT
          </span>
          <button
            type="button"
            className={`nav-item ${route === 'user_profile' ? 'nav-item-active' : ''}`}
            onClick={() => handleNav('user_profile')}
          >
            <span className="nav-item-left">
              <UserCog size={17} />
              <span>User Profile</span>
            </span>
          </button>
          <button
            type="button"
            data-testid="web-sidebar-settings-btn"
            className={`nav-item ${route === 'settings' ? 'nav-item-active' : ''}`}
            onClick={() => handleNav('settings')}
          >
            <span className="nav-item-left">
              <Settings size={17} />
              <span>Settings</span>
            </span>
          </button>
        </nav>

        <div className="sidebar-footer">
          {actor ? (
            <button
              type="button"
              className="nav-item"
              style={{ color: 'var(--rose-text)' }}
              onClick={() => void signOut()}
            >
              <span className="nav-item-left">
                <LogOut size={16} />
                <span>Sign Out</span>
              </span>
            </button>
          ) : (
            <button
              type="button"
              className="nav-item"
              style={{ color: 'var(--navy)' }}
              onClick={() => handleNav('login')}
            >
              <span className="nav-item-left">
                <LogIn size={16} />
                <span>Sign In / Register</span>
              </span>
            </button>
          )}
        </div>
      </aside>

      <div className="web-main">
        <header className="web-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-menu-btn"
              aria-label="Toggle navigation menu"
              onClick={() => setMobileMenuOpen((v) => !v)}
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div>
              <h2 className="topbar-title">{meta.title}</h2>
              <p className="topbar-sub">{meta.sub}</p>
            </div>
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className="topbar-search-btn"
              data-testid="web-quick-search-trigger"
              aria-label="Quick search (Ctrl+K)"
              onClick={() => setQuickSearchOpen(true)}
            >
              <Search size={14} />
              <span className="topbar-search-label">Quick search...</span>
              <kbd className="topbar-search-kbd">Ctrl K</kbd>
            </button>

            <button
              type="button"
              className="topbar-alert-btn"
              aria-label="Open notifications"
              onClick={() => handleNav('alerts')}
            >
              <Bell size={16} />
              {unreadNotificationCount > 0 ? (
                <span data-testid="topbar-alerts-badge" className="topbar-alert-badge">
                  {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                </span>
              ) : null}
            </button>

            {actor ? (
              <div className="server-pill" style={{ cursor: 'default' }}>
                <span className="server-dot" />
                <span className="server-pill-label">
                  {`${actor.office.code} · ${realtimeStatus === 'live' ? 'Live Push' : 'Live'}`}
                </span>
              </div>
            ) : null}

            <button
              type="button"
              className="btn btn-outline"
              disabled={isRefreshing}
              onClick={() => void refreshWorkspace()}
            >
              <RefreshCw size={14} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync'}</span>
            </button>

            {actor ? (
              <button
                type="button"
                data-testid="web-dashboard-user-avatar"
                aria-label={`Open user profile for ${actor.fullName}`}
                title={`${actor.fullName} · ${actor.office.code}`}
                onClick={() => handleNav('user_profile')}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  border: 'none',
                  background: actor.avatarColor || 'var(--navy)',
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {actor.initials}
              </button>
            ) : null}
          </div>
        </header>

        <main className="web-content">{children}</main>
      </div>

      <nav className="mobile-bottom-nav" aria-label="Mobile quick navigation">
        <button
          type="button"
          className={`bottom-nav-tab ${route === 'dashboard' ? 'bottom-nav-tab-active' : ''}`}
          onClick={() => handleNav('dashboard')}
        >
          <LayoutDashboard size={19} />
          <span>Dashboard</span>
        </button>
        <button
          type="button"
          className={`bottom-nav-tab ${route === 'inbox' ? 'bottom-nav-tab-active' : ''}`}
          onClick={() => handleNav('inbox')}
        >
          <Inbox size={19} />
          <span>Inbox</span>
        </button>
        <button
          type="button"
          aria-label="Send"
          className="bottom-nav-center"
          onClick={() => handleNav('send')}
        >
          <span className={`bottom-nav-circle ${route === 'send' ? 'bottom-nav-circle-active' : ''}`}>
            <Send size={18} />
          </span>
          <span>Send</span>
        </button>
        <button
          type="button"
          className={`bottom-nav-tab ${route === 'track' ? 'bottom-nav-tab-active' : ''}`}
          onClick={() => handleNav('track')}
        >
          <MapPin size={19} />
          <span>Track</span>
        </button>
        <button
          type="button"
          className={`bottom-nav-tab ${route === 'sent' ? 'bottom-nav-tab-active' : ''}`}
          onClick={() => handleNav('sent')}
        >
          <FileOutput size={19} />
          <span>Sent</span>
        </button>
      </nav>

      {toast ? (
        <div
          role="status"
          className={`toast-banner ${
            toast.tone === 'success'
              ? 'toast-success'
              : toast.tone === 'error'
                ? 'toast-error'
                : ''
          }`}
        >
          <span style={{ flex: 1 }}>{toast.text}</span>
          {toast.action ? (
            <button
              type="button"
              className="toast-action-btn"
              onClick={() => {
                const actionFn = toast.action?.onClick;
                clearToast();
                actionFn?.();
              }}
            >
              {toast.action.label}
            </button>
          ) : null}
          <button
            type="button"
            className="toast-close"
            aria-label="Dismiss toast"
            onClick={clearToast}
          >
            <X size={15} />
          </button>
        </div>
      ) : null}
      <QuickSearchModal open={quickSearchOpen} onClose={() => setQuickSearchOpen(false)} />
    </div>
  );
};
