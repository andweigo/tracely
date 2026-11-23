import { AuditLogEntry } from '../../domain/entities/AuditLogEntry';
import { AuditLogDto, DocumentMapper } from '../../domain/mappers/DocumentMapper';
import { ApiClient } from '../../network/ApiClient';
import type { IAuditRepository } from '../contracts/IAuditRepository';

export class HttpAuditRepository implements IAuditRepository {
  private readonly _api: ApiClient;

  constructor(api: ApiClient) {
    this._api = api;
  }

  public async listAll(): Promise<ReadonlyArray<AuditLogEntry>> {
    const res = await this._api.get<{ data: AuditLogDto[] }>('/audit-logs');
    return res.data.map(DocumentMapper.toAuditLog);
  }

  public async listByDocument(documentId: string): Promise<ReadonlyArray<AuditLogEntry>> {
    const res = await this._api.get<{ data: AuditLogDto[] }>(
      `/documents/${encodeURIComponent(documentId)}/audit-logs`,
    );
    return res.data.map(DocumentMapper.toAuditLog);
  }
}
