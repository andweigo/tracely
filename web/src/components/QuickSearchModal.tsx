import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FileOutput,
  FileText,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  MapPin,
  Search,
  Send,
  Settings,
  UserCheck,
  X,
} from 'lucide-react';
import { DocumentRecord, WebRoute } from '../domain/types';
import { useWebApp } from '../state/WebAppContext';

interface QuickSearchModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

interface QuickRouteOption {
  readonly kind: 'route';
  readonly id: WebRoute;
  readonly label: string;
  readonly subtitle: string;
  readonly icon: React.ReactNode;
}

interface QuickDocumentOption {
  readonly kind: 'document';
  readonly doc: DocumentRecord;
}

type SearchResultItem = QuickDocumentOption | QuickRouteOption;

const QUICK_ROUTES: ReadonlyArray<QuickRouteOption> = [
  { kind: 'route', id: 'dashboard', label: 'Dashboard', subtitle: 'Overview & folder workspace', icon: <LayoutDashboard size={15} /> },
  { kind: 'route', id: 'inbox', label: 'Inbox', subtitle: 'Incoming office custody queue', icon: <Inbox size={15} /> },
  { kind: 'route', id: 'send', label: 'Send Document', subtitle: 'Upload digital file or register hard copy', icon: <Send size={15} /> },
  { kind: 'route', id: 'sent', label: 'Sent Files', subtitle: 'Dispatched files and receipt status', icon: <FileOutput size={15} /> },
  { kind: 'route', id: 'track', label: 'Track Documents', subtitle: 'Look up any tracking code', icon: <MapPin size={15} /> },
  { kind: 'route', id: 'completed', label: 'Completed', subtitle: 'Approved, released, and archived files', icon: <CheckCircle2 size={15} /> },
  { kind: 'route', id: 'analytics', label: 'SLA Analytics', subtitle: 'Turnaround times and bottlenecks', icon: <BarChart3 size={15} /> },
  { kind: 'route', id: 'categories', label: 'Categories', subtitle: 'Shared document categories', icon: <FolderKanban size={15} /> },
  { kind: 'route', id: 'profile', label: 'Profile', subtitle: 'Digital ID card & availability', icon: <UserCheck size={15} /> },
  { kind: 'route', id: 'settings', label: 'Settings', subtitle: 'System overview & workspace info', icon: <Settings size={15} /> },
];

export const QuickSearchModal: React.FC<QuickSearchModalProps> = ({ open, onClose }) => {
  const { documents, openDocument, navigate } = useWebApp();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const results = useMemo<ReadonlyArray<SearchResultItem>>(() => {
    const q = query.trim().toLowerCase();

    const matchedDocs: QuickDocumentOption[] = documents
      .filter((doc) => {
        if (!q) return true;
        const haystack = [
          doc.trackingCode,
          doc.title,
          doc.categoryName,
          doc.currentOffice.code,
          doc.currentOffice.name,
          doc.originOffice.code,
          doc.originOffice.name,
          doc.lifecycleStatus,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, q ? 8 : 5)
      .map((doc) => ({ kind: 'document', doc }));

    const matchedRoutes: QuickRouteOption[] = QUICK_ROUTES.filter((r) => {
      if (!q) return true;
      return `${r.label} ${r.subtitle}`.toLowerCase().includes(q);
    }).slice(0, q ? 5 : 4);

    return [...matchedDocs, ...matchedRoutes];
  }, [documents, query]);

  useEffect(() => {
    setActiveIndex((prev) => (results.length === 0 ? 0 : Math.min(prev, results.length - 1)));
  }, [results.length]);

  if (!open) return null;

  const handleSelect = (item: SearchResultItem) => {
    onClose();
    if (item.kind === 'document') {
      openDocument(item.doc.id);
    } else {
      navigate(item.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length > 0) {
        setActiveIndex((prev) => (prev + 1) % results.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length > 0) {
        setActiveIndex((prev) => (prev - 1 + results.length) % results.length);
      }
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Quick Search"
      data-testid="web-quick-search-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="quick-search-panel">
        <div className="quick-search-input-row">
          <Search size={17} color="var(--text-muted)" />
          <input
            ref={inputRef}
            type="text"
            aria-label="Quick search documents and screens"
            className="quick-search-input"
            placeholder="Search tracking code, title, office, or jump to screen..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
          />
          <button
            type="button"
            className="quick-search-close"
            aria-label="Close quick search"
            onClick={onClose}
          >
            <X size={15} />
          </button>
        </div>

        <div className="quick-search-list" role="listbox">
          {results.length === 0 ? (
            <div className="quick-search-empty">
              No matching documents or views for &ldquo;{query.trim()}&rdquo;.
            </div>
          ) : (
            results.map((item, idx) => {
              const isActive = idx === activeIndex;
              if (item.kind === 'document') {
                return (
                  <button
                    key={`doc-${item.doc.id}`}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    className={`quick-search-row ${isActive ? 'is-active' : ''}`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => handleSelect(item)}
                  >
                    <span className="quick-search-icon quick-search-icon-doc">
                      <FileText size={15} />
                    </span>
                    <span className="quick-search-copy">
                      <span className="quick-search-title">{item.doc.title}</span>
                      <span className="quick-search-sub">
                        <span className="mono">{item.doc.trackingCode}</span> · {item.doc.currentOffice.code} ·{' '}
                        {item.doc.categoryName}
                      </span>
                    </span>
                    <ArrowRight size={14} className="quick-search-arrow" />
                  </button>
                );
              }
              return (
                <button
                  key={`route-${item.id}`}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`quick-search-row ${isActive ? 'is-active' : ''}`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => handleSelect(item)}
                >
                  <span className="quick-search-icon">{item.icon}</span>
                  <span className="quick-search-copy">
                    <span className="quick-search-title">{item.label}</span>
                    <span className="quick-search-sub">{item.subtitle}</span>
                  </span>
                  <ArrowRight size={14} className="quick-search-arrow" />
                </button>
              );
            })
          )}
        </div>

        <div className="quick-search-footer">
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
};
