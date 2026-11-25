import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FaqItem {
  readonly question: string;
  readonly answer: string;
}

const FAQ_ITEMS: ReadonlyArray<FaqItem> = [
  {
    question: 'Does Tracely support both physical folders and digital files?',
    answer:
      'Yes. Print a QR routing slip for physical folders, or upload single files, bundled packets, or batch dispatches under a tracking code.',
  },
  {
    question: 'How do new staff accounts get access?',
    answer:
      'Staff can register on Web or Android using their Employee ID, email, and office. An administrator reviews and approves the account before access is granted.',
  },
  {
    question: 'How do I install the Tracely Android app?',
    answer:
      'Scan the QR code on this page or open the Android download link, tap Download Tracely APK, and open the file. If prompted, allow installing apps from your browser.',
  },
  {
    question: 'How does Tracely prevent fake receipts or unauthorized viewing?',
    answer:
      'Sent files stay sealed until the receiving office scans the QR code or enters the unlock code. Senders cannot receive their own files, and Confidential files auto-lock after 60 seconds.',
  },
  {
    question: 'What happens if the internet drops?',
    answer:
      'Captured receipt photos and recent tracking info stay saved on your device and sync automatically once you are back online.',
  },
  {
    question: 'Can people outside the office check a document status?',
    answer:
      'Yes. Each document has a public verification link showing its tracking code, current office, and status without revealing private attachments.',
  },
];

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="section section-soft">
      <div className="container container-narrow">
        <div className="section-header center">
          <h2>Common questions</h2>
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
