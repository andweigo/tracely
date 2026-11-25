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
  Lock,
  Menu,
  Play,
  QrCode,
  ScanLine,
  ShieldAlert,
  Smartphone,
  UserCheck,
  X,
  XCircle,
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
    before: 'Paper logbooks with messy initials and missing times',
    after: 'QR scan receipts that log who received each file and when',
  },
  {
    before: 'Calling offices one by one to ask who has a folder',
    after: 'Live tracking showing the exact office and deadline at a glance',
  },
  {
    before: 'Unverified file copies scattered across email and chat',
    after: 'Verified digital files sealed until the receiving office scans',
  },
  {
    before: 'Documents sitting idle whenever an approver is away',
    after: 'Out-of-office delegates and reminders before deadlines slip',
  },
] as const;

const WORKFLOW_STEPS = [
  {
    num: '01',
    title: 'Register & Seal',
    icon: <QrCode size={19} />,
    body: 'Print a QR slip for a physical folder or upload digital files under one tracking code.',
  },
  {
    num: '02',
    title: 'Send & Scan to Receive',
    icon: <ScanLine size={19} />,
    body: 'Route the file to the next office. It stays sealed until the receiving staff scans the QR code.',
  },
  {
    num: '03',
    title: 'Track & Complete',
    icon: <FileCheck2 size={19} />,
    body: 'Follow deadlines, add remarks, approve or archive, and share a public verification link.',
  },
] as const;

const SECURITY_PILLARS = [
  {
    icon: <Fingerprint size={18} />,
    title: 'File Verification',
    body: 'Every uploaded file and revision is checked automatically so tampering is caught early.',
  },
  {
    icon: <QrCode size={18} />,
    title: 'Private QR Codes',
    body: 'Printed QR slips contain only a random code — never document titles or staff details.',
  },
  {
    icon: <ShieldAlert size={18} />,
    title: 'No Self-Receipt',
    body: 'Senders cannot confirm receipt of their own dispatches. Only the receiving office can.',
  },
  {
    icon: <Lock size={18} />,
    title: 'Confidential View Lock',
    body: 'Confidential files lock automatically after 60 seconds and block unauthorized sharing.',
  },
  {
    icon: <BellOff size={18} />,
    title: 'Private Lock-Screen Alerts',
    body: 'Phone and desktop alerts hide document titles until you unlock and open the app.',
  },
  {
    icon: <KeyRound size={18} />,
    title: 'Remote Device Sign-Out',
    body: 'Staff and admins can review signed-in browsers or phones and sign them out anytime.',
  },
] as const;

export const App: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeNav, setActiveNav] = useState<string>('#features');

  return (
    <div className="site-root">
      {/* Minimalist Floating Pill Header matching template */}
      <header className="site-header">
        <div className="container header-inner">
          <a href="#top" className="brand-link" aria-label="Tracely Home">
            <img src="/tracely-logo.png" alt="Tracely" className="brand-logo" />
            <span className="brand-wordmark">
              Tracely<sup className="brand-deg">°</sup>
            </span>
          </a>

          <nav className="nav-pill" aria-label="Primary navigation">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`nav-pill-link ${activeNav === link.href ? 'is-active' : ''}`}
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
              className="btn btn-navy-pill btn-sm"
            >
              <span>Get the app</span>
              <ArrowUpRight size={14} />
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
                Live Simulator
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
                  className="btn btn-navy-pill"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>Open Web App</span>
                  <ArrowRight size={15} />
                </a>
                <a
                  href={SITE_CONFIG.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-white-pill"
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
        {/* Editorial Centered Hero matching Mindly template in Tracely's Navy/Amber/Teal colorway */}
        <section className="hero-editorial">
          <div className="container hero-editorial-inner">
            {/* Rotating Circular Editorial Stamp (top-right) */}
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
                    VERIFIED CUSTODY • EVERY OFFICE •
                  </textPath>
                </text>
              </svg>
              <svg viewBox="0 0 24 24" className="stamp-star">
                <path
                  d="M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8L12 2Z"
                  fill="#0D3472"
                />
                <circle cx="12" cy="12" r="2" fill="#F3B32A" />
              </svg>
            </div>

            {/* Centered High-Contrast Editorial Serif Headline */}
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

              <div className="hero-pill-ctas">
                <a
                  href={SITE_CONFIG.webAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-navy-pill btn-lg"
                >
                  <span>Open Web App</span>
                  <ArrowRight size={16} />
                </a>
                <a href="#simulator" className="btn btn-white-pill btn-lg">
                  <span className="play-badge" aria-hidden="true">
                    <Play size={10} fill="currentColor" />
                  </span>
                  <span>Try live demo</span>
                </a>
              </div>
            </div>

            {/* Signature Orbital Centerpiece + Tilted Floating Cards + Hairline Arcs */}
            <OrbitalHeroStage />
          </div>
        </section>

        {/* Minimalist Custody-Road Visual Presentation */}
        <section id="simulator" className="section section-editorial-band">
          <div className="container">
            <div className="section-header center simulator-minimal-header">
              <h2 className="editorial-heading">
                From one office <em>to the next.</em>
              </h2>
            </div>

            <HeroCustodyDemo />
          </div>
        </section>

        {/* Problem vs. Tracely Comparison */}
        <section className="section section-compact">
          <div className="container">
            <div className="comparison-shell">
              <div className="comparison-head">
                <h2 className="editorial-heading">
                  End the logbook blind spot <em>across every office.</em>
                </h2>
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
              <h2 className="editorial-heading">
                Built for <em>everyday office work</em>
              </h2>
              <p>
                Move physical folders, digital packets, revisions, and approvals without losing
                track of a single file.
              </p>
            </div>

            <div className="bento-grid">
              <article className="bento-card bento-wide">
                <div className="bento-icon navy">
                  <FileStack size={20} />
                </div>
                <h3>Physical &amp; Digital Routing</h3>
                <p>
                  Print QR routing slips for physical folders or upload single PDFs, bundled files,
                  and batch dispatches in one place.
                </p>
              </article>

              <article className="bento-card bento-wide">
                <div className="bento-icon teal">
                  <ScanLine size={20} />
                </div>
                <h3>QR-Confirmed Handoffs</h3>
                <p>
                  Transfers stay sealed in transit until the receiving office scans the QR code on
                  Android or enters the unlock code. Senders can never mark their own files received.
                </p>
              </article>

              <article className="bento-card">
                <div className="bento-icon amber">
                  <Smartphone size={20} />
                </div>
                <h3>Phone-to-Desktop Capture</h3>
                <p>
                  Pair your phone to a desktop draft with one scan to photograph paper pages, even
                  when offline.
                </p>
              </article>

              <article className="bento-card">
                <div className="bento-icon navy">
                  <Clock size={20} />
                </div>
                <h3>Deadlines &amp; Delegates</h3>
                <p>
                  Spot due-soon and overdue files early, assign out-of-office delegates, and track
                  office turnaround times.
                </p>
              </article>

              <article className="bento-card">
                <div className="bento-icon teal">
                  <Lock size={20} />
                </div>
                <h3>Privacy Controls</h3>
                <p>
                  Set Standard, Restricted, or Confidential access per file, with auto-locking views
                  and private notifications.
                </p>
              </article>

              <article className="bento-card">
                <div className="bento-icon amber">
                  <FolderKanban size={20} />
                </div>
                <h3>Dedicated Admin Portal</h3>
                <p>
                  Approve staff accounts, organize offices and categories, manage devices, and
                  export reports.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="section section-soft">
          <div className="container">
            <div className="section-header center">
              <h2 className="editorial-heading">
                Three steps from <em>intake to archive</em>
              </h2>
              <p>
                Every handoff takes seconds and leaves a clear record of where the file is.
              </p>
            </div>

            <div className="workflow-grid">
              {WORKFLOW_STEPS.map((step) => (
                <article key={step.num} className="workflow-card">
                  <div className="workflow-top">
                    <span className="workflow-num">{step.num}</span>
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

        {/* Enterprise Security Deep Navy Band */}
        <section id="security" className="section section-navy">
          <div className="container">
            <div className="section-header center light">
              <h2 className="editorial-heading light">
                Built for <em>privacy and accountability</em>
              </h2>
              <p>
                Every file transfer is verified and logged so offices can rely on the record.
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
                <span>Every new staff account is reviewed and approved by an admin</span>
              </div>
              <a
                href={SITE_CONFIG.webAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="security-link"
              >
                <span>Open Web App</span>
                <ArrowUpRight size={15} />
              </a>
            </div>
          </div>
        </section>

        {/* Platforms & Scannable Android APK Download */}
        <PlatformShowcase />

        {/* FAQ Accordion */}
        <FaqSection />

        {/* Final Editorial CTA */}
        <section className="section section-compact">
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
                  className="btn btn-amber-pill btn-lg"
                >
                  <span>Open Web App</span>
                  <ArrowUpRight size={17} />
                </a>
                <a
                  href={SITE_CONFIG.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-light-pill btn-lg"
                >
                  <Download size={17} />
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
              <span className="brand-wordmark">
                Tracely<sup className="brand-deg">°</sup>
              </span>
            </div>
            <p className="footer-desc">
              Physical and digital document tracking with QR handoffs and clear deadlines.
            </p>
          </div>

          <div className="footer-cols">
            <div className="footer-col">
              <h4>Product</h4>
              <a href="#features">Core Features</a>
              <a href="#simulator">Custody Presentation</a>
              <a href="#how-it-works">How It Works</a>
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
