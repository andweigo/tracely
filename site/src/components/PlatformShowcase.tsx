import React, { useState } from 'react';
import { ArrowUpRight, Check, Copy, Download } from 'lucide-react';
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
    <section id="platforms" className="section section-paper">
      <div className="container">
        <div className="section-header center">
          <span className="section-kicker">PLATFORMS</span>
          <h2 className="editorial-heading">
            Works on desktop <em>and Android.</em>
          </h2>
          <p>
            Open Tracely in your browser or install the Android app directly on your phone.
          </p>
        </div>

        <div className="platforms-ledger">
          {/* Web Workspace Column */}
          <article className="platform-cell">
            <div className="platform-meta">
              <span>01 / WEB WORKSPACE</span>
              <span>ANY BROWSER</span>
            </div>
            <h3>Tracely Web App</h3>
            <p>
              For office desks, records counters, and leadership dashboards on any browser.
            </p>
            <ul className="platform-list">
              <li>6-character code and mobile-synced QR receiving</li>
              <li>Printable QR routing slips and transmittal manifests</li>
              <li>Single files, bundles, and batch sending</li>
              <li>Office turnaround reports and CSV exports</li>
            </ul>
            <div className="platform-actions">
              <a
                href={SITE_CONFIG.webAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                <span>Open Web App</span>
                <ArrowUpRight size={15} strokeWidth={1.8} />
              </a>
              <a href="#security" className="btn btn-outline">
                <span>Read security spec</span>
              </a>
            </div>
          </article>

          {/* Native Android App + Scannable QR Column */}
          <article className="platform-cell">
            <div className="platform-meta">
              <span>02 / ANDROID NATIVE</span>
              <span>v{SITE_CONFIG.androidVersion}</span>
            </div>
            <h3>Tracely for Android</h3>
            <p>
              Fast QR camera scanning, desktop camera pairing, private alerts, and offline photo
              capture.
            </p>

            <div className="android-qr-panel">
              <div className="android-qr-box">
                <QrMatrixSvg
                  value={SITE_CONFIG.downloadUrl}
                  size={120}
                  label="Scan with your Android phone to download Tracely APK"
                />
              </div>
              <div className="android-qr-copy">
                <span className="qr-kicker">SCAN ON YOUR PHONE</span>
                <p>
                  Point your Android camera here to download{' '}
                  <strong>Tracely v{SITE_CONFIG.androidVersion}</strong>.
                </p>
              </div>
            </div>

            <div className="platform-actions">
              <a
                href={SITE_CONFIG.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                <Download size={15} strokeWidth={1.8} />
                <span>Download Android APK</span>
              </a>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleCopyDownloadLink}
              >
                {copied ? <Check size={14} strokeWidth={1.8} /> : <Copy size={14} strokeWidth={1.8} />}
                <span>{copied ? 'Link Copied' : 'Copy Link'}</span>
              </button>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
};
