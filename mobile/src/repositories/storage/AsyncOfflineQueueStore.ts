import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  OfflineAttachment,
  OfflineAttachmentProps,
} from '../../domain/entities/OfflineAttachment';
import type { IOfflineQueueStore } from '../contracts/IOfflineQueueStore';

const OFFLINE_QUEUE_KEY = '@sdo_doctrack/offline_queue';

export class AsyncOfflineQueueStore implements IOfflineQueueStore {
  public async loadQueue(): Promise<OfflineAttachment[]> {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as OfflineAttachmentProps[];
      return parsed.map((props) => new OfflineAttachment(props));
    } catch {
      return [];
    }
  }

  public async saveQueue(items: ReadonlyArray<OfflineAttachment>): Promise<void> {
    await AsyncStorage.setItem(
      OFFLINE_QUEUE_KEY,
      JSON.stringify(items.map((item) => item.toJSON())),
    );
  }

  public async clearQueue(): Promise<void> {
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
  }
}
