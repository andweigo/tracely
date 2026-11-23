import { OfflineAttachment } from '../../domain/entities/OfflineAttachment';

export interface IOfflineQueueStore {
  loadQueue(): Promise<OfflineAttachment[]>;
  saveQueue(items: ReadonlyArray<OfflineAttachment>): Promise<void>;
  clearQueue(): Promise<void>;
}
