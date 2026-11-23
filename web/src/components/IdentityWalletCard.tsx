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

interface WebWalletPalette {
  readonly canvasBg: string;
  readonly backStackStart: string;
  readonly backStackEnd: string;
  readonly innerStart: string;
  readonly innerMid: string;
  readonly innerShade: string;
  readonly innerEnd: string;
  readonly earTop: string;
  readonly earBottom: string;
  readonly pocketLight: string;
  readonly pocketBase: string;
  readonly pocketDeep: string;
  readonly pocketEdge: string;
  readonly shadowColor: string;
  readonly stitchStroke: string;
  readonly strapColor: string;
  readonly backGradStart: string;
  readonly backGradMid: string;
  readonly backGradEnd: string;
  readonly controlInk: string;
  readonly controlBorder: string;
}

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return [87, 54, 228];
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return [87, 54, 228];
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

function deriveWebWalletPalette(accentColor?: string): WebWalletPalette {
  const normalized = (accentColor ?? '').trim().toUpperCase();
  if (!normalized || normalized === '#5736E4') {
    return {
      canvasBg: '#F6F5FC',
      backStackStart: '#8B6CEF',
      backStackEnd: '#6D4ED8',
      innerStart: '#BDB0F9',
      innerMid: '#D4CCFF',
      innerShade: '#9A82EC',
      innerEnd: '#846AE2',
      earTop: '#9478FC',
      earBottom: '#6B4CEB',
      pocketLight: '#7C5DFA',
      pocketBase: '#5736E4',
      pocketDeep: '#4324C7',
      pocketEdge: '#6345EE',
      shadowColor: '#371D9E',
      stitchStroke: '#DFD5FF',
      strapColor: '#4C2FD3',
      backGradStart: '#5736E4',
      backGradMid: '#3F21BD',
      backGradEnd: '#29138A',
      controlInk: '#4324C7',
      controlBorder: 'rgba(99, 71, 232, 0.28)',
    };
  }
  const rgb = parseHexRgb(normalized);
  const white: [number, number, number] = [255, 255, 255];
  const black: [number, number, number] = [10, 14, 28];
  const baseHex = mixHex(rgb, white, 0);
  return {
    canvasBg: mixHex(rgb, white, 0.94),
    backStackStart: mixHex(rgb, white, 0.28),
    backStackEnd: mixHex(rgb, white, 0.14),
    innerStart: mixHex(rgb, white, 0.48),
    innerMid: mixHex(rgb, white, 0.64),
    innerShade: mixHex(rgb, white, 0.34),
    innerEnd: mixHex(rgb, white, 0.2),
    earTop: mixHex(rgb, white, 0.34),
    earBottom: mixHex(rgb, white, 0.12),
    pocketLight: mixHex(rgb, white, 0.18),
    pocketBase: baseHex,
    pocketDeep: mixHex(rgb, black, 0.24),
    pocketEdge: mixHex(rgb, white, 0.08),
    shadowColor: mixHex(rgb, black, 0.38),
    stitchStroke: mixHex(rgb, white, 0.78),
    strapColor: mixHex(rgb, black, 0.18),
    backGradStart: baseHex,
    backGradMid: mixHex(rgb, black, 0.24),
    backGradEnd: mixHex(rgb, black, 0.46),
    controlInk: mixHex(rgb, black, 0.14),
    controlBorder: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.28)`,
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

function formatMaskedIdentifier(rawId: string, masked: boolean): string {
  const cleaned = rawId.trim() || 'EMP-2026-5678';
  if (!masked) {
    return cleaned;
  }
  const suffix = cleaned.slice(-4).padStart(4, '0');
  return `••••  ••••  ••••  ${suffix}`;
}

function buildWalletFrontSvgDataUrl(params: {
  displayName: string;
  displayId: string;
  displayOfficeCode: string;
  pocketCaption: string;
  pocketPrimaryText: string;
  actionLabel: string;
  palette: WebWalletPalette;
}): string {
  const { palette } = params;
  const name = escapeXml(params.displayName.slice(0, 26));
  const empId = escapeXml(params.displayId.slice(0, 26));
  const office = escapeXml(params.displayOfficeCode.slice(0, 12));
  const caption = escapeXml(params.pocketCaption.slice(0, 38));
  const primary = escapeXml(params.pocketPrimaryText.slice(0, 22));
  const action = escapeXml(params.actionLabel.slice(0, 18));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="640" viewBox="0 0 900 640">
    <defs>
      <linearGradient id="backCardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${palette.backStackStart}"/>
        <stop offset="100%" stop-color="${palette.backStackEnd}"/>
      </linearGradient>
      <linearGradient id="innerCardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${palette.innerStart}"/>
        <stop offset="38%" stop-color="${palette.innerMid}"/>
        <stop offset="72%" stop-color="${palette.innerShade}"/>
        <stop offset="100%" stop-color="${palette.innerEnd}"/>
      </linearGradient>
      <linearGradient id="sheenGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0"/>
        <stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.32"/>
        <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="pocketGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${palette.pocketLight}"/>
        <stop offset="48%" stop-color="${palette.pocketBase}"/>
        <stop offset="85%" stop-color="${palette.pocketDeep}"/>
        <stop offset="100%" stop-color="${palette.pocketEdge}"/>
      </linearGradient>
      <linearGradient id="earGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${palette.earTop}"/>
        <stop offset="100%" stop-color="${palette.earBottom}"/>
      </linearGradient>
      <filter id="pocketShadow" x="-10%" y="-10%" width="120%" height="125%">
        <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="${palette.shadowColor}" flood-opacity="0.28"/>
      </filter>
    </defs>

    <!-- Card Canvas Background -->
    <rect width="900" height="640" rx="44" fill="${palette.canvasBg}"/>

    <!-- 1. Top Back Stack Card Peeking Behind -->
    <rect x="155" y="64" width="590" height="120" rx="32" fill="url(#backCardGrad)"/>

    <!-- 2. Middle Inner Metallic Card -->
    <g transform="translate(88, 92)">
      <rect x="0" y="0" width="724" height="250" rx="38" fill="url(#innerCardGrad)" stroke="#FFFFFF" stroke-opacity="0.65" stroke-width="2.5"/>
      <rect x="280" y="-40" width="180" height="340" fill="url(#sheenGrad)" transform="rotate(-22 360 120)"/>

      <!-- Top Left: Full Name & Masked Employee ID -->
      <text x="46" y="66" fill="#FFFFFF" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="36" font-weight="700" letter-spacing="-0.5">${name}</text>
      <text x="46" y="106" fill="#FFFFFF" fill-opacity="0.92" font-family="monospace" font-size="25" font-weight="700" letter-spacing="2">${empId}</text>

      <!-- Top Right: Italic Brand Mark & Unit -->
      <text x="678" y="66" text-anchor="end" fill="#FFFFFF" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="38" font-weight="900" font-style="italic" letter-spacing="1.5">TRACELY</text>
      <text x="678" y="104" text-anchor="end" fill="#FFFFFF" fill-opacity="0.9" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="23" font-weight="600">Unit: ${office}</text>
    </g>

    <!-- 3. Front Stitched Wallet Pocket Sleeve -->
    <g transform="translate(46, 168)" filter="url(#pocketShadow)">
      <!-- Left & Right Pocket Ears -->
      <path d="M 0 38 Q 0 0 38 0 L 54 0 L 54 92 L 0 92 Z" fill="url(#earGrad)"/>
      <path d="M 754 0 L 770 0 Q 808 0 808 38 L 808 92 L 754 92 Z" fill="url(#earGrad)"/>

      <!-- Main Curved Concave Pocket Body -->
      <path d="M 0 58 C 200 104, 608 104, 808 58 L 808 342 Q 808 412 738 412 L 70 412 Q 0 412 0 342 Z" fill="url(#pocketGrad)"/>

      <!-- Dashed Stitching Along Curved Top Lip -->
      <path d="M 22 68 C 210 112, 598 112, 786 68" fill="none" stroke="${palette.stitchStroke}" stroke-opacity="0.62" stroke-width="3.2" stroke-dasharray="9 9" stroke-linecap="round"/>

      <!-- Dashed Stitching Around Outer Pocket Perimeter -->
      <path d="M 18 28 L 18 338 Q 18 394 74 394 L 734 394 Q 790 394 790 338 L 790 28" fill="none" stroke="${palette.stitchStroke}" stroke-opacity="0.54" stroke-width="3.2" stroke-dasharray="9 9" stroke-linecap="round"/>

      <!-- Caption & Hero Designation Inside Pocket -->
      <text x="54" y="158" fill="${palette.stitchStroke}" fill-opacity="0.92" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="25" font-weight="500">${caption}</text>
      <text x="54" y="216" fill="#FFFFFF" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="48" font-weight="700" letter-spacing="-0.8">${primary}</text>
      <text x="754" y="216" text-anchor="end" fill="${palette.stitchStroke}" fill-opacity="0.9" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="28" font-weight="700">${office}</text>

      <!-- Bottom Left Glass Pill Button -->
      <rect x="54" y="284" width="276" height="74" rx="37" fill="#FFFFFF" fill-opacity="0.14" stroke="#FFFFFF" stroke-opacity="0.38" stroke-width="2.2"/>
      <text x="192" y="330" text-anchor="middle" fill="#FFFFFF" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="26" font-weight="600">+ ${action}</text>

      <!-- Bottom Right Two Circular Glass Icon Buttons -->
      <circle cx="636" cy="321" r="35" fill="#FFFFFF" fill-opacity="0.13" stroke="#FFFFFF" stroke-opacity="0.36" stroke-width="2.2"/>
      <text x="636" y="331" text-anchor="middle" fill="#FFFFFF" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="27" font-weight="700">⇄</text>

      <circle cx="720" cy="321" r="35" fill="#FFFFFF" fill-opacity="0.13" stroke="#FFFFFF" stroke-opacity="0.36" stroke-width="2.2"/>
      <text x="720" y="330" text-anchor="middle" fill="#FFFFFF" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="24" font-weight="700">◉</text>
    </g>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function buildWalletBackSvgDataUrl(params: {
  displayName: string;
  displayId: string;
  displayOfficeCode: string;
  officeName: string;
  roleLabel: string;
  activeCount: number;
  completedCount: number;
  palette: WebWalletPalette;
}): string {
  const { palette } = params;
  const name = escapeXml(params.displayName.slice(0, 28));
  const empId = escapeXml(params.displayId.slice(0, 28));
  const officeCode = escapeXml(params.displayOfficeCode.slice(0, 12));
  const officeName = escapeXml(params.officeName.slice(0, 34));
  const role = escapeXml(params.roleLabel.slice(0, 26));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="640" viewBox="0 0 900 640">
    <defs>
      <linearGradient id="backGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${palette.backGradStart}"/>
        <stop offset="55%" stop-color="${palette.backGradMid}"/>
        <stop offset="100%" stop-color="${palette.backGradEnd}"/>
      </linearGradient>
    </defs>
    <rect width="900" height="640" rx="44" fill="${palette.canvasBg}"/>
    <g transform="translate(46, 72)">
      <rect width="808" height="496" rx="46" fill="url(#backGrad)"/>
      <rect x="20" y="20" width="768" height="456" rx="36" fill="none" stroke="${palette.stitchStroke}" stroke-opacity="0.48" stroke-width="3" stroke-dasharray="9 9"/>

      <text x="64" y="96" fill="${palette.stitchStroke}" font-family="monospace" font-size="23" font-weight="700" letter-spacing="2">TRACELY VERIFIED CUSTODY PASS</text>
      <text x="744" y="96" text-anchor="end" fill="#FFFFFF" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="34" font-weight="900" font-style="italic">TRACELY</text>

      <line x1="64" y1="128" x2="744" y2="128" stroke="#FFFFFF" stroke-opacity="0.18" stroke-width="2"/>

      <text x="64" y="190" fill="#FFFFFF" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="40" font-weight="800">${name}</text>
      <text x="64" y="232" fill="${palette.stitchStroke}" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="26" font-weight="600">${role} · ${officeCode} (${officeName})</text>
      <text x="64" y="274" fill="#FFFFFF" fill-opacity="0.82" font-family="monospace" font-size="24" font-weight="700">${empId}</text>

      <rect x="64" y="324" width="320" height="112" rx="22" fill="#FFFFFF" fill-opacity="0.1" stroke="#FFFFFF" stroke-opacity="0.24" stroke-width="2"/>
      <text x="94" y="368" fill="${palette.stitchStroke}" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="22" font-weight="600">Active Desk Custody</text>
      <text x="94" y="412" fill="#FFFFFF" font-family="monospace" font-size="36" font-weight="800">${params.activeCount} docs</text>

      <rect x="424" y="324" width="320" height="112" rx="22" fill="#FFFFFF" fill-opacity="0.1" stroke="#FFFFFF" stroke-opacity="0.24" stroke-width="2"/>
      <text x="454" y="368" fill="${palette.stitchStroke}" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="22" font-weight="600">Completed Records</text>
      <text x="454" y="412" fill="#FFFFFF" font-family="monospace" font-size="36" font-weight="800">${params.completedCount} docs</text>
    </g>
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
  lanyardHeight = 310,
  compact = false,
  testId = 'web-identity-wallet-card',
}) => {
  const [masked, setMasked] = useState(defaultMasked);
  const [showMetricsMode, setShowMetricsMode] = useState(false);
  const palette = useMemo(() => deriveWebWalletPalette(accentColor), [accentColor]);

  const displayName = fullName.trim() || 'Your Full Name';
  const displayOfficeCode = officeCode.trim().toUpperCase() || 'OFFICE';
  const displayPosition = position.trim() || 'Designation / Position';
  const displayRole = roleLabel?.trim() || 'Authorized Personnel';
  const displayId = formatMaskedIdentifier(employeeId, masked);

  const pocketCaption = showMetricsMode
    ? 'Active Workspace Custody'
    : email && email.trim()
      ? `${displayRole} · ${
          masked ? '•••@' + (email.split('@')[1] || 'tracely.local') : email.trim()
        }`
      : officeName?.trim() || displayRole;

  const pocketPrimaryText = showMetricsMode
    ? `${(activeDocsCount ?? 0).toLocaleString()} Active · ${(
        completedDocsCount ?? 0
      ).toLocaleString()} Done`
    : displayPosition;

  const frontImage = useMemo(
    () =>
      buildWalletFrontSvgDataUrl({
        displayName,
        displayId,
        displayOfficeCode,
        pocketCaption,
        pocketPrimaryText,
        actionLabel,
        palette,
      }),
    [
      displayName,
      displayId,
      displayOfficeCode,
      pocketCaption,
      pocketPrimaryText,
      actionLabel,
      palette,
    ],
  );

  const backImage = useMemo(
    () =>
      buildWalletBackSvgDataUrl({
        displayName,
        displayId,
        displayOfficeCode,
        officeName: officeName?.trim() || displayOfficeCode,
        roleLabel: displayRole,
        activeCount: activeDocsCount ?? 0,
        completedCount: completedDocsCount ?? 0,
        palette,
      }),
    [
      displayName,
      displayId,
      displayOfficeCode,
      officeName,
      displayRole,
      activeDocsCount,
      completedDocsCount,
      palette,
    ],
  );

  return (
    <div
      data-testid={testId}
      data-accent-color={palette.pocketBase}
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
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: palette.controlInk,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: palette.pocketBase,
              display: 'inline-block',
            }}
          />
          <span>{liveSyncBadge}</span>
        </div>
      ) : null}

      {/* 3D React Bits <Lanyard /> Stage with the themed Wallet Card as its texture */}
      <div
        data-testid={`${testId}-lanyard-stage`}
        style={{
          position: 'relative',
          width: '100%',
          height: compact ? 275 : lanyardHeight,
          borderRadius: 18,
          overflow: 'hidden',
        }}
      >
        <Lanyard
          frontImage={frontImage}
          backImage={backImage}
          orientation="landscape"
          imageFit="cover"
          cardColor={palette.canvasBg}
          strapColor={palette.strapColor}
          metal="silver"
          finish="glossy"
          cornerRadius={0.26}
          size={compact ? 0.64 : 0.62}
          strapLength={0.44}
          breeze={0.35}
          damping={0.55}
          elasticity={0.5}
          interactive={true}
          intro={true}
        />

        {/* Screen-reader-only live bindings (zero visual duplication with the 3D Lanyard card face) */}
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
          <span data-testid={`${testId}-position`}>{pocketPrimaryText}</span>
          <span data-testid={`${testId}-office`}>{displayOfficeCode}</span>
          <span data-testid={`${testId}-caption`}>{pocketCaption}</span>
        </div>

        {/* Minimal Floating Corner Controls (Action + Flip + Privacy Mask) */}
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
                background: 'rgba(255, 255, 255, 0.88)',
                color: palette.controlInk,
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.12)',
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
            title="Switch between Designation and Custody view (or click 3D card to flip)"
            onClick={() => setShowMetricsMode((prev) => !prev)}
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              border: `1px solid ${palette.controlBorder}`,
              background: 'rgba(255, 255, 255, 0.88)',
              color: palette.controlInk,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.12)',
            }}
          >
            <Repeat size={13} />
          </button>
          <button
            type="button"
            data-testid={`${testId}-mask-btn`}
            aria-label={masked ? 'Reveal employee ID' : 'Mask employee ID'}
            title={masked ? 'Reveal Employee ID' : 'Mask Employee ID'}
            onClick={() => setMasked((prev) => !prev)}
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              border: `1px solid ${palette.controlBorder}`,
              background: 'rgba(255, 255, 255, 0.88)',
              color: palette.controlInk,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.12)',
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
