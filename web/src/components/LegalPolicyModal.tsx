import React, { useEffect, useState } from 'react';
import { FileText, ShieldCheck } from 'lucide-react';
import {
  LegalDocumentType,
  PRIVACY_POLICY,
  TERMS_AND_CONDITIONS,
} from '../domain/legalPolicies';
import { ModalDialog } from './Modals';

interface LegalPolicyModalProps {
  readonly open: boolean;
  readonly initialTab?: LegalDocumentType;
  readonly onClose: () => void;
}

export const LegalPolicyModal: React.FC<LegalPolicyModalProps> = ({
  open,
  initialTab = 'terms',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<LegalDocumentType>(initialTab);

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  const doc = activeTab === 'terms' ? TERMS_AND_CONDITIONS : PRIVACY_POLICY;

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title={doc.title}
      subtitle={doc.effectiveDate}
    >
      <div
        data-testid="web-legal-policy-modal"
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div className="segmented-control" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'terms'}
            className={`segment-btn ${activeTab === 'terms' ? 'segment-btn-active' : ''}`}
            onClick={() => setActiveTab('terms')}
          >
            <FileText size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
            Terms &amp; Conditions
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'privacy'}
            className={`segment-btn ${activeTab === 'privacy' ? 'segment-btn-active' : ''}`}
            onClick={() => setActiveTab('privacy')}
          >
            <ShieldCheck size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
            Privacy Policy
          </button>
        </div>

        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
          {doc.intro}
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            maxHeight: 360,
            overflowY: 'auto',
            paddingRight: 4,
          }}
        >
          {doc.sections.map((section) => (
            <div
              key={section.heading}
              className="card-soft"
              style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy-ink)' }}>
                {section.heading}
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.58, color: 'var(--text-secondary)' }}>
                {section.body}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </ModalDialog>
  );
};
