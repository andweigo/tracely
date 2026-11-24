import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

interface FaqItem {
  readonly question: string;
  readonly answer: string;
}

const FAQ_ITEMS: ReadonlyArray<FaqItem> = [
  {
    question: 'Does Tracely support both physical folders and digital files?',
    answer:
      'Yes. For physical folders, Tracely generates a printable QR routing slip you attach to the packet and scan at each handoff. For digital documents, you can upload single files, multi-file bundles under one QR code, or batch separate documents—each verified with SHA-256 checksums.',
  },
  {
    question: 'How do new staff accounts get access?',
    answer:
      'Team members can self-register on Web or Android with their Employee ID, email, and office assignment. New accounts are held cleanly on a live Pending Approval screen until an ICT Administrator or authorized approver verifies and activates them.',
  },
  {
    question: 'How do I install the Tracely Android app without Google Play?',
    answer:
      'Scan the QR code on this page or open the Android download link on your phone, tap Download Tracely APK, and open the file. If Android prompts you, allow "Install unknown apps" for your browser—the app connects automatically once launched.',
  },
  {
    question: 'How does Tracely prevent unauthorized viewing or fake receipts?',
    answer:
      'Every in-transit document stays sealed until the designated recipient unit scans the opaque QR token or enters the verification code. Senders are strictly blocked from self-receiving their own dispatches, and Confidential documents automatically engage a 60-second session lock.',
  },
  {
    question: 'What happens when mobile internet drops during field or hallway handoffs?',
    answer:
      'Tracely caches your office tracking snapshots and stores captured proof-of-receipt photos in a local offline queue (automatically stripped of GPS/EXIF metadata) that retries and syncs automatically as soon as connectivity returns.',
  },
  {
    question: 'Can external partners or auditors verify a document without an account?',
    answer:
      'Yes. Each registered document carries a privacy-safe public verification link and QR code that displays the tracking code, current office, lifecycle status, milestone count, and truncated integrity hash without exposing confidential attachments.',
  },
];

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="section section-soft">
      <div className="container container-narrow">
        <div className="section-header center">
          <span className="eyebrow">
            <HelpCircle size={13} /> Common Questions
          </span>
          <h2>Everything teams ask before rolling out Tracely</h2>
        </div>

        <div className="faq-list">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={item.question} className={`faq-item ${isOpen ? 'is-open' : ''}`}>
                <button
                  type="button"
                  className="faq-trigger"
                  aria-expanded={isOpen}
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                >
                  <span>{item.question}</span>
                  <ChevronDown size={18} className="faq-chevron" />
                </button>
                {isOpen ? (
                  <div className="faq-body">
                    <p>{item.answer}</p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
