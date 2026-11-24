import React, { useEffect, useState } from 'react';
import { CheckCircle2, Keyboard, Trash2, X } from 'lucide-react';
import { DocumentRecord } from '../domain/types';
import { useWebApp } from '../state/WebAppContext';
import { ModalDialog } from './Modals';

interface QueuedUsbItem {
  readonly document: DocumentRecord;
  readonly verificationCode: string;
}

/**
 * Rapid desktop USB handheld barcode/QR receiving modal for stacks of physical Hard Copy folders.
 * Clerks scan slips continuously into the focused input and confirm the whole batch in one click.
 */
export const BatchUsbReceiveModal: React.FC = () => {
  const {
    batchUsbReceiveOpen,
    closeBatchUsbReceive,
    resolveQr,
    batchAcknowledgeReceipts,
    isBusy,
  } = useWebApp();

  const [scanInput, setScanInput] = useState('');
  const [queue, setQueue] = useState<ReadonlyArray<QueuedUsbItem>>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (!batchUsbReceiveOpen) {
      setScanInput('');
      setQueue([]);
      setErrorMsg(null);
      setResolving(false);
    }
  }, [batchUsbReceiveOpen]);

  if (!batchUsbReceiveOpen) return null;

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = scanInput.trim();
    if (!clean || resolving || isBusy) return;
    setErrorMsg(null);
    setResolving(true);
    try {
      const resolved = await resolveQr(clean);
      if (resolved.kind === 'document_denied') {
        throw new Error(resolved.reason);
      }
      if (resolved.kind !== 'document_authorized') {
        throw new Error('Scan a document routing slip QR or enter its Tracking Code.');
      }
      if (resolved.sentByActor) {
        throw new Error('Senders cannot confirm receipt of their own dispatch.');
      }
      if (!resolved.pendingForActorOffice) {
        throw new Error(`${resolved.document.trackingCode} is already received or not pending for your office.`);
      }
      const code = resolved.verificationCode ?? clean;
      setQueue((prev) => {
        if (prev.some((item) => item.document.id === resolved.document.id)) {
          return prev;
        }
        return [{ document: resolved.document, verificationCode: code }, ...prev];
      });
      setScanInput('');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to resolve scanned routing slip.',
      );
    } finally {
      setResolving(false);
    }
  };

  const handleConfirmAll = async () => {
    if (queue.length === 0 || isBusy) return;
    setErrorMsg(null);
    try {
      await batchAcknowledgeReceipts(
        queue.map((item) => ({
          documentId: item.document.id,
          verificationCode: item.verificationCode,
        })),
      );
      setQueue([]);
      closeBatchUsbReceive();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to confirm batch receipts.');
    }
  };

  return (
    <ModalDialog
      open={batchUsbReceiveOpen}
      onClose={closeBatchUsbReceive}
      title="Batch Code Receive"
      subtitle="Enter or paste Tracking Codes from printed routing slips to confirm multiple receipts at once"
    >
      <div
        data-testid="web-batch-usb-receive-modal"
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <form
          onSubmit={(e) => void handleScanSubmit(e)}
          data-testid="web-batch-usb-form"
          style={{ display: 'flex', gap: 8 }}
        >
          <input
            aria-label="Batch Tracking Code Input"
            className="input mono"
            autoFocus
            value={scanInput}
            onChange={(e) => {
              setScanInput(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            placeholder="Enter Tracking Code (e.g. TRC-2026-000142)..."
            style={{ flex: 1 }}
          />
          <button
            type="submit"
            className="btn btn-outline"
            disabled={!scanInput.trim() || resolving || isBusy}
          >
            <Keyboard size={14} /> {resolving ? 'Checking...' : 'Add'}
          </button>
        </form>

        {errorMsg ? (
          <div
            role="alert"
            className="pill pill-rose"
            style={{ borderRadius: 10, padding: '7px 11px' }}
          >
            {errorMsg}
          </div>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="section-header-row">
            <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text-primary)' }}>
              Verified Queue ({queue.length})
            </span>
            {queue.length > 0 ? (
              <button
                type="button"
                className="sealed-qr-decline-link"
                onClick={() => setQueue([])}
              >
                <Trash2 size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                Clear all
              </button>
            ) : null}
          </div>

          {queue.length === 0 ? (
            <div className="card-soft" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              No slips scanned yet. Keep your cursor in the box above and scan physical routing
              slips one after another.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
              {queue.map((item) => (
                <div
                  key={item.document.id}
                  data-testid={`usb-batch-item-${item.document.id}`}
                  className="card-soft"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '9px 12px',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="mono" style={{ fontSize: 12, fontWeight: 800, color: 'var(--navy)' }}>
                      {item.document.trackingCode}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.document.title}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="icon-circle-btn"
                    aria-label={`Remove ${item.document.trackingCode}`}
                    onClick={() =>
                      setQueue((prev) => prev.filter((q) => q.document.id !== item.document.id))
                    }
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn btn-outline" onClick={closeBatchUsbReceive}>
            Close
          </button>
          <button
            type="button"
            className="btn btn-amber"
            data-testid="web-batch-usb-confirm-all"
            disabled={queue.length === 0 || isBusy}
            onClick={() => void handleConfirmAll()}
          >
            <CheckCircle2 size={15} /> Confirm All Receipt ({queue.length})
          </button>
        </div>
      </div>
    </ModalDialog>
  );
};
