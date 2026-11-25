import React, { useMemo, useState } from 'react';
import { Eye, EyeOff, Plus, Repeat } from 'lucide-react';
import { Lanyard } from './Lanyard';

export interface IdentityWalletCardProps {
  readonly fullName: string;
  readonly employeeId: string;
  readonly position: string;
  readonly officeCode: string;
  readonly officeName?: string;
  readonly roleLabel?: string;
  readonly email?: string;
  readonly accentColor?: string;
  readonly activeDocsCount?: number;
  readonly completedDocsCount?: number;
  readonly actionLabel?: string;
  readonly onActionClick?: () => void;
  readonly liveSyncBadge?: string;
  readonly defaultMasked?: boolean;
  readonly lanyardHeight?: number;
  readonly compact?: boolean;
  readonly testId?: string;
}

interface IdCardPalette {
  readonly stageBg: string;
  readonly headerBase: string;
  readonly headerDeep: string;
  readonly tintBg: string;
  readonly tintBorder: string;
  readonly strapColor: string;
  readonly controlInk: string;
  readonly controlBorder: string;
}

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return [13, 52, 114];
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return [13, 52, 114];
  }
  return [r, g, b];
}

function mixHex(
  rgb: [number, number, number],
  target: [number, number, number],
  amount: number,
): string {
  const r = Math.max(0, Math.min(255, Math.round(rgb[0] + (target[0] - rgb[0]) * amount)));
  const g = Math.max(0, Math.min(255, Math.round(rgb[1] + (target[1] - rgb[1]) * amount)));
  const b = Math.max(0, Math.min(255, Math.round(rgb[2] + (target[2] - rgb[2]) * amount)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function deriveIdCardPalette(accentColor?: string): IdCardPalette {
  const normalized = (accentColor ?? '').trim().toUpperCase();
  const baseHex = /^#[0-9A-F]{6}$/.test(normalized) ? normalized : '#0D3472';
  const rgb = parseHexRgb(baseHex);
  const white: [number, number, number] = [255, 255, 255];
  const dark: [number, number, number] = [9, 18, 36];

  return {
    stageBg: '#F4F6FA',
    headerBase: baseHex,
    headerDeep: mixHex(rgb, dark, 0.34),
    tintBg: mixHex(rgb, white, 0.91),
    tintBorder: mixHex(rgb, white, 0.72),
    strapColor: mixHex(rgb, dark, 0.16),
    controlInk: mixHex(rgb, dark, 0.18),
    controlBorder: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.24)`,
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function extractInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatMaskedIdentifier(rawId: string, masked: boolean): string {
  const cleaned = rawId.trim() || 'EMP-2026-5678';
  if (!masked) {
    return cleaned;
  }
  const suffix = cleaned.slice(-4).padStart(4, '0');
  return `•••• ${suffix}`;
}

function buildBarcodeRects(seed: string, startX: number, y: number, width: number, height: number): string {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const bars: string[] = [];
  let cursor = startX;
  const endX = startX + width;
  let step = 0;
  while (cursor < endX - 6) {
    const bit = ((hash >>> (step % 28)) ^ (step * 7)) & 3;
    const barW = bit === 0 ? 5 : bit === 1 ? 8 : bit === 2 ? 4 : 11;
    const gap = bit === 3 ? 6 : 5;
    if (cursor + barW <= endX) {
      bars.push(`<rect x="${cursor}" y="${y}" width="${barW}" height="${height}" rx="1.5" fill="#0F172A" fill-opacity="0.82"/>`);
    }
    cursor += barW + gap;
    step += 1;
  }
  return bars.join('');
}

function buildPortraitIdFrontSvgDataUrl(params: {
  displayName: string;
  initials: string;
  displayId: string;
  displayOfficeCode: string;
  displayOfficeName: string;
  displayRole: string;
  primarySubtitle: string;
  palette: IdCardPalette;
}): string {
  const { palette } = params;
  const name = escapeXml(params.displayName.slice(0, 26));
  const initials = escapeXml(params.initials);
  const empId = escapeXml(params.displayId.slice(0, 22));
  const officeCode = escapeXml(params.displayOfficeCode.slice(0, 12));
  const officeName = escapeXml(params.displayOfficeName.slice(0, 32));
  const role = escapeXml(params.displayRole.slice(0, 26));
  const subtitle = escapeXml(params.primarySubtitle.slice(0, 30));
  const barcode = buildBarcodeRects(params.displayId + params.displayName, 110, 882, 500, 56);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1012" viewBox="0 0 720 1012">
    <defs>
      <linearGradient id="idHeadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${palette.headerBase}"/>
        <stop offset="100%" stop-color="${palette.headerDeep}"/>
      </linearGradient>
    </defs>

    <!-- Crisp PVC Card Surface -->
    <rect width="720" height="1012" rx="44" fill="#FFFFFF"/>

    <!-- Top Institutional Header Band -->
    <rect x="0" y="0" width="720" height="248" fill="url(#idHeadGrad)"/>
    <circle cx="640" cy="40" r="140" fill="#FFFFFF" fill-opacity="0.06"/>

    <!-- Lanyard Slot Cutout Hint -->
    <rect x="304" y="34" width="112" height="22" rx="11" fill="#0F172A" fill-opacity="0.28"/>

    <!-- Header Brand + Office Code Pill -->
    <text x="52" y="132" fill="#FFFFFF" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="38" font-weight="900" letter-spacing="2">TRACELY</text>
    <text x="52" y="166" fill="#FFFFFF" fill-opacity="0.82" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="18" font-weight="700" letter-spacing="2.4">IDENTIFICATION CARD</text>

    <rect x="520" y="102" width="148" height="52" rx="26" fill="#FFFFFF" fill-opacity="0.16" stroke="#FFFFFF" stroke-opacity="0.34" stroke-width="2"/>
    <text x="594" y="136" text-anchor="middle" fill="#FFFFFF" font-family="monospace" font-size="22" font-weight="800">${officeCode}</text>

    <!-- Portrait Photo / Initials Frame -->
    <rect x="240" y="186" width="240" height="240" rx="120" fill="#FFFFFF"/>
    <rect x="254" y="200" width="212" height="212" rx="106" fill="${palette.tintBg}" stroke="${palette.headerBase}" stroke-width="6"/>
    <text x="360" y="334" text-anchor="middle" fill="${palette.headerBase}" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="82" font-weight="800" letter-spacing="2">${initials}</text>

    <!-- Employee Identity -->
    <text x="360" y="492" text-anchor="middle" fill="#0F172A" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="42" font-weight="800" letter-spacing="-0.6">${name}</text>
    <text x="360" y="538" text-anchor="middle" fill="${palette.headerBase}" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="25" font-weight="700">${subtitle}</text>
    <text x="360" y="578" text-anchor="middle" fill="#64748B" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="22" font-weight="600">${officeName}</text>

    <!-- Divider -->
    <line x1="64" y1="628" x2="656" y2="628" stroke="#E2E8F0" stroke-width="2.5"/>

    <!-- Structured ID Details Block -->
    <rect x="64" y="662" width="592" height="90" rx="20" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="2"/>
    <text x="92" y="698" fill="#64748B" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="16" font-weight="700" letter-spacing="1.6">ID NUMBER</text>
    <text x="92" y="734" fill="#0F172A" font-family="monospace" font-size="26" font-weight="800" letter-spacing="1.4">${empId}</text>

    <rect x="64" y="770" width="592" height="82" rx="20" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="2"/>
    <text x="92" y="804" fill="#64748B" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="16" font-weight="700" letter-spacing="1.6">ROLE</text>
    <text x="92" y="836" fill="#0F172A" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="24" font-weight="700">${role}</text>

    <!-- Scannable ID Barcode -->
    ${barcode}

    <!-- Bottom Color Strip -->
    <rect x="0" y="980" width="720" height="32" fill="url(#idHeadGrad)"/>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function buildPortraitIdBackSvgDataUrl(params: {
  displayName: string;
  displayId: string;
  displayOfficeCode: string;
  officeName: string;
  roleLabel: string;
  emailText: string;
  activeCount: number;
  completedCount: number;
  palette: IdCardPalette;
}): string {
  const { palette } = params;
  const name = escapeXml(params.displayName.slice(0, 28));
  const empId = escapeXml(params.displayId.slice(0, 24));
  const officeCode = escapeXml(params.displayOfficeCode.slice(0, 12));
  const officeName = escapeXml(params.officeName.slice(0, 34));
  const role = escapeXml(params.roleLabel.slice(0, 28));
  const emailText = escapeXml(params.emailText.slice(0, 34));
  const barcode = buildBarcodeRects(`${params.displayId}-${params.displayOfficeCode}`, 110, 816, 500, 62);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1012" viewBox="0 0 720 1012">
    <defs>
      <linearGradient id="idBackStripe" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${palette.headerDeep}"/>
        <stop offset="100%" stop-color="${palette.headerBase}"/>
      </linearGradient>
    </defs>

    <!-- Crisp Back Card Surface -->
    <rect width="720" height="1012" rx="44" fill="#FFFFFF"/>

    <!-- Top Magnetic Stripe -->
    <rect x="0" y="76" width="720" height="86" fill="#0F172A"/>

    <!-- Header -->
    <text x="64" y="220" fill="${palette.headerBase}" font-family="monospace" font-size="18" font-weight="800" letter-spacing="2">TRACELY VERIFIED CUSTODY PASS</text>
    <text x="64" y="268" fill="#0F172A" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="36" font-weight="800">${name}</text>
    <text x="64" y="306" fill="#64748B" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="22" font-weight="600">${officeCode} · ${officeName}</text>

    <line x1="64" y1="340" x2="656" y2="340" stroke="#E2E8F0" stroke-width="2"/>

    <!-- Details -->
    <text x="64" y="392" fill="#64748B" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="17" font-weight="700" letter-spacing="1.4">EMPLOYEE ID</text>
    <text x="64" y="426" fill="#0F172A" font-family="monospace" font-size="25" font-weight="700">${empId}</text>

    <text x="64" y="486" fill="#64748B" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="17" font-weight="700" letter-spacing="1.4">ROLE</text>
    <text x="64" y="520" fill="#0F172A" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="24" font-weight="700">${role}</text>

    <text x="64" y="580" fill="#64748B" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="17" font-weight="700" letter-spacing="1.4">WORK EMAIL</text>
    <text x="64" y="614" fill="#0F172A" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="22" font-weight="600">${emailText}</text>

    <!-- Custody Summary Tiles -->
    <rect x="64" y="662" width="282" height="114" rx="22" fill="${palette.tintBg}" stroke="${palette.tintBorder}" stroke-width="2"/>
    <text x="90" y="704" fill="#475569" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="18" font-weight="700">Active Docs</text>
    <text x="90" y="750" fill="${palette.headerBase}" font-family="monospace" font-size="34" font-weight="800">${params.activeCount}</text>

    <rect x="374" y="662" width="282" height="114" rx="22" fill="${palette.tintBg}" stroke="${palette.tintBorder}" stroke-width="2"/>
    <text x="400" y="704" fill="#475569" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="18" font-weight="700">Completed</text>
    <text x="400" y="750" fill="${palette.headerBase}" font-family="monospace" font-size="34" font-weight="800">${params.completedCount}</text>

    <!-- Barcode & Verification Notice -->
    ${barcode}
    <text x="360" y="924" text-anchor="middle" fill="#64748B" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="17" font-weight="600">Authorized Tracely Personnel Identification</text>

    <rect x="0" y="980" width="720" height="32" fill="url(#idBackStripe)"/>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const IdentityWalletCard: React.FC<IdentityWalletCardProps> = ({
  fullName,
  employeeId,
  position,
  officeCode,
  officeName,
  roleLabel,
  email,
  accentColor,
  activeDocsCount,
  completedDocsCount,
  actionLabel = 'Send Document',
  onActionClick,
  liveSyncBadge,
  defaultMasked = false,
  lanyardHeight = 365,
  compact = false,
  testId = 'web-identity-wallet-card',
}) => {
  const [masked, setMasked] = useState(defaultMasked);
  const [showMetricsMode, setShowMetricsMode] = useState(false);
  const palette = useMemo(() => deriveIdCardPalette(accentColor), [accentColor]);

  const displayName = fullName.trim() || 'Your Full Name';
  const initials = extractInitials(displayName);
  const displayOfficeCode = officeCode.trim().toUpperCase() || 'OFFICE';
  const displayOfficeName = officeName?.trim() || displayOfficeCode;
  const displayPosition = position.trim() || 'Position';
  const displayRole = roleLabel?.trim() || 'Staff';
  const displayId = formatMaskedIdentifier(employeeId, masked);
  const displayEmail =
    email && email.trim()
      ? masked
        ? `•••@${email.split('@')[1] || 'tracely.app'}`
        : email.trim()
      : 'Verified account';

  const primarySubtitle = showMetricsMode
    ? `${(activeDocsCount ?? 0).toLocaleString()} Active · ${(completedDocsCount ?? 0).toLocaleString()} Done`
    : displayPosition;

  const frontImage = useMemo(
    () =>
      buildPortraitIdFrontSvgDataUrl({
        displayName,
        initials,
        displayId,
        displayOfficeCode,
        displayOfficeName,
        displayRole,
        primarySubtitle,
        palette,
      }),
    [
      displayName,
      initials,
      displayId,
      displayOfficeCode,
      displayOfficeName,
      displayRole,
      primarySubtitle,
      palette,
    ],
  );

  const backImage = useMemo(
    () =>
      buildPortraitIdBackSvgDataUrl({
        displayName,
        displayId,
        displayOfficeCode,
        officeName: displayOfficeName,
        roleLabel: displayRole,
        emailText: displayEmail,
        activeCount: activeDocsCount ?? 0,
        completedCount: completedDocsCount ?? 0,
        palette,
      }),
    [
      displayName,
      displayId,
      displayOfficeCode,
      displayOfficeName,
      displayRole,
      displayEmail,
      activeDocsCount,
      completedDocsCount,
      palette,
    ],
  );

  const stageHeight = compact ? Math.max(310, lanyardHeight) : Math.max(350, lanyardHeight);

  return (
    <div
      data-testid={testId}
      data-accent-color={palette.headerBase.toLowerCase()}
      data-orientation="portrait"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        userSelect: 'none',
      }}
    >
      {liveSyncBadge ? (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 6,
            fontSize: 11,
            fontWeight: 700,
            color: palette.controlInk,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: palette.headerBase,
              display: 'inline-block',
            }}
          />
          <span>{liveSyncBadge}</span>
        </div>
      ) : null}

      <div
        data-testid={`${testId}-lanyard-stage`}
        style={{
          position: 'relative',
          width: '100%',
          height: stageHeight,
          borderRadius: 18,
          overflow: 'hidden',
          background: palette.stageBg,
          border: '1px solid var(--border)',
        }}
      >
        <Lanyard
          frontImage={frontImage}
          backImage={backImage}
          orientation="portrait"
          imageFit="cover"
          cardColor="#FFFFFF"
          strapColor={palette.strapColor}
          metal="silver"
          finish="glossy"
          cornerRadius={0.14}
          size={compact ? 0.62 : 0.64}
          strapLength={0.36}
          breeze={0.3}
          damping={0.55}
          elasticity={0.5}
          interactive={true}
          intro={true}
        />

        {/* Screen-reader live bindings */}
        <div
          data-testid={`${testId}-inner-card`}
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          <span data-testid={`${testId}-name`}>{displayName}</span>
          <span data-testid={`${testId}-employee-id`}>{displayId}</span>
          <span data-testid={`${testId}-position`}>{primarySubtitle}</span>
          <span data-testid={`${testId}-office`}>{displayOfficeCode}</span>
          <span data-testid={`${testId}-caption`}>{displayEmail}</span>
        </div>

        {/* Minimal Floating Corner Controls */}
        <div
          style={{
            position: 'absolute',
            right: 12,
            bottom: 10,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            zIndex: 4,
          }}
        >
          {onActionClick ? (
            <button
              type="button"
              data-testid={`${testId}-action-btn`}
              onClick={onActionClick}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 30,
                padding: '0 13px',
                borderRadius: 999,
                border: `1px solid ${palette.controlBorder}`,
                background: 'rgba(255, 255, 255, 0.92)',
                color: palette.controlInk,
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)',
              }}
            >
              <Plus size={13} />
              <span>{actionLabel}</span>
            </button>
          ) : null}

          <button
            type="button"
            data-testid={`${testId}-flip-btn`}
            aria-label="Toggle card view mode"
            title="Switch card view (or click ID card to flip)"
            onClick={() => setShowMetricsMode((prev) => !prev)}
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              border: `1px solid ${palette.controlBorder}`,
              background: 'rgba(255, 255, 255, 0.92)',
              color: palette.controlInk,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)',
            }}
          >
            <Repeat size={13} />
          </button>
          <button
            type="button"
            data-testid={`${testId}-mask-btn`}
            aria-label={masked ? 'Reveal employee ID' : 'Mask employee ID'}
            title={masked ? 'Show ID number' : 'Hide ID number'}
            onClick={() => setMasked((prev) => !prev)}
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              border: `1px solid ${palette.controlBorder}`,
              background: 'rgba(255, 255, 255, 0.92)',
              color: palette.controlInk,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)',
            }}
          >
            {masked ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default IdentityWalletCard;
