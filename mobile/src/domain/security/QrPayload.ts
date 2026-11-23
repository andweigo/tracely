import { DomainRuleError } from '../base/DomainRuleError';
import { Document } from '../entities/Document';
import { Personnel } from '../entities/Personnel';
import { DocumentAccessPolicy } from './AccessPolicy';

export type QrScenarioKind =
  | 'document_record'
  | 'desktop_attach_pair'
  | 'transmittal_verify'
  | 'unlock_challenge';

export interface DesktopPairingSession {
  readonly pairToken: string;
  readonly ownerUserId: string;
  readonly draftLabel: string;
  readonly expiresAt: string;
}

export interface QrResolutionBackend {
  resolveDocumentQr(opaqueToken: string): Promise<Document>;
  resolveDesktopPairingQr(opaqueToken: string): Promise<DesktopPairingSession>;
  consumeUnlockChallenge?(codeOrToken: string): Promise<Document>;
  verifyTransmittalQr(opaqueToken: string): Promise<{
    readonly trackingCode: string;
    readonly lifecycleStatus: string;
    readonly currentOfficeName: string;
    readonly latestChecksumShort: string;
    readonly milestoneCount: number;
  }>;
}

export interface QrResolutionContext {
  readonly actor: Personnel;
  readonly policy: DocumentAccessPolicy;
  readonly backend: QrResolutionBackend;
}

export type QrResolutionResult =
  | {
      readonly kind: 'document_authorized';
      readonly document: Document;
      readonly pendingForActorOffice: boolean;
      readonly sentByActor?: boolean;
      readonly verificationCode?: string;
      readonly unlockedViaSync?: boolean;
    }
  | {
      readonly kind: 'document_denied';
      readonly trackingCode: string;
      readonly reason: string;
    }
  | {
      readonly kind: 'desktop_pair_ready';
      readonly pairing: DesktopPairingSession;
    }
  | {
      readonly kind: 'transmittal_verified';
      readonly trackingCode: string;
      readonly lifecycleStatus: string;
      readonly currentOfficeName: string;
      readonly latestChecksumShort: string;
      readonly milestoneCount: number;
    };

/**
 * Abstract polymorphic QR token representation (Abstraction).
 * Never stores sensitive document PII inside QR codes.
 */
export abstract class QrPayload {
  private readonly _rawValue: string;
  private readonly _opaqueToken: string;

  protected constructor(rawValue: string, opaqueToken: string) {
    this._rawValue = rawValue.trim();
    this._opaqueToken = opaqueToken.trim();
  }

  public get rawValue(): string {
    return this._rawValue;
  }

  public get opaqueToken(): string {
    return this._opaqueToken;
  }

  public abstract get scenario(): QrScenarioKind;
  public abstract execute(context: QrResolutionContext): Promise<QrResolutionResult>;
}

export class DocumentQrPayload extends QrPayload {
  public readonly scenario: QrScenarioKind = 'document_record';

  constructor(rawValue: string, opaqueToken: string) {
    super(rawValue, opaqueToken);
  }

  public async execute(context: QrResolutionContext): Promise<QrResolutionResult> {
    const document = await context.backend.resolveDocumentQr(this.opaqueToken);
    const decision = context.policy.authorize(context.actor, document);
    if (!decision.allowed) {
      return {
        kind: 'document_denied',
        trackingCode: document.trackingCode,
        reason: decision.reason,
      };
    }

    const latest = document.latestTransaction;
    const sentByActor = Boolean(latest?.isPendingSentBy(context.actor.id));
    const pendingForActorOffice = Boolean(latest?.canBeAcknowledgedBy(context.actor));

    return {
      kind: 'document_authorized',
      document,
      pendingForActorOffice,
      sentByActor,
      verificationCode: document.qrToken || this.opaqueToken,
    };
  }
}

export class DesktopPairQrPayload extends QrPayload {
  public readonly scenario: QrScenarioKind = 'desktop_attach_pair';

  constructor(rawValue: string, opaqueToken: string) {
    super(rawValue, opaqueToken);
  }

  public async execute(context: QrResolutionContext): Promise<QrResolutionResult> {
    const pairing = await context.backend.resolveDesktopPairingQr(this.opaqueToken);
    if (new Date(pairing.expiresAt).getTime() < Date.now()) {
      throw new DomainRuleError(
        'PAIR_TOKEN_EXPIRED',
        'Desktop pairing QR expired. Generate a fresh QR on your desktop session.',
      );
    }
    if (pairing.ownerUserId !== context.actor.id) {
      throw new DomainRuleError(
        'PAIR_USER_MISMATCH',
        'Pairing token belongs to another personnel session and cannot be used.',
      );
    }

    return {
      kind: 'desktop_pair_ready',
      pairing,
    };
  }
}

export class TransmittalVerifyQrPayload extends QrPayload {
  public readonly scenario: QrScenarioKind = 'transmittal_verify';

  constructor(rawValue: string, opaqueToken: string) {
    super(rawValue, opaqueToken);
  }

  public async execute(context: QrResolutionContext): Promise<QrResolutionResult> {
    const verified = await context.backend.verifyTransmittalQr(this.opaqueToken);
    return {
      kind: 'transmittal_verified',
      ...verified,
    };
  }
}

export class UnlockChallengeQrPayload extends QrPayload {
  public readonly scenario: QrScenarioKind = 'unlock_challenge';

  constructor(rawValue: string, opaqueToken: string) {
    super(rawValue, opaqueToken);
  }

  public async execute(context: QrResolutionContext): Promise<QrResolutionResult> {
    if (!context.backend.consumeUnlockChallenge) {
      throw new DomainRuleError(
        'UNLOCK_CHALLENGE_UNSUPPORTED',
        'Paired Web-to-Mobile unlock is unavailable on this server.',
      );
    }
    const document = await context.backend.consumeUnlockChallenge(this.opaqueToken);
    return {
      kind: 'document_authorized',
      document,
      pendingForActorOffice: false,
      sentByActor: false,
      unlockedViaSync: true,
    };
  }
}

export class QrPayloadParser {
  public static parse(rawScan: string): QrPayload {
    const trimmed = rawScan.trim();
    if (!trimmed) {
      throw new DomainRuleError(
        'UNRECOGNIZED_QR',
        'Enter a 6-char Web unlock code, tracking code, or QR token.',
      );
    }

    const upper = trimmed.toUpperCase();
    for (const prefix of ['TRC-QR:UNLOCK:', 'SDO-QR:UNLOCK:']) {
      if (upper.startsWith(prefix)) {
        const token = trimmed.slice(prefix.length).trim();
        if (token.length >= 6) return new UnlockChallengeQrPayload(trimmed, token);
      }
    }
    for (const prefix of ['TRC-QR:DOC:', 'SDO-QR:DOC:']) {
      if (upper.startsWith(prefix)) {
        const token = trimmed.slice(prefix.length).trim();
        if (token.length >= 4) return new DocumentQrPayload(trimmed, token);
      }
    }
    for (const prefix of ['TRC-QR:PAIR:', 'SDO-QR:PAIR:']) {
      if (upper.startsWith(prefix)) {
        const token = trimmed.slice(prefix.length).trim();
        if (token.length >= 6) return new DesktopPairQrPayload(trimmed, token);
      }
    }
    for (const prefix of ['TRC-QR:VERIFY:', 'SDO-QR:VERIFY:']) {
      if (upper.startsWith(prefix)) {
        const token = trimmed.slice(prefix.length).trim();
        if (token.length >= 4) return new TransmittalVerifyQrPayload(trimmed, token);
      }
    }

    // Manual entry: 6-character paired Web unlock short code (e.g. K7P-492 or K7P492)
    if (/^[2-9A-HJ-NP-Z]{3}-?[2-9A-HJ-NP-Z]{3}$/i.test(trimmed)) {
      const compact = upper.replace(/-/g, '');
      const formatted = `${compact.slice(0, 3)}-${compact.slice(3)}`;
      return new UnlockChallengeQrPayload(trimmed, formatted);
    }

    // Manual entry: human-readable tracking code (e.g. TRC-2026-000142 or legacy SDO-OM-2026-000142)
    if (/^(?:TRC|SDO)-[A-Z0-9]{2,8}(?:-[A-Z0-9]+)+$/i.test(trimmed)) {
      return new DocumentQrPayload(trimmed, upper);
    }

    // Manual entry: raw desktop pairing token
    if (/^pair-[a-z0-9_-]{6,64}$/i.test(trimmed)) {
      return new DesktopPairQrPayload(trimmed, trimmed);
    }

    // Manual entry: raw opaque hex or prefixed document token
    if (
      /^[0-9a-f]{16,64}$/i.test(trimmed) ||
      /^(?:qr_|tok_|opaque)[a-z0-9_-]{4,64}$/i.test(trimmed)
    ) {
      return new DocumentQrPayload(trimmed, trimmed);
    }

    throw new DomainRuleError(
      'UNRECOGNIZED_QR',
      'Enter a valid 6-char Web unlock code (e.g. K7P-492), Tracely tracking code (e.g. TRC-2026-000142), or opaque QR token.',
    );
  }
}
