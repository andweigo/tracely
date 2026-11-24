import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BellOff,
  CheckCircle2,
  Clock,
  Download,
  FileCheck2,
  FileStack,
  Fingerprint,
  FolderKanban,
  KeyRound,
  Layers,
  Lock,
  Menu,
  QrCode,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { FaqSection } from './components/FaqSection';
import { HeroCustodyDemo } from './components/HeroCustodyDemo';
import { PlatformShowcase } from './components/PlatformShowcase';
import { RoleShowcase } from './components/RoleShowcase';
import { SITE_CONFIG } from './config';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Roles', href: '#roles' },
  { label: 'Security', href: '#security' },
  { label: 'Platforms', href: '#platforms' },
  { label: 'FAQ', href: '#faq' },
] as const;

const PAIN_COMPARISONS = [
  {
    before: 'Handwritten logbooks with illegible initials and missing timestamps',
    after: 'Instant QR scan receipts with immutable user, office, and timestamp records',
  },
  {
    before: 'Hours wasted calling offices to ask "Who has this folder right now?"',
    after: 'Live custody timeline showing exact office holder and SLA countdown in seconds',
  },
  {
    before: 'Unverified file copies floating across email threads and chat apps',
    after: 'SHA-256 checksummed digital bundles sealed until recipient scan unlocks access',
  },
  {
    before: 'Documents stalling on desks whenever an approver goes on leave',
    after: 'Out-of-office delegate routing and automated Due Soon / Overdue escalation alerts',
  },
] as const;

const WORKFLOW_STEPS = [
  {
    num: '01',
    title: 'Register & Seal',
    badge: 'Hard Copy or Digital',
    icon: <QrCode size={20} />,
    body: 'Register a physical folder to print a crisp QR transmittal slip, or upload a SHA-256 verified digital bundle under a unique tracking code.',
  },
  {
    num: '02',
    title: 'Route & Scan to Unlock',
    badge: 'Zero Self-Receipt',
    icon: <ScanLine size={20} />,
    body: 'Dispatch to the destination unit. Custody remains sealed in transit until the receiving officer scans the QR via Android camera or USB desk scanner.',
  },
  {
    num: '03',
    title: 'Track, Approve & Verify',
    badge: 'Audit Ready',
    icon: <FileCheck2 size={20} />,
    body: 'Monitor live SLA health, collaborate with scoped remarks, approve or archive the record, and share privacy-safe public QR verification links.',
  },
] as const;

const SECURITY_PILLARS = [
  {
    icon: <Fingerprint size={18} />,
    title: 'SHA-256 File Integrity',
    body: 'Every uploaded attachment and revision is cryptographically hashed and verifiable through automated Admin integrity sweeps.',
  },
  {
    icon: <QrCode size={18} />,
    title: 'Opaque QR Tokens',
    body: 'Printed slips carry unguessable tokens—never raw document titles, staff names, or sensitive details in plain QR text.',
  },
  {
    icon: <ShieldAlert size={18} />,
    title: 'Sender Self-Receipt Block',
    body: 'Enforced at the API layer so the dispatching user can never forge or self-acknowledge receipt on a recipient’s behalf.',
  },
  {
    icon: <Lock size={18} />,
    title: 'Confidential 60s Session Lock',
    body: 'Confidential tier documents enforce timed access locks and short-lived presigned view grants with zero unauthorized caching.',
  },
  {
    icon: <BellOff size={18} />,
    title: 'Lock-Screen-Safe Alerts',
    body: 'Device and desktop notifications hide sensitive document titles on locked screens, revealing full details only after sign-in.',
  },
  {
    icon: <KeyRound size={18} />,
    title: 'Instant Session Revocation',
    body: 'Staff and ICT Administrators can audit every signed-in browser or phone session and revoke access with one click.',
  },
] as const;

export const App: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="site-root">
      {/* Sticky Navigation */}
      <header className="site-header">
        <div className="container header-inner">
          <a href="#top" className="brand-link" aria-label="Tracely Home">
            <img src="/tracely-logo.png" alt="Tracely" className="brand-logo" />
            <div className="brand-text">
              <span className="brand-name">Tracely</span>
              <span className="brand-sub">Document Custody</span>
            </div>
          </a>

          <nav className="desktop-nav" aria-label="Primary navigation">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="nav-link">
                {link.label}
              </a>
            ))}
          </nav>

          <div className="header-actions">
            <a
              href={SITE_CONFIG.webAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-sm"
            >
              <span>Web App</span>
              <ArrowUpRight size={14} />
            </a>
            <a
              href={SITE_CONFIG.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-sm"
            >
              <Download size={14} />
              <span>Get Android</span>
            </a>
            <button
              type="button"
              className="mobile-menu-btn"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div className="mobile-drawer">
            <div className="container mobile-drawer-inner">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="mobile-nav-link"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="mobile-drawer-ctas">
                <a
                  href={SITE_CONFIG.webAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>Open Web App</span>
                  <ArrowUpRight size={15} />
                </a>
                <a
                  href={SITE_CONFIG.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Download size={15} />
                  <span>Download Android APK</span>
                </a>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <main id="top">
        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-backdrop" aria-hidden="true" />
          <div className="container hero-grid">
            <div className="hero-copy">
              <div className="hero-eyebrow">
                <Sparkles size={13} />
                <span>Web Workspace + Android v{SITE_CONFIG.androidVersion} · Built for Agencies &amp; Enterprise</span>
              </div>
              <h1 className="hero-title">
                Every paper and digital document, <span className="text-accent">accounted for.</span>
              </h1>
              <p className="hero-subtitle">
                Tracely replaces paper logbooks and guesswork with QR-gated custody transfers,
                SHA-256 verified digital bundles, live SLA monitoring, and instant audit trails
                across desktop and Android.
              </p>

              <div className="hero-ctas">
                <a
                  href={SITE_CONFIG.webAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-lg"
                >
                  <span>Launch Web App</span>
                  <ArrowUpRight size={17} />
                </a>
                <a
                  href={SITE_CONFIG.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-amber btn-lg"
                >
                  <Download size={17} />
                  <span>Download Android App</span>
                </a>
              </div>

              <div className="hero-metrics">
                <div className="hero-metric">
                  <strong>Hybrid</strong>
                  <span>Hard Copy + Digital</span>
                </div>
                <div className="hero-metric-divider" aria-hidden="true" />
                <div className="hero-metric">
                  <strong>QR-Gated</strong>
                  <span>Verified Custody Handoffs</span>
                </div>
                <div className="hero-metric-divider" aria-hidden="true" />
                <div className="hero-metric">
                  <strong>SHA-256</strong>
                  <span>Tamper-Evident Files</span>
                </div>
              </div>
            </div>

            <div className="hero-visual">
              <HeroCustodyDemo />
            </div>
          </div>
        </section>

        {/* Problem vs. Tracely Comparison */}
        <section className="section section-compact">
          <div className="container">
            <div className="comparison-shell">
              <div className="comparison-head">
                <span className="eyebrow">Why Organizations Switch</span>
                <h2>End the logbook blind spot across every department</h2>
              </div>
              <div className="comparison-grid">
                <div className="comparison-col comparison-before">
                  <div className="comparison-col-label">
                    <XCircle size={16} />
                    <span>Traditional Paper &amp; Email Routing</span>
                  </div>
                  <ul>
                    {PAIN_COMPARISONS.map((item) => (
                      <li key={item.before}>
                        <XCircle size={15} className="cmp-icon-rose" />
                        <span>{item.before}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="comparison-col comparison-after">
                  <div className="comparison-col-label">
                    <CheckCircle2 size={16} />
                    <span>With Tracely QR Custody</span>
                  </div>
                  <ul>
                    {PAIN_COMPARISONS.map((item) => (
                      <li key={item.after}>
                        <CheckCircle2 size={15} className="cmp-icon-teal" />
                        <span>{item.after}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Capabilities Bento Grid */}
        <section id="features" className="section">
          <div className="container">
            <div className="section-header center">
              <span className="eyebrow">
                <Layers size={13} /> Core Capabilities
              </span>
              <h2>Engineered for real-world custody workflows</h2>
              <p>
                Every feature in Tracely is designed around how offices actually move folders,
                attachments, revisions, and executive approvals day to day.
              </p>
            </div>

            <div className="bento-grid">
              <article className="bento-card bento-wide">
                <div className="bento-icon navy">
                  <FileStack size={20} />
                </div>
                <h3>Hybrid Hard-Copy &amp; Digital Routing</h3>
                <p>
                  Track physical folders with printable QR transmittal slips alongside single PDFs,
                  multi-file bundles (one QR for an entire packet), or batch-dispatched files—all in
                  the same unified ledger.
                </p>
                <div className="bento-chip-row">
                  <span className="bento-chip">Printable QR Slips</span>
                  <span className="bento-chip">Multi-File Bundles</span>
                  <span className="bento-chip">Revision History</span>
                  <span className="bento-chip">A4 Transmittal Manifests</span>
                </div>
              </article>

              <article className="bento-card bento-wide">
                <div className="bento-icon teal">
                  <ScanLine size={20} />
                </div>
                <h3>QR-Gated Custody &amp; Zero Self-Receipt</h3>
                <p>
                  Transfers stay sealed in transit until the destination office scans the QR code on
                  Android or via USB desk scanner (with 6-character code or password fallback).
                  Senders can never self-receive their own handoffs.
                </p>
                <div className="bento-chip-row">
                  <span className="bento-chip">Android Camera Scan</span>
                  <span className="bento-chip">USB 2D Batch Scan</span>
                  <span className="bento-chip">Recall / Undo Safety</span>
                  <span className="bento-chip">Decline Misrouted</span>
                </div>
              </article>

              <article className="bento-card">
                <div className="bento-icon amber">
                  <Smartphone size={20} />
                </div>
                <h3>Desktop–Mobile Camera Pairing</h3>
                <p>
                  Drafting a dispatch on desktop? Pair your phone in one scan to photograph physical
                  pages—automatically compressed, EXIF-stripped, and queued cleanly even offline.
                </p>
              </article>

              <article className="bento-card">
                <div className="bento-icon navy">
                  <Clock size={20} />
                </div>
                <h3>SLA Tracking &amp; Smart Delegation</h3>
                <p>
                  Real-time On Track, Due Soon, and Overdue monitoring with custom category SLA
                  policies, out-of-office delegate routing, and turnaround analytics.
                </p>
              </article>

              <article className="bento-card">
                <div className="bento-icon teal">
                  <Lock size={20} />
                </div>
                <h3>Confidentiality Tiers &amp; Privacy</h3>
                <p>
                  Enforce Standard, Restricted, and Confidential tiers (with 60-second session
                  locks), scoped document comments, and lock-screen-safe notifications.
                </p>
              </article>

              <article className="bento-card">
                <div className="bento-icon amber">
                  <FolderKanban size={20} />
                </div>
                <h3>Dedicated Admin Governance</h3>
                <p>
                  Separate Admin Portal for account approval gates, office &amp; category taxonomy,
                  session revocation, custody overrides, and executive CSV &amp; A4 reporting.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="section section-soft">
          <div className="container">
            <div className="section-header center">
              <span className="eyebrow">
                <ArrowRight size={13} /> How It Works
              </span>
              <h2>Three steps from intake to verifiable completion</h2>
              <p>
                Zero complex setup for staff. Every handoff takes seconds and leaves an indisputable
                digital proof of custody.
              </p>
            </div>

            <div className="workflow-grid">
              {WORKFLOW_STEPS.map((step) => (
                <article key={step.num} className="workflow-card">
                  <div className="workflow-top">
                    <span className="workflow-num">{step.num}</span>
                    <span className="workflow-badge">{step.badge}</span>
                  </div>
                  <div className="workflow-icon-wrap">{step.icon}</div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Interactive Role Showcase */}
        <RoleShowcase />

        {/* Enterprise Security Dark Band */}
        <section id="security" className="section section-navy">
          <div className="container">
            <div className="section-header center light">
              <span className="eyebrow eyebrow-dark">
                <ShieldCheck size={13} /> Security &amp; Governance Architecture
              </span>
              <h2>Built for compliance, auditability, and zero blind spots</h2>
              <p>
                Designed from the ground up for public-sector and enterprise document sensitivity,
                with verifiable integrity at every layer.
              </p>
            </div>

            <div className="security-grid">
              {SECURITY_PILLARS.map((item) => (
                <article key={item.title} className="security-card">
                  <div className="security-icon">{item.icon}</div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>

            <div className="security-footer-bar">
              <div className="security-footer-item">
                <UserCheck size={16} />
                <span>Admin-gated staff onboarding with live Pending Approval status tracking</span>
              </div>
              <a
                href={SITE_CONFIG.adminUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="security-link"
              >
                <span>Explore Admin Portal</span>
                <ArrowUpRight size={15} />
              </a>
            </div>
          </div>
        </section>

        {/* Platforms & Scannable Android APK Download */}
        <PlatformShowcase />

        {/* FAQ Accordion */}
        <FaqSection />

        {/* Final Call to Action */}
        <section className="section section-compact">
          <div className="container">
            <div className="cta-banner">
              <div className="cta-banner-copy">
                <span className="eyebrow eyebrow-dark">Ready to Modernize Custody?</span>
                <h2>Bring complete accountability to every document your team handles.</h2>
                <p>
                  Launch the Tracely Web Workspace right now or install the native Android app on
                  your team’s devices in under a minute.
                </p>
              </div>
              <div className="cta-banner-actions">
                <a
                  href={SITE_CONFIG.webAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-amber btn-lg"
                >
                  <span>Open Web App</span>
                  <ArrowUpRight size={17} />
                </a>
                <a
                  href={SITE_CONFIG.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-light-outline btn-lg"
                >
                  <Download size={17} />
                  <span>Download Android v{SITE_CONFIG.androidVersion}</span>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="footer-brand">
            <div className="brand-link">
              <img src="/tracely-logo.png" alt="Tracely" className="brand-logo" />
              <div className="brand-text">
                <span className="brand-name">Tracely</span>
                <span className="brand-sub">QR Document Custody &amp; Routing</span>
              </div>
            </div>
            <p className="footer-desc">
              Hybrid physical &amp; digital document tracking with QR-gated transfers, SHA-256
              integrity, and real-time SLA oversight.
            </p>
          </div>

          <div className="footer-cols">
            <div className="footer-col">
              <h4>Product</h4>
              <a href="#features">Core Features</a>
              <a href="#how-it-works">How It Works</a>
              <a href="#roles">Team Roles</a>
              <a href="#security">Security</a>
            </div>
            <div className="footer-col">
              <h4>Access</h4>
              <a href={SITE_CONFIG.webAppUrl} target="_blank" rel="noopener noreferrer">
                Tracely Web App
              </a>
              <a href={SITE_CONFIG.downloadUrl} target="_blank" rel="noopener noreferrer">
                Android APK (v{SITE_CONFIG.androidVersion})
              </a>
              <a href={SITE_CONFIG.adminUrl} target="_blank" rel="noopener noreferrer">
                Admin Governance Portal
              </a>
              <a href="#faq">FAQ</a>
            </div>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} Tracely. All rights reserved.</span>
          <span className="footer-mono">Web Workspace · Android Native v{SITE_CONFIG.androidVersion}</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
