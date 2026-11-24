import React, { useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Copy,
  Download,
  Globe,
  Monitor,
  QrCode,
  ShieldCheck,
  Smartphone,
  WifiOff,
} from 'lucide-react';
import { SITE_CONFIG } from '../config';
import { QrMatrixSvg } from './QrMatrixSvg';

export const PlatformShowcase: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopyDownloadLink = async () => {
    try {
      await navigator.clipboard.writeText(SITE_CONFIG.downloadUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Ignore clipboard restriction
    }
  };

  return (
    <section id="platforms" className="section">
      <div className="container">
        <div className="section-header center">
          <span className="eyebrow">
            <Globe size={13} /> Multi-Platform Workspace
          </span>
          <h2>Seamless on every desk. Native in every pocket.</h2>
          <p>
            Launch Tracely immediately in any modern browser or install the native Android app
            directly—no Play Store friction required.
          </p>
        </div>

        <div className="platforms-grid">
          {/* Web Workspace Card */}
          <article className="platform-card">
            <div className="platform-card-top">
              <div className="platform-icon navy">
                <Monitor size={22} />
              </div>
              <span className="platform-tag">Browser Workspace</span>
            </div>
            <h3>Tracely Web App</h3>
            <p>
              Built for high-throughput offices, administrative clerks, and leadership dashboards on
              desktop, laptop, or tablet browsers.
            </p>
            <ul className="platform-list">
              <li>Instant 6-character code &amp; mobile-synced QR receiving</li>
              <li>Printable QR routing slips &amp; A4 transmittal manifests</li>
              <li>Multi-file soft-copy bundles &amp; separate batch dispatch</li>
              <li>Live turnaround analytics, CSV exports &amp; desktop alerts</li>
            </ul>
            <div className="platform-actions">
              <a
                href={SITE_CONFIG.webAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                <span>Open Web App</span>
                <ArrowUpRight size={16} />
              </a>
              <a href="#security" className="btn btn-outline">
                <ShieldCheck size={15} />
                <span>Security Specs</span>
              </a>
            </div>
          </article>

          {/* Native Android App + Scannable QR Card */}
          <article className="platform-card platform-card-featured">
            <div className="platform-card-top">
              <div className="platform-icon teal">
                <Smartphone size={22} />
              </div>
              <span className="platform-tag teal-tag">
                Android Native · v{SITE_CONFIG.androidVersion}
              </span>
            </div>
            <h3>Tracely for Android</h3>
            <p>
              Native React Native app with instant camera QR scanning, desktop camera pairing,
              lock-screen-safe alerts, and offline capture queuing.
            </p>

            <div className="android-qr-panel">
              <div className="android-qr-box">
                <QrMatrixSvg
                  value={SITE_CONFIG.downloadUrl}
                  size={132}
                  label="Scan with your Android phone to download Tracely APK"
                />
              </div>
              <div className="android-qr-copy">
                <div className="qr-kicker">
                  <QrCode size={14} />
                  <span>Scan on Your Phone</span>
                </div>
                <p>
                  Point your Android camera at this QR code to open the direct install page for
                  <strong> Tracely v{SITE_CONFIG.androidVersion}</strong>.
                </p>
                <div className="qr-chips">
                  <span>
                    <WifiOff size={12} /> Offline Capture
                  </span>
                  <span>
                    <ShieldCheck size={12} /> Direct Install
                  </span>
                </div>
              </div>
            </div>

            <div className="platform-actions">
              <a
                href={SITE_CONFIG.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-amber"
              >
                <Download size={16} />
                <span>Download Android APK</span>
              </a>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleCopyDownloadLink}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                <span>{copied ? 'Link Copied' : 'Copy Link'}</span>
              </button>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
};
