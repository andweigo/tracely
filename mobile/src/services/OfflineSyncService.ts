import {
  OfflineAttachment,
  OfflineAttachmentTargetType,
} from '../domain/entities/OfflineAttachment';
import { OfflineQueueStatus } from '../domain/enums/DomainEnums';
import type { SanitizedImageResult } from '../domain/security/ImageSanitizer';
import type { IDocumentRepository } from '../repositories/contracts/IDocumentRepository';
import type { IOfflineQueueStore } from '../repositories/contracts/IOfflineQueueStore';

export interface EnqueueCaptureInput {
  readonly targetType: OfflineAttachmentTargetType;
  readonly targetId: string;
  readonly targetLabel: string;
  readonly image: SanitizedImageResult;
  readonly isOnline: boolean;
}

export class OfflineSyncService {
  private readonly _docRepo: IDocumentRepository;
  private readonly _queueStore: IOfflineQueueStore;
  private _queue: OfflineAttachment[] = [];

  constructor(docRepo: IDocumentRepository, queueStore: IOfflineQueueStore) {
    this._docRepo = docRepo;
    this._queueStore = queueStore;
  }

  public async loadPersistedQueue(): Promise<ReadonlyArray<OfflineAttachment>> {
    this._queue = await this._queueStore.loadQueue();
    return [...this._queue];
  }

  public listQueue(): ReadonlyArray<OfflineAttachment> {
    return [...this._queue];
  }

  public getPendingCount(): number {
    return this._queue.filter((item) => item.status !== OfflineQueueStatus.SYNCED).length;
  }

  public async captureAndEnqueueOrSync(input: EnqueueCaptureInput): Promise<OfflineAttachment> {
    const attachment = new OfflineAttachment({
      id: `offq-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      targetType: input.targetType,
      targetId: input.targetId,
      targetLabel: input.targetLabel,
      fileName: input.image.fileName,
      mimeType: input.image.mimeType,
      originalBytes: input.image.originalBytes,
      compressedBytes: input.image.compressedBytes,
      sha256Checksum: input.image.sha256Checksum,
      exifStripped: input.image.exifStripped,
      localUri: input.image.uri,
      status: OfflineQueueStatus.QUEUED,
    });

    this._queue = [attachment, ...this._queue];

    if (input.isOnline) {
      await this._syncSingleItem(attachment);
    }

    await this._queueStore.saveQueue(this._queue);
    return attachment;
  }

  public async retryAllPending(isOnline: boolean): Promise<number> {
    if (!isOnline) return 0;

    let syncedCount = 0;
    for (const item of this._queue) {
      if (item.status === OfflineQueueStatus.QUEUED || item.status === OfflineQueueStatus.FAILED) {
        if (await this._syncSingleItem(item)) {
          syncedCount += 1;
        }
      }
    }
    await this._queueStore.saveQueue(this._queue);
    return syncedCount;
  }

  public async clearLocalQueue(): Promise<void> {
    this._queue = [];
    await this._queueStore.clearQueue();
  }

  private async _syncSingleItem(item: OfflineAttachment): Promise<boolean> {
    item.markUploading();

    try {
      await this._docRepo.uploadMobilePhoto({
        targetType: item.targetType,
        targetId: item.targetId,
        fileUri: item.localUri,
        fileName: item.fileName,
        mimeType: item.mimeType,
        compressedBytes: item.compressedBytes,
        sha256Checksum: item.sha256Checksum,
        exifStripped: item.exifStripped,
      });
      item.markSynced();
      return true;
    } catch (error) {
      item.markFailed(error instanceof Error ? error.message : 'Upload failed.');
      return false;
    }
  }
}
