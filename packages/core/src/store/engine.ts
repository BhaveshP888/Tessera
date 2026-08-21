import type {
  Bookmark,
  Collection,
  CreateBookmarkInput,
  SyncDelta,
  Tag,
  UpdateBookmarkInput,
  VaultConfig,
} from '@tessera/schemas';
import {
  base64ToUint8Array,
  generateMasterKey,
  uint8ArrayToBase64,
  deriveRecordKey,
} from '../crypto/keys.js';
import { sealRecord, unsealRecord } from '../crypto/cipher.js';
import { VaultSessionManager } from '../crypto/vault-session.js';
import { incrementVectorClock } from '../sync/vector-clock.js';
import { reconcileBookmark } from '../sync/lww.js';

export interface IStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStorageAdapter implements IStorageAdapter {
  private store = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  public removeItem(key: string): void {
    this.store.delete(key);
  }
}

export class BrowserLocalStorageAdapter implements IStorageAdapter {
  public getItem(key: string): string | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  }

  public setItem(key: string, value: string): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(key, value);
  }

  public removeItem(key: string): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(key);
  }
}

export interface LocalStoreEngineOptions {
  storage?: IStorageAdapter;
  prefix?: string;
  syncServerUrl?: string;
  deviceId?: string;
  fetchFn?: typeof fetch;
}

export interface FullBackupPayload {
  type: string;
  version: number;
  exportedAt: string;
  masterKey: string;
  bookmarks: Bookmark[];
  tags: Tag[];
  collections: Collection[];
  vaultConfig?: VaultConfig;
}

/**
 * Deep storage and synchronization engine.
 * Encapsulates vector clocks, XChaCha record sealing, tombstone management,
 * delta queues, and remote relay synchronization behind a cohesive interface.
 */
export class LocalStoreEngine {
  private storage: IStorageAdapter;
  private prefix: string;
  private syncServerUrl: string;
  private deviceId: string;
  private fetchFn: typeof fetch;

  private masterKeyBase64: string;
  private masterKey: Uint8Array;
  private bookmarks: Bookmark[] = [];
  private tags: Tag[] = [];
  private collections: Collection[] = [];
  private deletedTombstones: Record<string, string> = {};
  private pendingDeltas: SyncDelta[] = [];
  private syncCursor = 0;
  private isSyncing = false;

  public readonly vaultSession = new VaultSessionManager();
  private subscribers = new Set<() => void>();

  constructor(options: LocalStoreEngineOptions = {}) {
    this.storage = options.storage || (typeof window !== 'undefined' ? new BrowserLocalStorageAdapter() : new MemoryStorageAdapter());
    this.prefix = options.prefix || 'tessera_v1_';
    this.syncServerUrl = (options.syncServerUrl || 'http://127.0.0.1:8787').trim().replace(/\/+$/, '');

    const boundDefaultFetch = typeof window !== 'undefined' && typeof window.fetch === 'function'
      ? window.fetch.bind(window)
      : (typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : fetch);

    this.fetchFn = options.fetchFn ? options.fetchFn : boundDefaultFetch;

    // 1. Device ID
    const savedDeviceId = this.storage.getItem(`${this.prefix}deviceId`);
    if (savedDeviceId) {
      this.deviceId = savedDeviceId;
    } else {
      this.deviceId = options.deviceId || `device-${crypto.randomUUID().slice(0, 8)}`;
      this.storage.setItem(`${this.prefix}deviceId`, this.deviceId);
    }

    // 2. Master Key
    const savedKey = this.storage.getItem(`${this.prefix}masterKey`);
    if (savedKey) {
      this.masterKeyBase64 = savedKey;
      this.masterKey = base64ToUint8Array(savedKey);
    } else {
      const generated = generateMasterKey();
      this.masterKey = generated;
      this.masterKeyBase64 = uint8ArrayToBase64(generated);
      this.storage.setItem(`${this.prefix}masterKey`, this.masterKeyBase64);
    }

    // 3. Load persisted entities
    this.loadPersistedState();
  }

  private safeJsonParse<T>(key: string, fallback: T): T {
    try {
      const raw = this.storage.getItem(`${this.prefix}${key}`);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  private loadPersistedState(): void {
    this.bookmarks = this.safeJsonParse<Bookmark[]>('bookmarks', []);
    this.tags = this.safeJsonParse<Tag[]>('tags', []);
    this.collections = this.safeJsonParse<Collection[]>('collections', []);
    this.deletedTombstones = this.safeJsonParse<Record<string, string>>('deletedTombstones', {});
    this.pendingDeltas = this.safeJsonParse<SyncDelta[]>('pendingDeltas', []);
  }

  private persist(key: string, data: unknown): void {
    this.storage.setItem(`${this.prefix}${key}`, JSON.stringify(data));
  }

  private notify(): void {
    for (const callback of this.subscribers) {
      try {
        callback();
      } catch {}
    }
  }

  public subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  // --- Getters ---
  public getDeviceId(): string {
    return this.deviceId;
  }

  public getMasterKeyBase64(): string {
    return this.masterKeyBase64;
  }

  public getBookmarks(): Bookmark[] {
    return [...this.bookmarks];
  }

  public getTags(): Tag[] {
    return [...this.tags];
  }

  public getCollections(): Collection[] {
    return [...this.collections];
  }

  public getPendingDeltasCount(): number {
    return this.pendingDeltas.length;
  }

  public getIsSyncing(): boolean {
    return this.isSyncing;
  }

  public getSyncServerUrl(): string {
    return this.syncServerUrl;
  }

  public setSyncServerUrl(url: string): void {
    this.syncServerUrl = url;
    this.notify();
  }

  // --- Mutations ---

  public addBookmark(input: CreateBookmarkInput): Bookmark {
    const id = `b-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const updatedClock = incrementVectorClock({}, this.deviceId);
    const isVaultItem = Boolean(input.isVault);

    let normalizedUrl = input.url.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    let hostname = '';
    try {
      hostname = new URL(normalizedUrl).hostname;
    } catch {
      hostname = normalizedUrl;
    }

    // Clear prior tombstone if reusing ID
    if (this.deletedTombstones[id]) {
      delete this.deletedTombstones[id];
      this.persist('deletedTombstones', this.deletedTombstones);
    }

    const bookmark: Bookmark = {
      id,
      url: normalizedUrl,
      title: input.title || normalizedUrl,
      description: input.description || '',
      notes: input.notes || '',
      faviconUrl: input.faviconUrl || `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`,
      previewImageUrl: input.previewImageUrl || '',
      tags: input.tags || [],
      collectionId: input.collectionId || null,
      isVault: isVaultItem,
      isArchived: input.isArchived || false,
      isFavorite: input.isFavorite || false,
      isPinned: input.isPinned || false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      versionClock: updatedClock,
    };

    // Seal delta
    const key = isVaultItem && this.vaultSession.isUnlocked()
      ? this.vaultSession.getVaultMasterKey()!
      : this.masterKey;

    const recordKey = deriveRecordKey(key, id);
    const sealed = sealRecord(recordKey, bookmark);

    const delta: SyncDelta = {
      id: crypto.randomUUID(),
      entityType: 'bookmark',
      entityId: id,
      deviceId: this.deviceId,
      lamportTs: updatedClock[this.deviceId] || 1,
      vectorClock: updatedClock,
      ciphertext: sealed.ciphertext,
      nonce: sealed.nonce,
      createdAt: now,
    };

    this.pendingDeltas.push(delta);
    this.bookmarks = [bookmark, ...this.bookmarks];

    this.persist('bookmarks', this.bookmarks);
    this.persist('pendingDeltas', this.pendingDeltas);
    this.notify();

    return bookmark;
  }

  public updateBookmark(id: string, input: UpdateBookmarkInput): Bookmark | null {
    const existingIndex = this.bookmarks.findIndex((b) => b.id === id);
    if (existingIndex < 0) return null;

    const existing = this.bookmarks[existingIndex]!;
    const now = new Date().toISOString();
    const clock = incrementVectorClock(existing.versionClock, this.deviceId);

    const updated: Bookmark = {
      ...existing,
      ...input,
      updatedAt: now,
      versionClock: clock,
    };

    this.bookmarks = [
      ...this.bookmarks.slice(0, existingIndex),
      updated,
      ...this.bookmarks.slice(existingIndex + 1),
    ];

    this.persist('bookmarks', this.bookmarks);

    try {
      const key = updated.isVault && this.vaultSession.isUnlocked()
        ? this.vaultSession.getVaultMasterKey()!
        : this.masterKey;

      if (key) {
        const recordKey = deriveRecordKey(key, id);
        const sealed = sealRecord(recordKey, updated);

        const delta: SyncDelta = {
          id: crypto.randomUUID(),
          entityType: 'bookmark',
          entityId: id,
          deviceId: this.deviceId,
          lamportTs: clock[this.deviceId] || 1,
          vectorClock: clock,
          ciphertext: sealed.ciphertext,
          nonce: sealed.nonce,
          createdAt: now,
        };

        this.pendingDeltas.push(delta);
        this.persist('pendingDeltas', this.pendingDeltas);
      }
    } catch (err) {
      console.warn('[LocalStoreEngine] Delta sealing skipped:', err);
    }

    this.notify();
    return updated;
  }

  public deleteBookmark(id: string): boolean {
    const existingIndex = this.bookmarks.findIndex((b) => b.id === id);
    if (existingIndex < 0) return false;

    const b = this.bookmarks[existingIndex]!;
    const now = new Date().toISOString();
    const clock = incrementVectorClock(b.versionClock, this.deviceId);

    this.deletedTombstones[id] = now;
    this.persist('deletedTombstones', this.deletedTombstones);

    this.bookmarks = this.bookmarks.filter((item) => item.id !== id);
    this.persist('bookmarks', this.bookmarks);

    try {
      const key = b.isVault && this.vaultSession.isUnlocked()
        ? this.vaultSession.getVaultMasterKey()!
        : this.masterKey;

      if (key) {
        const recordKey = deriveRecordKey(key, id);
        const sealed = sealRecord(recordKey, { ...b, deletedAt: now, updatedAt: now });

        const delta: SyncDelta = {
          id: crypto.randomUUID(),
          entityType: 'tombstone',
          entityId: id,
          deviceId: this.deviceId,
          lamportTs: clock[this.deviceId] || 1,
          vectorClock: clock,
          ciphertext: sealed.ciphertext,
          nonce: sealed.nonce,
          createdAt: now,
        };

        this.pendingDeltas.push(delta);
        this.persist('pendingDeltas', this.pendingDeltas);
      }
    } catch (err) {
      console.warn('[LocalStoreEngine] Delete tombstone sealing skipped:', err);
    }

    this.notify();
    return true;
  }

  public addTag(name: string, color = '#0891b2'): Tag {
    const trimmed = name.trim().toLowerCase();
    const existing = this.tags.find((t) => t.name === trimmed);
    if (existing) return existing;

    const newTag: Tag = {
      id: `t-${crypto.randomUUID().slice(0, 8)}`,
      name: trimmed,
      color,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.tags.push(newTag);
    this.persist('tags', this.tags);
    this.notify();
    return newTag;
  }

  public deleteTag(nameOrId: string): boolean {
    const target = nameOrId.trim().toLowerCase();
    const initialLen = this.tags.length;
    this.tags = this.tags.filter((t) => t.id !== target && t.name.toLowerCase() !== target);
    if (this.tags.length === initialLen) return false;

    // Remove tag from bookmarks
    let modified = false;
    this.bookmarks = this.bookmarks.map((b) => {
      if ((b.tags || []).includes(target)) {
        modified = true;
        return {
          ...b,
          tags: (b.tags || []).filter((t) => t.toLowerCase() !== target),
        };
      }
      return b;
    });

    this.persist('tags', this.tags);
    if (modified) this.persist('bookmarks', this.bookmarks);
    this.notify();
    return true;
  }

  public addCollection(name: string, color = '#1e3a5f', description = ''): Collection {
    const trimmed = name.trim();
    const newCol: Collection = {
      id: `c-${crypto.randomUUID().slice(0, 8)}`,
      name: trimmed,
      description,
      color,
      parentId: null,
      sortOrder: this.collections.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.collections.push(newCol);
    this.persist('collections', this.collections);
    this.notify();
    return newCol;
  }

  public deleteCollection(id: string): boolean {
    const initialLen = this.collections.length;
    this.collections = this.collections.filter((c) => c.id !== id);
    if (this.collections.length === initialLen) return false;

    // Detach deleted collection from bookmarks
    let modified = false;
    this.bookmarks = this.bookmarks.map((b) => {
      if (b.collectionId === id) {
        modified = true;
        return { ...b, collectionId: null };
      }
      return b;
    });

    this.persist('collections', this.collections);
    if (modified) this.persist('bookmarks', this.bookmarks);
    this.notify();
    return true;
  }

  public setMasterKey(b64: string): { success: boolean; error?: string } {
    try {
      const trimmed = b64.trim();
      const bytes = base64ToUint8Array(trimmed);
      if (bytes.byteLength !== 32) {
        throw new Error('Key must be exactly 32 bytes (256 bits)');
      }
      this.masterKeyBase64 = trimmed;
      this.masterKey = bytes;
      this.storage.setItem(`${this.prefix}masterKey`, trimmed);
      this.syncCursor = 0;
      this.notify();
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  // --- Synchronization ---

  public async sync(forceFullPush = false): Promise<{
    success: boolean;
    pulledCount: number;
    pushedCount: number;
    error?: string;
  }> {
    if (this.isSyncing) return { success: false, pulledCount: 0, pushedCount: 0 };
    this.isSyncing = true;
    this.notify();

    let pushedCount = 0;
    let pulledCount = 0;

    try {
      let deltasToPush = [...this.pendingDeltas];

      // Full push: package all local non-deleted bookmarks and collections
      if (forceFullPush && (this.bookmarks.length > 0 || this.collections.length > 0)) {
        const now = new Date().toISOString();
        deltasToPush = [...this.pendingDeltas];
        for (const b of this.bookmarks) {
          if (b.deletedAt || this.deletedTombstones[b.id]) continue;
          const key = b.isVault && this.vaultSession.isUnlocked()
            ? this.vaultSession.getVaultMasterKey()!
            : this.masterKey;

          const recordKey = deriveRecordKey(key, b.id);
          const sealed = sealRecord(recordKey, b);

          deltasToPush.push({
            id: crypto.randomUUID(),
            entityType: 'bookmark',
            entityId: b.id,
            deviceId: this.deviceId,
            lamportTs: b.versionClock?.[this.deviceId] || 1,
            vectorClock: b.versionClock || { [this.deviceId]: 1 },
            ciphertext: sealed.ciphertext,
            nonce: sealed.nonce,
            createdAt: b.updatedAt || now,
          });
        }

        for (const col of this.collections) {
          const colKey = deriveRecordKey(this.masterKey, col.id);
          const colSealed = sealRecord(colKey, col);
          deltasToPush.push({
            id: crypto.randomUUID(),
            entityType: 'collection',
            entityId: col.id,
            deviceId: this.deviceId,
            lamportTs: 1,
            vectorClock: { [this.deviceId]: 1 },
            ciphertext: colSealed.ciphertext,
            nonce: colSealed.nonce,
            createdAt: col.createdAt || now,
          });
        }
      }

      // 1. Push
      if (deltasToPush.length > 0) {
        const pushRes = await this.fetchFn(`${this.syncServerUrl}/api/sync/push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: this.deviceId,
            deltas: deltasToPush,
            clientCursor: this.syncCursor,
          }),
        });

        if (pushRes.ok) {
          pushedCount = deltasToPush.length;
          this.pendingDeltas = [];
          this.persist('pendingDeltas', this.pendingDeltas);
        }
      }

      // 2. Pull
      const pullRes = await this.fetchFn(`${this.syncServerUrl}/api/sync/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: this.deviceId,
          sinceCursor: this.syncCursor,
          limit: 200,
        }),
      });

      if (pullRes.ok) {
        const data = (await pullRes.json()) as {
          deltas: SyncDelta[];
          nextCursor: number;
          hasMore: boolean;
        };

        if (data.deltas.length > 0) {
          for (const delta of data.deltas) {
            if (delta.deviceId === this.deviceId) continue;

            // Handle Collection entity deltas
            if (delta.entityType === 'collection') {
              const colRecordKey = deriveRecordKey(this.masterKey, delta.entityId);
              const unsealedCol = unsealRecord<Collection>(colRecordKey, delta.ciphertext, delta.nonce);
              if (unsealedCol.data) {
                const incomingCol = unsealedCol.data;
                pulledCount++;
                const existingIdx = this.collections.findIndex(
                  (c) => c.id === incomingCol.id || c.name.toLowerCase() === incomingCol.name.toLowerCase(),
                );
                if (existingIdx >= 0) {
                  this.collections[existingIdx] = incomingCol;
                } else {
                  this.collections = [...this.collections, incomingCol];
                }
                this.persist('collections', this.collections);
              }
              continue;
            }

            // 1. Try Master Key for Bookmarks
            const recordKey = deriveRecordKey(this.masterKey, delta.entityId);
            let unsealed = unsealRecord<Bookmark>(recordKey, delta.ciphertext, delta.nonce);

            // 2. If Master Key failed, try Vault Master Key
            if (!unsealed.data && this.vaultSession.isUnlocked()) {
              const vKey = this.vaultSession.getVaultMasterKey()!;
              const vRecordKey = deriveRecordKey(vKey, delta.entityId);
              unsealed = unsealRecord<Bookmark>(vRecordKey, delta.ciphertext, delta.nonce);
            }

            if (unsealed.data) {
              const incoming = unsealed.data;
              const isDeleted = delta.entityType === 'tombstone' || Boolean(incoming.deletedAt);
              const tombstoneTime = this.deletedTombstones[delta.entityId];

              if (isDeleted) {
                const delTime = incoming.deletedAt || delta.createdAt || new Date().toISOString();
                this.deletedTombstones[delta.entityId] = delTime;
                this.bookmarks = this.bookmarks.filter((b) => b.id !== delta.entityId);
                pulledCount++;
              } else {
                if (tombstoneTime) {
                  const incTime = new Date(incoming.updatedAt || delta.createdAt).getTime();
                  const delTime = new Date(tombstoneTime).getTime();
                  if (incTime <= delTime) continue;
                }

                pulledCount++;
                const existingIndex = this.bookmarks.findIndex((b) => b.id === incoming.id);
                if (existingIndex >= 0) {
                  const reconciled = reconcileBookmark(
                    this.bookmarks[existingIndex]!,
                    incoming,
                    this.deviceId,
                    delta.deviceId,
                    delta.lamportTs,
                  );
                  this.bookmarks[existingIndex] = reconciled;
                } else {
                  this.bookmarks = [incoming, ...this.bookmarks];
                }
              }
            }
          }

          this.syncCursor = data.nextCursor;
          this.persist('bookmarks', this.bookmarks);
          this.persist('deletedTombstones', this.deletedTombstones);
          this.persist('collections', this.collections);
        }
      }

      return { success: true, pulledCount, pushedCount };
    } catch (err) {
      return { success: false, pulledCount, pushedCount, error: (err as Error).message };
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  // --- Backup & Restore ---

  public exportBackup(): FullBackupPayload {
    return {
      type: 'tessera_full_backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      masterKey: this.masterKeyBase64,
      bookmarks: this.bookmarks,
      tags: this.tags,
      collections: this.collections,
    };
  }

  public async restoreBackup(backupData: any): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
      const payload: FullBackupPayload = typeof backupData === 'string' ? JSON.parse(backupData) : backupData;

      if (payload.masterKey && payload.masterKey.trim()) {
        this.setMasterKey(payload.masterKey);
      }

      let count = 0;
      if (Array.isArray(payload.bookmarks)) {
        const merged = [...payload.bookmarks];
        for (const item of this.bookmarks) {
          if (!merged.some((m) => m.id === item.id)) {
            merged.push(item);
          }
        }
        this.bookmarks = merged;
        count = payload.bookmarks.length;
        this.persist('bookmarks', this.bookmarks);
      }

      if (Array.isArray(payload.tags)) {
        const merged = [...payload.tags];
        for (const t of this.tags) {
          if (!merged.some((m) => m.id === t.id)) {
            merged.push(t);
          }
        }
        this.tags = merged;
        this.persist('tags', this.tags);
      }

      if (Array.isArray(payload.collections)) {
        const merged = [...payload.collections];
        for (const c of this.collections) {
          if (!merged.some((m) => m.id === c.id)) {
            merged.push(c);
          }
        }
        this.collections = merged;
        this.persist('collections', this.collections);
      }

      this.syncCursor = 0;
      this.notify();

      // Trigger automatic sync push
      setTimeout(() => {
        this.sync(true);
      }, 50);

      return { success: true, count };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}
