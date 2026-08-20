import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  AuditEvent,
  Bookmark,
  Collection,
  CreateBookmarkInput,
  ExtensionManifest,
  Tag,
  UpdateBookmarkInput,
  VaultConfig,
} from '@tessera/schemas';
import {
  LocalStoreEngine,
  fuzzyRankItems,
  base64ToUint8Array,
} from '@tessera/core';

const STORAGE_PREFIX = 'tessera_v1_';

const defaultVaultConfig: VaultConfig = {
  isConfigured: false,
  pinSalt: '',
  pinHash: '',
  wipeAfterAttempts: 5,
  failedAttempts: 0,
  isSyncEnabled: false,
  encryptedVaultKeyWithPin: '',
  autoLockTimeoutMinutes: 5,
};

const safeJsonParse = <T>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    if (!item || item === 'undefined' || item === 'null') return fallback;
    return JSON.parse(item) as T;
  } catch {
    return fallback;
  }
};

// Singleton engine instance across React renders
let engineInstance: LocalStoreEngine | null = null;
const getEngine = (): LocalStoreEngine => {
  if (!engineInstance) {
    engineInstance = new LocalStoreEngine();
  }
  return engineInstance;
};

export const useLibraryStore = () => {
  const engine = getEngine();

  // Reactive store state
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => engine.getBookmarks());
  const [tags, setTags] = useState<Tag[]>(() => engine.getTags());
  const [collections, setCollections] = useState<Collection[]>(() => engine.getCollections());
  const [pendingDeltasCount, setPendingDeltasCount] = useState<number>(() => engine.getPendingDeltasCount());
  const [masterKeyBase64, setMasterKeyBase64] = useState<string>(() => engine.getMasterKeyBase64());
  const [isSyncing, setIsSyncing] = useState<boolean>(() => engine.getIsSyncing());
  const [syncServerUrl, setSyncServerUrlState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.port === '3000' || window.location.port === '5173') {
        return 'http://localhost:8787';
      }
      return window.location.origin;
    }
    return 'http://localhost:8787';
  });

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [viewFilter, setViewFilter] = useState<'all' | 'favorites' | 'archived' | 'pinned'>('all');
  const [activeSection, setActiveSection] = useState<'library' | 'vault'>('library');

  // Vault state
  const [vaultConfig, setVaultConfig] = useState<VaultConfig>(() =>
    safeJsonParse(`${STORAGE_PREFIX}vaultConfig`, defaultVaultConfig)
  );
  const [isVaultUnlocked, setIsVaultUnlocked] = useState<boolean>(() => engine.vaultSession.isUnlocked());

  // Audit Logs & Extensions
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>(() =>
    safeJsonParse(`${STORAGE_PREFIX}auditLogs`, [])
  );
  const [installedExtensions] = useState<ExtensionManifest[]>(() =>
    safeJsonParse(`${STORAGE_PREFIX}extensions`, [
      {
        id: 'pinboard-import',
        name: 'Pinboard Importer',
        version: '1.0.0',
        description: 'Import bookmarks from Pinboard JSON files.',
        author: 'tessera.community',
        permissions: ['bookmarks.write', 'tags.write'],
        ui: { commands: ['import-pinboard'] },
      },
      {
        id: 'markdown-export',
        name: 'Markdown Exporter',
        version: '1.0.0',
        description: 'Export all bookmarks grouped by tag into clean Markdown.',
        author: 'tessera.community',
        permissions: ['bookmarks.read', 'tags.read'],
        ui: { commands: ['export-markdown'] },
      },
    ])
  );

  // Subscribe to engine state mutations
  useEffect(() => {
    const syncFromEngine = () => {
      setBookmarks(engine.getBookmarks());
      setTags(engine.getTags());
      setCollections(engine.getCollections());
      setPendingDeltasCount(engine.getPendingDeltasCount());
      setMasterKeyBase64(engine.getMasterKeyBase64());
      setIsSyncing(engine.getIsSyncing());
      setIsVaultUnlocked(engine.vaultSession.isUnlocked());
    };

    return engine.subscribe(syncFromEngine);
  }, [engine]);

  // Sync server URL update
  const setSyncServerUrl = useCallback((url: string) => {
    setSyncServerUrlState(url);
    engine.setSyncServerUrl(url);
  }, [engine]);

  // Structured Audit Logger
  const logAudit = useCallback(
    (
      type: AuditEvent['type'],
      status: AuditEvent['status'],
      details: Record<string, unknown> = {},
      errorMessage?: string,
    ) => {
      const entry: AuditEvent = {
        id: crypto.randomUUID(),
        type,
        status,
        timestamp: new Date().toISOString(),
        details,
        errorMessage,
      };
      setAuditLogs((prev) => {
        const next = [entry, ...prev].slice(0, 100);
        localStorage.setItem(`${STORAGE_PREFIX}auditLogs`, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  // Vault Management
  const setupVault = useCallback(
    (pin: string, wipeAfterAttempts = 5, autoLockMinutes = 5): { success: boolean; error?: string } => {
      try {
        const masterKeyBytes = base64ToUint8Array(engine.getMasterKeyBase64());
        const config = engine.vaultSession.setup(pin, undefined, masterKeyBytes);
        config.wipeAfterAttempts = wipeAfterAttempts;
        config.autoLockTimeoutMinutes = autoLockMinutes;
        setVaultConfig(config);
        localStorage.setItem(`${STORAGE_PREFIX}vaultConfig`, JSON.stringify(config));
        setIsVaultUnlocked(true);
        logAudit('vault_setup', 'success', {});
        return { success: true };
      } catch (err) {
        logAudit('vault_setup', 'error', {}, (err as Error).message);
        return { success: false, error: (err as Error).message };
      }
    },
    [engine, logAudit],
  );

  const restoreVaultFromSync = useCallback(
    (passphrase: string, pin: string, wipeAfterAttempts = 5, autoLockMinutes = 5): { success: boolean; error?: string } => {
      try {
        const masterKeyBytes = base64ToUint8Array(engine.getMasterKeyBase64());
        const config = engine.vaultSession.restoreFromSync(passphrase, masterKeyBytes, pin);
        config.wipeAfterAttempts = wipeAfterAttempts;
        config.autoLockTimeoutMinutes = autoLockMinutes;
        setVaultConfig(config);
        localStorage.setItem(`${STORAGE_PREFIX}vaultConfig`, JSON.stringify(config));
        setIsVaultUnlocked(true);
        logAudit('vault_unlocked', 'success', { source: 'sync_restore' });
        return { success: true };
      } catch (err) {
        logAudit('vault_unlocked', 'error', {}, (err as Error).message);
        return { success: false, error: (err as Error).message };
      }
    },
    [engine, logAudit],
  );

  const wipeVaultData = useCallback(() => {
    engine.vaultSession.wipe();
    const wipedConfig: VaultConfig = {
      ...defaultVaultConfig,
      isConfigured: false,
    };
    setVaultConfig(wipedConfig);
    localStorage.setItem(`${STORAGE_PREFIX}vaultConfig`, JSON.stringify(wipedConfig));
    setIsVaultUnlocked(false);
    logAudit('vault_wiped', 'warning', {});
  }, [engine, logAudit]);

  const unlockVault = useCallback(
    (pin: string): { success: boolean; error?: string; remainingAttempts?: number; wiped?: boolean } => {
      const success = engine.vaultSession.unlock(pin, vaultConfig);
      if (success) {
        setVaultConfig((prev) => {
          const next = { ...prev, failedAttempts: 0 };
          localStorage.setItem(`${STORAGE_PREFIX}vaultConfig`, JSON.stringify(next));
          return next;
        });
        setIsVaultUnlocked(true);
        logAudit('vault_unlocked', 'success', {});
        return { success: true };
      } else {
        const newFailed = (vaultConfig.failedAttempts || 0) + 1;
        if (newFailed >= vaultConfig.wipeAfterAttempts) {
          wipeVaultData();
          logAudit('vault_wiped', 'error', { reason: 'max_failed_attempts_exceeded' });
          return { success: false, error: 'Vault permanently wiped due to too many failed attempts.', wiped: true };
        } else {
          const remaining = vaultConfig.wipeAfterAttempts - newFailed;
          setVaultConfig((prev) => {
            const next = { ...prev, failedAttempts: newFailed };
            localStorage.setItem(`${STORAGE_PREFIX}vaultConfig`, JSON.stringify(next));
            return next;
          });
          logAudit('vault_pin_failed', 'warning', { failedAttempts: newFailed, remainingAttempts: remaining });
          return { success: false, error: 'Incorrect 7-digit PIN.', remainingAttempts: remaining };
        }
      }
    },
    [engine, vaultConfig, wipeVaultData, logAudit],
  );

  const lockVault = useCallback(() => {
    engine.vaultSession.lock();
    setIsVaultUnlocked(false);
    logAudit('vault_locked', 'success', {});
  }, [engine, logAudit]);

  const enableVaultSync = useCallback(
    (passphrase: string): { success: boolean; error?: string } => {
      try {
        const masterKeyBytes = base64ToUint8Array(engine.getMasterKeyBase64());
        const config = engine.vaultSession.enableSync(passphrase, masterKeyBytes, vaultConfig);
        setVaultConfig(config);
        localStorage.setItem(`${STORAGE_PREFIX}vaultConfig`, JSON.stringify(config));
        logAudit('vault_sync_enabled', 'success', {});
        return { success: true };
      } catch (err) {
        logAudit('vault_sync_enabled', 'error', {}, (err as Error).message);
        return { success: false, error: (err as Error).message };
      }
    },
    [engine, vaultConfig, logAudit],
  );

  const disableVaultSync = useCallback(() => {
    setVaultConfig((prev) => {
      const next = { ...prev, isSyncEnabled: false };
      localStorage.setItem(`${STORAGE_PREFIX}vaultConfig`, JSON.stringify(next));
      return next;
    });
    logAudit('vault_sync_disabled', 'success', {});
  }, [logAudit]);

  // Mutations
  const addBookmark = useCallback(
    (input: CreateBookmarkInput): Bookmark => {
      const isVault = input.isVault || activeSection === 'vault';
      const created = engine.addBookmark({ ...input, isVault });
      logAudit('sync_push', 'success', { action: 'create_bookmark', id: created.id });

      // Immediate background sync
      setTimeout(() => {
        engine.sync();
      }, 100);

      return created;
    },
    [engine, activeSection, logAudit],
  );

  const updateBookmark = useCallback(
    (id: string, input: UpdateBookmarkInput): Bookmark | null => {
      const updated = engine.updateBookmark(id, input);
      if (updated) {
        logAudit('sync_push', 'success', { action: 'update_bookmark', id });
        setTimeout(() => {
          engine.sync();
        }, 100);
      }
      return updated;
    },
    [engine, logAudit],
  );

  const deleteBookmark = useCallback(
    (id: string): boolean => {
      const deleted = engine.deleteBookmark(id);
      if (deleted) {
        logAudit('sync_push', 'success', { action: 'delete_bookmark', id });
        setTimeout(() => {
          engine.sync();
        }, 100);
      }
      return deleted;
    },
    [engine, logAudit],
  );

  const addTag = useCallback((name: string, color?: string) => {
    engine.addTag(name, color);
  }, [engine]);

  const deleteTag = useCallback((nameOrId: string) => {
    engine.deleteTag(nameOrId);
  }, [engine]);

  const addCollection = useCallback((name: string, color?: string, description?: string) => {
    engine.addCollection(name, color, description);
  }, [engine]);

  const deleteCollection = useCallback((id: string) => {
    engine.deleteCollection(id);
  }, [engine]);

  const importMasterKey = useCallback(
    (b64: string): { success: boolean; error?: string } => {
      const res = engine.setMasterKey(b64);
      if (res.success) {
        logAudit('master_key_imported', 'success', {});
        setTimeout(() => {
          engine.sync(false);
        }, 100);
      } else {
        logAudit('master_key_imported', 'error', {}, res.error);
      }
      return res;
    },
    [engine, logAudit],
  );

  const performSync = useCallback(
    async (forceFullPush = false) => {
      const res = await engine.sync(forceFullPush);
      if (res.success) {
        if (res.pulledCount > 0) logAudit('sync_pull', 'success', { pulledCount: res.pulledCount });
        if (res.pushedCount > 0) logAudit('sync_push', 'success', { pushedCount: res.pushedCount });
      } else {
        logAudit('sync_pull', 'error', {}, res.error);
      }
      return res;
    },
    [engine, logAudit],
  );

  const exportFullBackup = useCallback(() => {
    return {
      ...engine.exportBackup(),
      vaultConfig,
    };
  }, [engine, vaultConfig]);

  const restoreFullBackup = useCallback(
    async (backup: any) => {
      const res = await engine.restoreBackup(backup);
      if (res.success) {
        if (backup.vaultConfig) {
          setVaultConfig(backup.vaultConfig);
          localStorage.setItem(`${STORAGE_PREFIX}vaultConfig`, JSON.stringify(backup.vaultConfig));
        }
        logAudit('master_key_imported', 'success', { backupRestored: true, count: res.count });
      }
      return res;
    },
    [engine, logAudit],
  );

  // Background Sync Interval & Tab Focus
  useEffect(() => {
    const handleFocus = () => {
      engine.sync();
    };
    window.addEventListener('focus', handleFocus);
    const interval = setInterval(() => {
      engine.sync();
    }, 25000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [engine]);

  // Bookmarks partition: Regular Library vs Private Vault
  const isViewingVault = activeSection === 'vault';
  const targetBookmarks = useMemo(() => {
    return bookmarks.filter((b) => {
      if (b.deletedAt) return false;
      return isViewingVault ? b.isVault === true : !b.isVault;
    });
  }, [bookmarks, isViewingVault]);

  const filteredBookmarks = useMemo(() => {
    return targetBookmarks.filter((b) => {
      if (viewFilter === 'favorites' && !b.isFavorite) return false;
      if (viewFilter === 'archived' && !b.isArchived) return false;
      if (viewFilter === 'pinned' && !b.isPinned) return false;
      if (viewFilter === 'all' && b.isArchived) return false;

      if (selectedCollectionId && b.collectionId !== selectedCollectionId) return false;
      if (selectedTag && !(b.tags || []).includes(selectedTag)) return false;

      return true;
    });
  }, [targetBookmarks, viewFilter, selectedCollectionId, selectedTag]);

  const displayBookmarks = useMemo(() => {
    return searchQuery.trim()
      ? fuzzyRankItems(
          filteredBookmarks,
          searchQuery,
          (b) => `${b.title || ''} ${b.description || ''} ${b.url || ''} ${(b.tags || []).join(' ')} ${b.notes || ''}`,
          0.2,
        ).map((r) => r.item)
      : filteredBookmarks;
  }, [filteredBookmarks, searchQuery]);

  return {
    bookmarks: isViewingVault && !isVaultUnlocked ? [] : displayBookmarks,
    allBookmarksCount: bookmarks.filter((b) => !b.deletedAt && !b.isArchived && !b.isVault).length,
    vaultBookmarksCount: bookmarks.filter((b) => !b.deletedAt && b.isVault).length,
    tags,
    collections,
    auditLogs,
    pendingDeltasCount,
    installedExtensions,
    deviceId: engine.getDeviceId(),
    masterKeyBase64,
    searchQuery,
    selectedTag,
    selectedCollectionId,
    viewFilter,
    syncServerUrl,
    isSyncing,
    activeSection,
    vaultConfig,
    isVaultUnlocked,
    setActiveSection,
    setSearchQuery,
    setSelectedTag,
    setSelectedCollectionId,
    setViewFilter,
    setSyncServerUrl,
    addBookmark,
    updateBookmark,
    deleteBookmark,
    addTag,
    deleteTag,
    addCollection,
    deleteCollection,
    importMasterKey,
    exportFullBackup,
    restoreFullBackup,
    performSync,
    setupVault,
    restoreVaultFromSync,
    unlockVault,
    lockVault,
    wipeVaultData,
    enableVaultSync,
    disableVaultSync,
    logAudit,
  };
};
