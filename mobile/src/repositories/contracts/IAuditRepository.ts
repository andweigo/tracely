import { AuditLogEntry } from '../../domain/entities/AuditLogEntry';

/**
 * Append-only audit repository contract (read-only from mobile client).
 */
export interface IAuditRepository {
  listAll(): Promise<ReadonlyArray<AuditLogEntry>>;
  listByDocument(documentId: string): Promise<ReadonlyArray<AuditLogEntry>>;
}
