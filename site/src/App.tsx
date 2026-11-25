import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BellOff,
  Clock,
  Download,
  FileStack,
  Fingerprint,
  FolderKanban,
  KeyRound,
  Lock,
  Menu,
  QrCode,
  ScanLine,
  ShieldAlert,
  Smartphone,
  X,
} from 'lucide-react';
import { FaqSection } from './components/FaqSection';
import { HeroCustodyDemo } from './components/HeroCustodyDemo';
import { OrbitalHeroStage } from './components/OrbitalHeroStage';
import { PlatformShowcase } from './components/PlatformShowcase';
import { RoleShowcase } from './components/RoleShowcase';
import { SITE_CONFIG } from './config';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Security', href: '#security' },
  { label: 'Platforms', href: '#platforms' },
] as const;

const PAIN_COMPARISONS = [
  {
    index: '01',
    before: 'Paper logbooks with messy initials and missing times',
    after: 'QR scan receipts logging exactly who received each file and when',
  },
  {
    index: '02',
    before: 'Calling offices one by one to ask who has a folder',
    after: 'Live custody trail showing the current office and deadline at a glance',
  },
  {
    index: '03',
    before: 'Unverified file copies scattered across email and chat',
    after: 'Verified digital packets sealed in transit until the receiving desk scans',
  },
  {
    index: '04',
    before: 'Documents sitting idle whenever an approver is away',
    after: 'Out-of-office delegates and early reminders before due dates slip',
  },
] as const;

const FEATURES = [
  {
    code: '01',
    title: 'Physical & Digital Routing',
    icon: <FileStack size={17} strokeWidth={1.6} />,
    body: 'Print QR routing slips for physical folders or upload single PDFs, bundled packets, and batch dispatches under one code.',
  },
  {
    code: '02',
    title: 'QR-Confirmed Handoffs',
    icon: <ScanLine size={17} strokeWidth={1.6} />,
    body: 'Transfers stay sealed in transit until the receiving office scans the QR code on Android or enters the unlock code.',
  },
  {
    code: '03',
    title: 'Phone-to-Desktop Capture',
    icon: <Smartphone size={17} strokeWidth={1.6} />,
    body: 'Pair your phone to a desktop draft with one scan to photograph paper pages, with automatic sync when back online.',
  },
  {
    code: '04',
    title: 'Deadlines & Delegates',
    icon: <Clock size={17} strokeWidth={1.6} />,
    body: 'Spot due-soon and overdue files early, assign out-of-office delegates, and measure office turnaround times.',
  },
  {
    code: '05',
    title: 'Privacy Controls',
    icon: <Lock size={17} strokeWidth={1.6} />,
    body: 'Set Standard, Restricted, or Confidential access per file, with auto-locking views and private lock-screen alerts.',
  },
  {
    code: '06',
    title: 'Dedicated Admin Portal',
    icon: <FolderKanban size={17} strokeWidth={1.6} />,
    body: 'Approve staff accounts, organize offices and categories, manage signed-in devices, and export reports.',
  },
] as const;

const WORKFLOW_STEPS = [
  {
    num: '01',
    title: 'Register & Seal',
    body: 'Print a QR slip for a physical folder or upload digital files under one tracking code.',
    mark: (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="8" height="8" stroke="currentColor" strokeWidth="1.5" />
        <rect x="5.5" y="5.5" width="3" height="3" fill="currentColor" />
        <rect x="15" y="3" width="8" height="8" stroke="currentColor" strokeWidth="1.5" />
        <rect x="17.5" y="5.5" width="3" height="3" fill="currentColor" />
        <rect x="3" y="15" width="8" height="8" stroke="currentColor" strokeWidth="1.5" />
        <rect x="5.5" y="17.5" width="3" height="3" fill="currentColor" />
        <path d="M15 15h3v3h-3zM20 15h3v3h-3zM15 20h3v3h-3zM20 20h3v3h-3z" fill="currentColor" />
      </svg>
    ),
  },
  {
    num: '02',
    title: 'Send & Scan to Receive',
    body: 'Route the file to the next office. It stays sealed until the receiving staff scans the QR code.',
    mark: (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
        <path d="M3 8V4.5A1.5 1.5 0 0 1 4.5 3H8" stroke="currentColor" strokeWidth="1.5" />
        <path d="M18 3h3.5A1.5 1.5 0 0 1 23 4.5V8" stroke="currentColor" strokeWidth="1.5" />
        <path d="M23 18v3.5a1.5 1.5 0 0 1-1.5 1.5H18" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 23H4.5A1.5 1.5 0 0 1 3 21.5V18" stroke="currentColor" strokeWidth="1.5" />
        <line x1="5" y1="13" x2="21" y2="13" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    num: '03',
    title: 'Track & Complete',
    body: 'Follow deadlines, add remarks, approve or archive, and share a public verification link.',
    mark: (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
        <rect x="4" y="3" width="18" height="20" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8.5 13l3 3 6-6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
        <line x1="8" y1="19" x2="18" y2="19" stroke="currentColor" strokeWidth="1.3" opacity="0.5" />
      </svg>
    ),
  },
] as const;

const SECURITY_PILLARS = [
  {
    code: 'SEC-01',
    icon: <Fingerprint size={16} strokeWidth={1.6} />,
    title: 'File Verification',
    body: 'Every uploaded file and revision is checked automatically so tampering is caught early.',
  },
  {
    code: 'SEC-02',
    icon: <QrCode size={16} strokeWidth={1.6} />,
    title: 'Private QR Codes',
    body: 'Printed QR slips contain only a random token — never document titles or staff details.',
  },
  {
    code: 'SEC-03',
    icon: <ShieldAlert size={16} strokeWidth={1.6} />,
    title: 'No Self-Receipt',
    body: 'Senders cannot confirm receipt of their own dispatches. Only the receiving office can.',
  },
  {
    code: 'SEC-04',
    icon: <Lock size={16} strokeWidth={1.6} />,
    title: 'Confidential View Lock',
    body: 'Confidential files lock automatically after 60 seconds and block unauthorized sharing.',
  },
  {
    code: 'SEC-05',
    icon: <BellOff size={16} strokeWidth={1.6} />,
    title: 'Private Lock-Screen Alerts',
    body: 'Phone and desktop alerts hide document titles until you unlock and open the app.',
  },
  {
    code: 'SEC-06',
    icon: <KeyRound size={16} strokeWidth={1.6} />,
    title: 'Remote Device Sign-Out',
    body: 'Staff and admins can review signed-in browsers or phones and sign them out anytime.',
  },
] as const;

export const App: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeNav, setActiveNav] = useState<string>('#features');

  return (
    <div className="site-root">
      {/* Crisp Architectural Header */}
      <header className="site-header">
        <div className="container header-inner">
          <a href="#top" className="brand-link" aria-label="Tracely Home">
            <img src="/tracely-logo.png" alt="Tracely" className="brand-logo" />
            <span className="brand-wordmark">Tracely</span>
          </a>

          <nav className="nav-links" aria-label="Primary navigation">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`nav-link ${activeNav === link.href ? 'is-active' : ''}`}
                onClick={() => setActiveNav(link.href)}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="header-actions">
            <a
              href={SITE_CONFIG.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-sm"
            >
              <span>Get the app</span>
              <ArrowUpRight size={14} strokeWidth={1.8} />
            </a>
            <button
              type="button"
              className="mobile-menu-btn"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? <X size={19} strokeWidth={1.7} /> : <Menu size={19} strokeWidth={1.7} />}
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
                  onClick={() => {
                    setActiveNav(link.href);
                    setMobileMenuOpen(false);
                  }}
                >
                  {link.label}
                </a>
              ))}
              <a
                href="#simulator"
                className="mobile-nav-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                Custody Trail
              </a>
              <a
                href="#faq"
                className="mobile-nav-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                FAQ
              </a>
              <div className="mobile-drawer-ctas">
                <a
                  href={SITE_CONFIG.webAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>Open Web App</span>
                  <ArrowRight size={15} strokeWidth={1.8} />
                </a>
                <a
                  href={SITE_CONFIG.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Download size={15} strokeWidth={1.8} />
                  <span>Download Android APK</span>
                </a>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <main id="top">
        {/* Editorial Hero */}
        <section className="hero-editorial">
          <div className="container hero-editorial-inner">
            {/* Circular Archival Seal (no AI sparkle — crisp registration crosshair) */}
            <div className="hero-stamp" aria-hidden="true">
              <svg viewBox="0 0 116 116" className="stamp-ring">
                <defs>
                  <path
                    id="tracelyStampCircle"
                    d="M 58, 58 m -40, 0 a 40,40 0 1,1 80,0 a 40,40 0 1,1 -80,0"
                  />
                </defs>
                <text className="stamp-text">
                  <textPath href="#tracelyStampCircle" startOffset="0%">
                    VERIFIED CUSTODY · EVERY OFFICE ·
                  </textPath>
                </text>
              </svg>
              <svg viewBox="0 0 24 24" className="stamp-mark">
                <line x1="12" y1="3" x2="12" y2="21" stroke="#0D3472" strokeWidth="1.2" />
                <line x1="3" y1="12" x2="21" y2="12" stroke="#0D3472" strokeWidth="1.2" />
                <circle cx="12" cy="12" r="3" fill="#FAF9F6" stroke="#0D3472" strokeWidth="1.4" />
              </svg>
            </div>

            <div className="hero-center-copy">
              <h1 className="hero-serif-title">
                A clearer trail
                <br />
                <em className="hero-serif-italic">for every document.</em>
              </h1>
              <p className="hero-serif-sub">
                Track physical folders and digital files across every office with QR handoffs and
                clear deadlines.
              </p>

              <div className="hero-ctas">
                <a
                  href={SITE_CONFIG.webAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-lg"
                >
                  <span>Open Web App</span>
                  <ArrowRight size={15} strokeWidth={1.8} />
                </a>
                <a href="#simulator" className="btn btn-outline btn-lg">
                  <span>See custody trail</span>
                </a>
              </div>
            </div>

            <OrbitalHeroStage />
          </div>
        </section>

        {/* Scroll-Tracked Paper Custody Trail */}
        <section id="simulator" className="section section-paper">
          <div className="container">
            <div className="section-header center simulator-minimal-header">
              <span className="section-kicker">CUSTODY LEDGER</span>
              <h2 className="editorial-heading">
                From one office <em>to the next.</em>
              </h2>
            </div>

            <HeroCustodyDemo />
          </div>
        </section>

        {/* Editorial Comparison Ledger (No Red/Green AI Boxes) */}
        <section className="section section-compact section-stone">
          <div className="container">
            <div className="section-header center">
              <span className="section-kicker">WHY SWITCH</span>
              <h2 className="editorial-heading">
                End the logbook blind spot <em>across every office.</em>
              </h2>
            </div>

            <div className="comparison-ledger">
              <div className="comparison-ledger-head">
                <span className="ledger-col-head muted">Paper &amp; Email Routing</span>
                <span className="ledger-col-head strong">With Tracely QR Custody</span>
              </div>

              {PAIN_COMPARISONS.map((item) => (
                <div key={item.index} className="comparison-ledger-row">
                  <div className="ledger-cell ledger-before">
                    <span className="ledger-num">{item.index}</span>
                    <span>{item.before}</span>
                  </div>
                  <div className="ledger-cell ledger-after">
                    <span className="ledger-check" aria-hidden="true" />
                    <span>{item.after}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Ruled Feature Grid (No Pastel Icon Squares) */}
        <section id="features" className="section section-paper">
          <div className="container">
            <div className="section-header center">
              <span className="section-kicker">CAPABILITIES</span>
              <h2 className="editorial-heading">
                Built for <em>everyday office work.</em>
              </h2>
              <p>
                Move physical folders, digital packets, revisions, and approvals without losing
                track of a single file.
              </p>
            </div>

            <div className="feature-ledger">
              {FEATURES.map((feat) => (
                <article key={feat.code} className="feature-cell">
                  <div className="feature-cell-top">
                    <span className="feature-code">{feat.code}</span>
                    <span className="feature-glyph" aria-hidden="true">
                      {feat.icon}
                    </span>
                  </div>
                  <h3>{feat.title}</h3>
                  <p>{feat.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works — Ruled 3-Step Track */}
        <section id="how-it-works" className="section section-stone">
          <div className="container">
            <div className="section-header center">
              <span className="section-kicker">WORKFLOW</span>
              <h2 className="editorial-heading">
                Three steps from <em>intake to archive.</em>
              </h2>
              <p>
                Every handoff takes seconds and leaves a clear record of where the file is.
              </p>
            </div>

            <div className="workflow-strip">
              {WORKFLOW_STEPS.map((step) => (
                <article key={step.num} className="workflow-step">
                  <div className="workflow-step-head">
                    <span className="workflow-step-num">STEP {step.num}</span>
                    <span className="workflow-step-mark">{step.mark}</span>
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Interactive Role Showcase */}
        <RoleShowcase />

        {/* Matte Deep-Ink Security Spec Sheet (No Gradients, No Glass Cards, No Amber Icon Boxes) */}
        <section id="security" className="section section-ink">
          <div className="container">
            <div className="section-header center light">
              <span className="section-kicker light">SECURITY SPECIFICATION</span>
              <h2 className="editorial-heading light">
                Built for <em>privacy and accountability.</em>
              </h2>
              <p>
                Every file transfer is verified and logged so offices can rely on the record.
              </p>
            </div>

            <div className="security-ledger">
              {SECURITY_PILLARS.map((item) => (
                <article key={item.code} className="security-cell">
                  <div className="security-cell-top">
                    <span className="security-code">{item.code}</span>
                    <span className="security-glyph" aria-hidden="true">
                      {item.icon}
                    </span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>

            <div className="security-footer-bar">
              <span>Every new staff account is reviewed and approved by an administrator before access is granted.</span>
              <a
                href={SITE_CONFIG.webAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="security-link"
              >
                <span>Open Web App</span>
                <ArrowUpRight size={14} strokeWidth={1.8} />
              </a>
            </div>
          </div>
        </section>

        {/* Platforms & Scannable Android APK Download */}
        <PlatformShowcase />

        {/* FAQ Accordion */}
        <FaqSection />

        {/* Final Restraint-Driven CTA Band */}
        <section className="section section-compact section-paper">
          <div className="container">
            <div className="cta-banner">
              <div className="cta-banner-copy">
                <h2 className="editorial-heading light">
                  Bring clarity to <em>every document.</em>
                </h2>
                <p>
                  Open Tracely in your browser or install the Android app on your phone.
                </p>
              </div>
              <div className="cta-banner-actions">
                <a
                  href={SITE_CONFIG.webAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-white btn-lg"
                >
                  <span>Open Web App</span>
                  <ArrowUpRight size={16} strokeWidth={1.8} />
                </a>
                <a
                  href={SITE_CONFIG.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ink-outline btn-lg"
                >
                  <Download size={16} strokeWidth={1.8} />
                  <span>Download Android v{SITE_CONFIG.androidVersion}</span>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Editorial Footer */}
      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="footer-brand">
            <div className="brand-link">
              <img src="/tracely-logo.png" alt="Tracely" className="brand-logo" />
              <span className="brand-wordmark">Tracely</span>
            </div>
            <p className="footer-desc">
              Physical and digital document tracking with QR handoffs and clear deadlines.
            </p>
          </div>

          <div className="footer-cols">
            <div className="footer-col">
              <h4>Product</h4>
              <a href="#features">Capabilities</a>
              <a href="#simulator">Custody Ledger</a>
              <a href="#how-it-works">Workflow</a>
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
              <a href="#platforms">Install via QR Code</a>
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
