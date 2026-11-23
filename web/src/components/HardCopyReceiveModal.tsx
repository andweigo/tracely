import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Keyboard, Smartphone } from 'lucide-react';
import { useWebApp } from '../state/WebAppContext';
import { isPendingReceiptForActor } from '../utils/sentFilter';
import { ModalDialog } from './Modals';

/**
 * Camera-free Desktop modal for receiving sealed Hard Copy / Hybrid transfers.
 * Instructs the user to scan the printed routing slip with Tracely Mobile (with live
 * auto-sync so Desktop unlocks automatically), while also supporting plug-and-play
 * USB handheld QR scanners and manual Tracking Code entry right inside the modal.
 */
export const HardCopyReceiveModal: React.FC = () => {
  const {
    actor,
    documents,
    hardCopyReceiveDocId,
    closeHardCopyReceive,
    resolveQr,
    acknowledgeReceipt,
    subscribeInstantSync,
    openDocument,
    notify,
    isBusy,
  } = useWebApp();

  const doc = useMemo(
    () =>
      hardCopyReceiveDocId ? documents.find((d) => d.id === hardCopyReceiveDocId) ?? null : null,
    [documents, hardCopyReceiveDocId],
  );

  const [codeInput, setCodeInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!hardCopyReceiveDocId) {
      setCodeInput('');
      setErrorMsg(null);
      setSubmitting(false);
    }
  }, [hardCopyReceiveDocId]);

  const isStillSealed = Boolean(
    doc && (isPendingReceiptForActor(doc, actor) || Boolean(doc.isSealed)),
  );

  // Auto-close & open document when Tracely Mobile scans the printed routing slip
  useEffect(() => {
    if (!hardCopyReceiveDocId || !doc) return;
    if (!isStillSealed) {
      const unlockedId = doc.id;
      closeHardCopyReceive();
      notify('success', 'Hard Copy receipt synced from Tracely Mobile.');
      openDocument(unlockedId);
    }
  }, [hardCopyReceiveDocId, doc, isStillSealed, closeHardCopyReceive, notify, openDocument]);

  // Instant SSE stream (with automatic fallback poll) while waiting for Tracely Mobile scan
  useEffect(() => {
    if (!hardCopyReceiveDocId) return;
    return subscribeInstantSync();
  }, [hardCopyReceiveDocId, subscribeInstantSync]);

  if (!hardCopyReceiveDocId || !doc) return null;

  const latest = doc.transactions[doc.transactions.length - 1] ?? null;
  const fromOffice = latest?.fromOffice ?? doc.originOffice;
  const fromUser = latest?.fromUserName ?? doc.originUserName;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = codeInput.trim();
    if (!clean || submitting || isBusy) return;
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const resolved = await resolveQr(clean);
      if (resolved.kind === 'document_denied') {
        throw new Error(resolved.reason);
      }
      if (resolved.kind !== 'document_authorized') {
        throw new Error("Scan or enter the Tracking Code from the sender's printed routing slip.");
      }
      if (resolved.document.id !== doc.id) {
        throw new Error('This routing code belongs to a different transfer.');
      }
      if (resolved.sentByActor) {
        throw new Error('Senders cannot confirm receipt of their own dispatch.');
      }
      await acknowledgeReceipt(
        doc.id,
        undefined,
        undefined,
        resolved.verificationCode ?? clean,
      );
      setCodeInput('');
      closeHardCopyReceive();
      openDocument(doc.id);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Unable to verify this routing code. Check the printed slip and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalDialog
      open={Boolean(hardCopyReceiveDocId)}
      onClose={closeHardCopyReceive}
      title="Receive Hard Copy"
      subtitle={`From ${fromOffice.code}${fromUser ? ` · ${fromUser}` : ''}${
        doc.copyFormat === 'hybrid' ? ' · Hybrid' : ''
      }`}
    >
      <div className="unlock-qr-stage" data-testid="web-hard-copy-receive-modal">
        <div className="hard-copy-sync-box">
          <span className="hard-copy-sync-icon">
            <Smartphone size={18} />
          </span>
          <div className="hard-copy-sync-copy">
            <strong>Scan the printed routing slip with Tracely Mobile</strong>
            <span>
              Waiting for Tracely Mobile — this record unlocks here automatically once scanned.
            </span>
          </div>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="unlock-fallback-form"
          data-testid="web-hard-copy-code-form"
        >
          <label className="field-label" htmlFor="hard-copy-receive-code-input">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Keyboard size={13} /> Or confirm with USB Scanner / Tracking Code
            </span>
          </label>
          <input
            id="hard-copy-receive-code-input"
            aria-label="Tracking Code or USB Scanner Input"
            className="input mono"
            autoFocus
            value={codeInput}
            onChange={(e) => {
              setCodeInput(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            placeholder="Scan with USB scanner or enter TRC-2026-000142"
          />
          <span className="field-hint">
            USB handheld QR scanners submit automatically on scan, or type the Tracking Code printed
            on the routing slip.
          </span>

          {errorMsg ? (
            <div
              role="alert"
              className="pill pill-rose"
              style={{ borderRadius: 10, padding: '6px 10px' }}
            >
              {errorMsg}
            </div>
          ) : null}

          <button
            type="submit"
            className="btn btn-amber"
            data-testid="web-hard-copy-code-submit"
            disabled={!codeInput.trim() || submitting || isBusy}
            style={{ width: '100%' }}
          >
            <CheckCircle2 size={15} />
            <span>{submitting ? 'Verifying Slip...' : 'Confirm Receipt & Unlock'}</span>
          </button>
        </form>
      </div>
    </ModalDialog>
  );
};
