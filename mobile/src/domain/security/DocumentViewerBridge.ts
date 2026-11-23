import { NativeModules, Platform } from 'react-native';
import QRCode from 'qrcode';

export interface RenderedPdfResult {
  readonly pageCount: number;
  readonly renderedCount: number;
  readonly localPath: string;
  readonly pageUris: ReadonlyArray<string>;
}

interface DocsTrackViewerNativeModule {
  renderPdfPages(signedUrl: string, fileName: string): Promise<RenderedPdfResult>;
  openExternalViewer(signedUrl: string, fileName: string, mimeType: string): Promise<boolean>;
  clearViewerCache(): Promise<boolean>;
  printRoutingSlipHtml(html: string, jobName: string): Promise<boolean>;
}

export interface PrintableRoutingSlipInput {
  readonly qrPayload: string;
  readonly trackingCode: string;
  readonly title?: string;
  readonly categoryName?: string;
  readonly copyFormatLabel?: string;
  readonly classificationLabel?: string;
  readonly originOfficeLabel?: string;
  readonly currentOfficeLabel?: string;
  readonly issuedDateLabel?: string;
  readonly physicalFolderLabel?: string;
  readonly isConfidential?: boolean;
}

function getNativeViewerModule(): DocsTrackViewerNativeModule | null {
  if (Platform.OS !== 'android') {
    return null;
  }
  const mod = NativeModules?.DocsTrackViewer as Partial<DocsTrackViewerNativeModule> | undefined;
  if (
    !mod ||
    typeof mod.renderPdfPages !== 'function' ||
    typeof mod.openExternalViewer !== 'function' ||
    typeof mod.clearViewerCache !== 'function' ||
    typeof mod.printRoutingSlipHtml !== 'function'
  ) {
    return null;
  }
  return mod as DocsTrackViewerNativeModule;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildQrSvgMarkup(payload: string, sizePx = 152): string {
  const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' });
  const moduleCount = qr.modules.size;
  const quietZone = 3;
  const total = moduleCount + quietZone * 2;
  const rects: string[] = [];

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (qr.modules.get(row, col)) {
        rects.push(`<rect x="${col + quietZone}" y="${row + quietZone}" width="1" height="1" />`);
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#ffffff"/><g fill="#0f172a">${rects.join('')}</g></svg>`;
}

function renderSingleSlipMarkup(
  input: PrintableRoutingSlipInput,
  badgeSuffix = '',
): string {
  const qrSvg = buildQrSvgMarkup(input.qrPayload, 148);
  const safeTitle = input.isConfidential
    ? 'Confidential Record — Scan QR to Verify'
    : input.title?.trim() || 'Tracked Document';

  const metaItems: Array<{ label: string; value: string }> = [
    input.categoryName ? { label: 'Category', value: input.categoryName } : null,
    input.copyFormatLabel ? { label: 'Copy Format', value: input.copyFormatLabel } : null,
    input.originOfficeLabel ? { label: 'Origin Unit', value: input.originOfficeLabel } : null,
    input.currentOfficeLabel ? { label: 'Routed / Current Desk', value: input.currentOfficeLabel } : null,
    input.classificationLabel ? { label: 'Classification', value: input.classificationLabel } : null,
    input.physicalFolderLabel ? { label: 'Physical Folder', value: input.physicalFolderLabel } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  const metaHtml = metaItems
    .map(
      (item) =>
        `<div class="field"><div class="label">${escapeHtml(item.label)}</div><div class="val">${escapeHtml(item.value)}</div></div>`,
    )
    .join('');

  return `<div class="slip">
    <div class="masthead">
      <div class="republic">Tracely &middot; Document Custody &amp; QR Tracking</div>
      <div class="agency">Tracely Official Routing Slip</div>
      <div class="banner">
        <span class="tag">OFFICIAL DOCUMENT ROUTING SLIP${escapeHtml(badgeSuffix)}</span>
        <span class="date">${escapeHtml(input.issuedDateLabel || '')}</span>
      </div>
    </div>
    <div class="body">
      <div class="qr-col">
        <div class="qr-box">${qrSvg}</div>
        <div class="code-label">Tracking Code</div>
        <div class="code-val">${escapeHtml(input.trackingCode)}</div>
      </div>
      <div class="info-col">
        <div class="label">Document Title</div>
        <div class="doc-title">${escapeHtml(safeTitle)}</div>
        <div class="grid">${metaHtml}</div>
      </div>
    </div>
    <div class="receipt-box">
      <div class="receipt-header">RECEIVING OFFICE ACKNOWLEDGMENT &amp; REMARKS (HARD-COPY LOG)</div>
      <div class="receipt-sign-row">
        <div class="receipt-col-lg">
          <div class="label">Received By (Signature over Printed Name)</div>
          <div class="write-line"></div>
        </div>
        <div class="receipt-col">
          <div class="label">Receiving Office / Unit</div>
          <div class="write-line"></div>
        </div>
        <div class="receipt-col">
          <div class="label">Date &amp; Time Received</div>
          <div class="write-line"></div>
        </div>
      </div>
      <div class="remarks-block">
        <div class="label">Receiving Office Remarks / Action Taken</div>
        <div class="write-line"></div>
        <div class="write-line"></div>
      </div>
    </div>
    <div class="footer">
      <span>Scan QR inside Tracely to verify desk custody &amp; confirm receipt.</span>
      <span>Zero PII encoded in QR</span>
    </div>
  </div>`;
}

const SLIP_PRINT_STYLES = `
  @page { margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; font-family: -apple-system, Roboto, Arial, sans-serif; color: #0f172a; background: #ffffff; }
  .slip { max-width: 164mm; margin: 0 auto; border: 1.5px solid #0f172a; background: #ffffff; break-inside: avoid; page-break-inside: avoid; }
  .masthead { background: #0f172a; color: #ffffff; padding: 11px 15px 9px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .republic { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.85; }
  .agency { font-size: 13.5px; font-weight: 800; margin-top: 2px; }
  .banner { margin-top: 7px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.25); display: flex; justify-content: space-between; align-items: center; }
  .tag { font-size: 9.5px; font-weight: 800; letter-spacing: 0.1em; color: #fbbf24; }
  .date { font-size: 10px; font-weight: 700; }
  .body { display: table; width: 100%; padding: 14px; }
  .qr-col { display: table-cell; width: 178px; vertical-align: top; text-align: center; padding-right: 14px; border-right: 1px dashed #cbd5e1; }
  .qr-box { display: inline-block; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px; background: #ffffff; }
  .code-label { margin-top: 8px; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
  .code-val { margin-top: 2px; font-family: monospace; font-size: 12.5px; font-weight: 800; color: #0f172a; }
  .info-col { display: table-cell; vertical-align: top; padding-left: 14px; }
  .label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: #64748b; }
  .doc-title { font-size: 13.5px; font-weight: 800; line-height: 1.3; margin-top: 2px; color: #0f172a; }
  .grid { margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0; display: flex; flex-wrap: wrap; gap: 8px 14px; }
  .field { width: 46%; min-width: 118px; }
  .val { font-size: 11px; font-weight: 600; color: #1e293b; margin-top: 2px; }
  .receipt-box { margin: 0 14px 12px; padding: 9px 11px; border: 1px solid #cbd5e1; border-radius: 6px; background: #f8fafc; }
  .receipt-header { font-size: 8.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 7px; }
  .receipt-sign-row { display: flex; gap: 10px; margin-bottom: 8px; }
  .receipt-col-lg { flex: 1.6; }
  .receipt-col { flex: 1; }
  .remarks-block { margin-top: 2px; }
  .write-line { height: 18px; border-bottom: 1.25px solid #475569; }
  .footer { padding: 7px 14px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9.5px; font-weight: 600; color: #475569; }
  .cutline { max-width: 164mm; margin: 10mm auto; border-top: 1px dashed #94a3b8; text-align: center; font-size: 9.5px; font-weight: 700; color: #64748b; padding-top: 3px; }
  .page-break { break-after: page; page-break-after: always; margin-bottom: 0; }
`;

/**
 * Generates clean, self-contained single-slip HTML for Android PrintManager so only the
 * official institutional QR routing slip prints (zero app chrome).
 */
export function buildRoutingSlipPrintHtml(input: PrintableRoutingSlipInput): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>${SLIP_PRINT_STYLES}</style>
</head>
<body>
  ${renderSingleSlipMarkup(input)}
</body>
</html>`;
}

/**
 * Generates clean 2-up A4 HTML for batch-printing multiple routing slips with dashed cut guides.
 */
export function buildBatchRoutingSlipsPrintHtml(
  inputs: ReadonlyArray<PrintableRoutingSlipInput>,
): string {
  const total = inputs.length;
  const blocks = inputs
    .map((input, idx) => {
      const slipHtml = renderSingleSlipMarkup(input, ` · ${idx + 1} OF ${total}`);
      if (idx === total - 1) return slipHtml;
      const cutClass = idx % 2 === 1 ? 'cutline page-break' : 'cutline';
      return `${slipHtml}<div class="${cutClass}">Cut along dashed line</div>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>${SLIP_PRINT_STYLES}</style>
</head>
<body>
  ${blocks}
</body>
</html>`;
}

export interface TransmittalManifestItem {
  readonly trackingCode: string;
  readonly title: string;
  readonly categoryName: string;
  readonly formatInfo: string;
  readonly destinationLabel: string;
  readonly receivedLabel?: string;
  readonly isConfidential?: boolean;
}

export interface TransmittalSheetInput {
  readonly referenceCode: string;
  readonly issuedDateLabel: string;
  readonly originOfficeLabel: string;
  readonly preparedBy: string;
  readonly verifyQrPayload: string;
  readonly items: ReadonlyArray<TransmittalManifestItem>;
}

/**
 * Generates an official Tracely A4 Transmittal Sheet (Batch Manifest)
 * HTML document for Android PrintManager with verification QR and signatory lines.
 */
export function buildTransmittalSheetPrintHtml(input: TransmittalSheetInput): string {
  const verifySvg = buildQrSvgMarkup(input.verifyQrPayload, 72);
  const rows = input.items
    .map((item, idx) => {
      const safeTitle = item.isConfidential
        ? 'Confidential Record — Verify via Tracely QR'
        : item.title;
      return `<tr>
        <td>${idx + 1}</td>
        <td class="mono">${escapeHtml(item.trackingCode)}</td>
        <td><strong>${escapeHtml(safeTitle)}</strong><div class="sub">${escapeHtml(item.categoryName)}</div></td>
        <td>${escapeHtml(item.formatInfo)}</td>
        <td>${escapeHtml(item.destinationLabel)}</td>
        <td class="sign">${escapeHtml(item.receivedLabel || '________________')}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, Roboto, Arial, sans-serif; color: #0f172a; background: #fff; }
  .sheet { border: 1.5px solid #0f172a; }
  .masthead { background: #0f172a; color: #fff; padding: 12px 16px 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .republic { font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.85; }
  .agency { font-size: 14px; font-weight: 800; margin-top: 2px; }
  .banner { margin-top: 7px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.25); display: flex; justify-content: space-between; align-items: center; }
  .tag { font-size: 10px; font-weight: 800; letter-spacing: 0.09em; color: #fbbf24; }
  .date { font-size: 10px; font-weight: 700; }
  .meta { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 10px 16px; background: #f8fafc; border-bottom: 1px solid #cbd5e1; }
  .label { font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
  .val { font-size: 11px; font-weight: 700; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  th { text-align: left; padding: 7px 8px; background: #f1f5f9; border-bottom: 1.5px solid #cbd5e1; font-size: 9px; text-transform: uppercase; color: #334155; }
  td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  .mono { font-family: monospace; font-weight: 700; font-size: 10px; }
  .sub { font-size: 9px; color: #475569; margin-top: 2px; }
  .sign { white-space: nowrap; color: #475569; font-size: 9.5px; }
  .sigs { display: flex; gap: 28px; padding: 20px 16px 14px; }
  .sig-col { flex: 1; }
  .sig-line { margin-top: 18px; padding-top: 4px; border-top: 1px solid #0f172a; font-size: 11.5px; font-weight: 800; }
  .footer { padding: 7px 16px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9px; color: #475569; font-weight: 600; }
</style>
</head>
<body>
  <div class="sheet">
    <div class="masthead">
      <div class="republic">Tracely &middot; Document Custody &amp; QR Tracking</div>
      <div class="agency">Tracely Official Transmittal Manifest</div>
      <div class="banner">
        <span class="tag">OFFICIAL DOCUMENT TRANSMITTAL SHEET</span>
        <span class="date">Ref: ${escapeHtml(input.referenceCode)} &middot; ${escapeHtml(input.issuedDateLabel)}</span>
      </div>
    </div>
    <div class="meta">
      <div><div class="label">Transmitting Unit</div><div class="val">${escapeHtml(input.originOfficeLabel)}</div></div>
      <div><div class="label">Prepared By</div><div class="val">${escapeHtml(input.preparedBy)}</div></div>
      <div><div class="label">Total Items</div><div class="val">${input.items.length} document(s)</div></div>
      <div style="text-align:center;">${verifySvg}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:24px">#</th>
          <th style="width:128px">Tracking Code</th>
          <th>Document Title / Subject</th>
          <th style="width:82px">Format</th>
          <th style="width:98px">Destination</th>
          <th style="width:105px">Received &amp; Date</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="sigs">
      <div class="sig-col">
        <div class="label">Released / Transmitted By</div>
        <div class="sig-line">${escapeHtml(input.preparedBy)}</div>
        <div class="sub">Signature over Printed Name &amp; Date</div>
      </div>
      <div class="sig-col">
        <div class="label">Received Complete &amp; Verified By</div>
        <div class="sig-line">________________________</div>
        <div class="sub">Receiving Officer &middot; Date &amp; Time</div>
      </div>
    </div>
    <div class="footer">
      <span>Tracely &middot; Official Custody Manifest</span>
      <span>Privacy-Safe Custody Printout</span>
    </div>
  </div>
</body>
</html>`;
}

export class DocumentViewerBridge {
  public static isNativeAvailable(): boolean {
    return getNativeViewerModule() !== null;
  }

  public static async renderPdfPages(
    signedUrl: string,
    fileName: string,
  ): Promise<RenderedPdfResult | null> {
    const mod = getNativeViewerModule();
    if (!mod) return null;
    return mod.renderPdfPages(signedUrl, fileName);
  }

  public static async openExternalViewer(
    signedUrl: string,
    fileName: string,
    mimeType: string,
  ): Promise<boolean> {
    const mod = getNativeViewerModule();
    if (!mod) return false;
    return mod.openExternalViewer(signedUrl, fileName, mimeType);
  }

  public static async clearViewerCache(): Promise<void> {
    const mod = getNativeViewerModule();
    if (!mod) return;
    try {
      await mod.clearViewerCache();
    } catch {
      // Ignore best-effort cleanup errors
    }
  }

  public static async printRoutingSlip(input: PrintableRoutingSlipInput): Promise<boolean> {
    const mod = getNativeViewerModule();
    if (!mod) return false;
    const html = buildRoutingSlipPrintHtml(input);
    const jobName = input.trackingCode
      ? `Tracely Slip ${input.trackingCode}`
      : 'Tracely Routing Slip';
    return mod.printRoutingSlipHtml(html, jobName);
  }

  public static async printBatchRoutingSlips(
    inputs: ReadonlyArray<PrintableRoutingSlipInput>,
  ): Promise<boolean> {
    const mod = getNativeViewerModule();
    if (!mod || inputs.length === 0) return false;
    const html = buildBatchRoutingSlipsPrintHtml(inputs);
    const jobName = `Tracely Batch Slips (${inputs.length})`;
    return mod.printRoutingSlipHtml(html, jobName);
  }

  public static async printTransmittalSheet(input: TransmittalSheetInput): Promise<boolean> {
    const mod = getNativeViewerModule();
    if (!mod || input.items.length === 0) return false;
    const html = buildTransmittalSheetPrintHtml(input);
    return mod.printRoutingSlipHtml(html, `Tracely Transmittal ${input.referenceCode}`);
  }
}
