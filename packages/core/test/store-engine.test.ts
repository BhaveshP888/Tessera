import { describe, expect, it } from 'bun:test';
import { LocalStoreEngine, MemoryStorageAdapter } from '../src/store/engine.js';
import type { SyncDelta } from '@tessera/schemas';

describe('LocalStoreEngine Deep Module', () => {
  it('manages bookmark lifecycle, vector clocks, and tombstones headlessly', () => {
    const storage = new MemoryStorageAdapter();
    const engine = new LocalStoreEngine({ storage, deviceId: 'test-node-1' });

    // 1. Add Bookmark
    const b1 = engine.addBookmark({
      url: 'https://bun.sh',
      title: 'Bun JavaScript Runtime',
      description: 'Fast all-in-one JavaScript runtime',
      tags: ['javascript', 'bun'],
    });

    expect(b1.id).toBeDefined();
    expect(b1.url).toBe('https://bun.sh');
    expect(engine.getBookmarks().length).toBe(1);
    expect(engine.getPendingDeltasCount()).toBe(1);

    // 2. Update Bookmark
    const updated = engine.updateBookmark(b1.id, {
      title: 'Bun 1.3 Fast Runtime',
    });
    expect(updated?.title).toBe('Bun 1.3 Fast Runtime');
    expect(engine.getBookmarks()[0]?.title).toBe('Bun 1.3 Fast Runtime');
    expect(engine.getPendingDeltasCount()).toBe(2);

    // 3. Delete Bookmark (creates tombstone)
    const deleted = engine.deleteBookmark(b1.id);
    expect(deleted).toBe(true);
    expect(engine.getBookmarks().length).toBe(0);
    expect(engine.getPendingDeltasCount()).toBe(3);
  });

  it('performs headless peer-to-peer sync simulation between two engines', async () => {
    // In-memory mock relay server changelog
    const globalChangelog: { cursor: number; delta: SyncDelta }[] = [];
    let globalCursor = 0;

    const mockFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const urlStr = url.toString();
      const body = init?.body ? JSON.parse(init.body as string) : {};

      if (urlStr.includes('/api/sync/push')) {
        const deltas = body.deltas as SyncDelta[];
        for (const delta of deltas) {
          globalCursor++;
          globalChangelog.push({ cursor: globalCursor, delta });
        }
        return new Response(JSON.stringify({ globalCursor, acceptedCount: deltas.length }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (urlStr.includes('/api/sync/pull')) {
        const since = body.sinceCursor || 0;
        const matching = globalChangelog.filter((c) => c.cursor > since);
        const nextCursor = matching.length > 0 ? matching[matching.length - 1]!.cursor : since;

        return new Response(
          JSON.stringify({
            deltas: matching.map((m) => m.delta),
            nextCursor,
            hasMore: false,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return new Response('Not Found', { status: 404 });
    };

    const storage1 = new MemoryStorageAdapter();
    const storage2 = new MemoryStorageAdapter();

    const engine1 = new LocalStoreEngine({
      storage: storage1,
      deviceId: 'device-alice',
      fetchFn: mockFetch as any,
    });

    const engine2 = new LocalStoreEngine({
      storage: storage2,
      deviceId: 'device-bob',
      fetchFn: mockFetch as any,
    });

    // Pair Engine 2 with Alice's Master Key
    engine2.setMasterKey(engine1.getMasterKeyBase64());

    // Alice creates 2 bookmarks
    engine1.addBookmark({ url: 'https://eff.org', title: 'Electronic Frontier Foundation' });
    engine1.addBookmark({ url: 'https://signal.org', title: 'Signal Messenger' });
    expect(engine1.getBookmarks().length).toBe(2);

    // Alice syncs (pushes 2 deltas to mock relay)
    const aliceSync = await engine1.sync();
    expect(aliceSync.success).toBe(true);
    expect(aliceSync.pushedCount).toBe(2);

    // Bob syncs (pulls 2 deltas and decrypts with Alice's master key)
    const bobSync = await engine2.sync();
    expect(bobSync.success).toBe(true);
    expect(bobSync.pulledCount).toBe(2);
    expect(engine2.getBookmarks().length).toBe(2);
    expect(engine2.getBookmarks().some((b) => b.title === 'Signal Messenger')).toBe(true);

    // Alice deletes EFF bookmark
    const effBookmark = engine1.getBookmarks().find((b) => b.url === 'https://eff.org')!;
    engine1.deleteBookmark(effBookmark.id);
    await engine1.sync();

    // Bob syncs -> Bob's EFF bookmark is removed and will not resurface
    await engine2.sync();
    expect(engine2.getBookmarks().length).toBe(1);
    expect(engine2.getBookmarks()[0]!.title).toBe('Signal Messenger');
  });

  it('exports and restores full backup payloads cleanly', async () => {
    const storage1 = new MemoryStorageAdapter();
    const engine1 = new LocalStoreEngine({ storage: storage1 });

    engine1.addBookmark({ url: 'https://kernel.org', title: 'Linux Kernel' });
    engine1.addTag('linux', '#10b981');
    engine1.addCollection('OS Architecture', '#3b82f6');

    const backup = engine1.exportBackup();
    expect(backup.bookmarks.length).toBe(1);
    expect(backup.tags.length).toBe(1);
    expect(backup.collections.length).toBe(1);

    const storage2 = new MemoryStorageAdapter();
    const engine2 = new LocalStoreEngine({ storage: storage2 });
    const res = await engine2.restoreBackup(backup);

    expect(res.success).toBe(true);
    expect(engine2.getBookmarks().length).toBe(1);
    expect(engine2.getBookmarks()[0]!.title).toBe('Linux Kernel');
    expect(engine2.getMasterKeyBase64()).toBe(engine1.getMasterKeyBase64());
  });

  it('deletes collections and tags safely unlinking bookmarks', () => {
    const storage = new MemoryStorageAdapter();
    const engine = new LocalStoreEngine({ storage });

    const col = engine.addCollection('Research');
    const tag = engine.addTag('academic');

    const b = engine.addBookmark({
      url: 'https://arxiv.org',
      title: 'arXiv',
      collectionId: col.id,
      tags: ['academic', 'papers'],
    });

    expect(b.collectionId).toBe(col.id);
    expect(engine.getCollections().length).toBe(1);

    // Delete Collection
    const colDeleted = engine.deleteCollection(col.id);
    expect(colDeleted).toBe(true);
    expect(engine.getCollections().length).toBe(0);
    // Bookmark remains, collectionId is unlinked
    expect(engine.getBookmarks()[0]!.collectionId).toBe(null);

    // Delete Tag
    const tagDeleted = engine.deleteTag('academic');
    expect(tagDeleted).toBe(true);
    expect(engine.getTags().length).toBe(1);
    expect(engine.getTags()[0]!.name).toBe('papers');
    // Tag unlinked from bookmark
    expect(engine.getBookmarks()[0]!.tags).toEqual(['papers']);
  });
});
