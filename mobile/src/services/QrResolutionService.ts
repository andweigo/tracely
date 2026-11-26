import { Personnel } from '../domain/entities/Personnel';
import { DocumentAccessPolicy } from '../domain/security/AccessPolicy';
import {
  QrPayloadParser,
  QrResolutionResult,
} from '../domain/security/QrPayload';
import type { IDocumentRepository } from '../repositories/contracts/IDocumentRepository';

/**
 * Polymorphically resolves scanned opaque QR tokens through the backend API & policy guard.
 */
export class QrResolutionService {
  private readonly _docRepo: IDocumentRepository;
  private readonly _policy: DocumentAccessPolicy;

  constructor(
    docRepo: IDocumentRepository,
    policy: DocumentAccessPolicy = new DocumentAccessPolicy(),
  ) {
    this._docRepo = docRepo;
    this._policy = policy;
  }

  public async resolveRawQr(
    actor: Personnel,
    rawQrValue: string,
    expectedDocumentId?: string | null,
  ): Promise<QrResolutionResult> {
    const payload = QrPayloadParser.parse(rawQrValue);
    return payload.execute({
      actor,
      policy: this._policy,
      backend: this._docRepo,
      expectedDocumentId,
    });
  }
}
