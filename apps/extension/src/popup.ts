/**
 * Extension popup script with dynamic cloud sync and real collection unsealing
 */
import {
  base64ToUint8Array,
  deriveRecordKey,
  sealRecord,
  uint8ArrayToBase64,
  unsealRecord,
} from '@tessera/core';
import type { SyncDelta } from '@tessera/schemas';

document.addEventListener('DOMContentLoaded', async () => {
  const urlInput = document.getElementById('url') as HTMLInputElement;
  const titleInput = document.getElementById('title') as HTMLInputElement;
  const collectionSelect = document.getElementById('collection') as HTMLSelectElement;
  const customColWrap = document.getElementById('custom-col-wrap') as HTMLDivElement;
  const customColInput = document.getElementById('custom-collection') as HTMLInputElement;
  const tagsInput = document.getElementById('tags') as HTMLInputElement;
  const notesInput = document.getElementById('notes') as HTMLTextAreaElement;
  const btnSaveLibrary = document.getElementById('btn-save-library') as HTMLButtonElement;
  const btnSaveVault = document.getElementById('btn-save-vault') as HTMLButtonElement;
  const statusEl = document.getElementById('status') as HTMLDivElement;

  // Settings elements
  const btnToggleSettings = document.getElementById('btn-toggle-settings') as HTMLButtonElement;
  const settingsDrawer = document.getElementById('settings-drawer') as HTMLDivElement;
  const serverUrlInput = document.getElementById('server-url') as HTMLInputElement;
  const masterKeyInput = document.getElementById('master-key') as HTMLInputElement;
  const btnSaveSettings = document.getElementById('btn-save-settings') as HTMLButtonElement;
  const syncDot = document.getElementById('sync-dot') as HTMLSpanElement;
  const syncLabel = document.getElementById('sync-label') as HTMLSpanElement;

  // Toggle settings drawer
  btnToggleSettings.addEventListener('click', () => {
    settingsDrawer.classList.toggle('open');
  });

  // Helper to re-render collection dropdown
  const renderCollections = (collectionNames: string[]) => {
    const existingSelected = collectionSelect.value;

    // Reset options to base
    collectionSelect.innerHTML = `
      <option value="">None (General Library)</option>
      <option value="__new__">+ New collection...</option>
    `;

    // Filter duplicates and empty strings
    const unique = Array.from(new Set(collectionNames.filter(Boolean)));
    for (const name of unique) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      collectionSelect.insertBefore(opt, collectionSelect.lastElementChild);
    }

    if (unique.includes(existingSelected)) {
      collectionSelect.value = existingSelected;
    }
  };

  // Pull collections from storage and cloud
  const refreshCollectionsAndStatus = async () => {
    let serverUrl = '';
    let masterKeyBase64 = '';
    let localCollections: string[] = [];

    if (typeof chrome !== 'undefined' && chrome.storage) {
      const data = await chrome.storage.local.get([
        'tessera_server_url',
        'tessera_master_key',
        'tessera_collections',
      ]);
      serverUrl = data['tessera_server_url'] || '';
      masterKeyBase64 = data['tessera_master_key'] || '';
      localCollections = data['tessera_collections'] || [];

      serverUrlInput.value = serverUrl;
      masterKeyInput.value = masterKeyBase64;
    }

    // Render locally known collections first
    renderCollections(localCollections);

    if (serverUrl) {
      syncDot.className = 'sync-indicator online';
      syncLabel.textContent = 'CLOUD READY';

      // If Master Key is present, attempt live pull of real collection entities from cloud
      if (masterKeyBase64) {
        try {
          const cleanUrl = serverUrl.replace(/\/+$/, '');
          const res = await fetch(`${cleanUrl}/api/sync/pull`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sinceCursor: 0 }),
          });

          if (res.ok) {
            const body = (await res.json()) as { deltas: SyncDelta[] };
            const pulledCollections = new Set<string>(localCollections);
            const masterKey = base64ToUint8Array(masterKeyBase64);

            for (const delta of body.deltas || []) {
              if (delta.entityType === 'collection' && delta.operation !== 'delete' && delta.encryptedData) {
                try {
                  const recordKey = await deriveRecordKey(masterKey, delta.entityId, 'collection');
                  const unsealed = await unsealRecord(delta.encryptedData, recordKey);
                  if (unsealed?.name) {
                    pulledCollections.add(unsealed.name);
                  }
                } catch {}
              }
            }

            const updatedList = Array.from(pulledCollections);
            renderCollections(updatedList);

            // Persist back to storage
            if (typeof chrome !== 'undefined' && chrome.storage) {
              await chrome.storage.local.set({ tessera_collections: updatedList });
            }
          }
        } catch {
          syncDot.className = 'sync-indicator';
          syncLabel.textContent = 'OFFLINE';
        }
      }
    } else {
      syncDot.className = 'sync-indicator';
      syncLabel.textContent = 'LOCAL';
    }
  };

  // Save Settings handler
  btnSaveSettings.addEventListener('click', async () => {
    const serverUrl = serverUrlInput.value.trim();
    const masterKey = masterKeyInput.value.trim();

    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({
        tessera_server_url: serverUrl,
        tessera_master_key: masterKey,
      });
    }

    settingsDrawer.classList.remove('open');
    statusEl.className = 'status status-info';
    statusEl.textContent = '⚙️ Sync settings saved. Fetching collections...';
    statusEl.style.display = 'block';

    await refreshCollectionsAndStatus();
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 2000);
  });

  // Auto-populate current tab URL and Title
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        urlInput.value = tab.url;
        titleInput.value = tab.title || tab.url;
      }
    } catch {}
  }

  // Handle Collection dropdown
  collectionSelect.addEventListener('change', () => {
    if (collectionSelect.value === '__new__') {
      customColWrap.style.display = 'block';
      customColInput.focus();
    } else {
      customColWrap.style.display = 'none';
    }
  });

  // Save bookmark logic
  const handleSave = async (isVault: boolean) => {
    const rawUrl = urlInput.value.trim();
    const rawTitle = titleInput.value.trim();

    if (!rawUrl) {
      urlInput.focus();
      return;
    }

    let selectedCollection = collectionSelect.value;
    if (selectedCollection === '__new__') {
      selectedCollection = customColInput.value.trim();
      if (selectedCollection && typeof chrome !== 'undefined' && chrome.storage) {
        const existing = (await chrome.storage.local.get('tessera_collections'))?.['tessera_collections'] || [];
        if (!existing.includes(selectedCollection)) {
          await chrome.storage.local.set({
            tessera_collections: [...existing, selectedCollection],
          });
        }
      }
    }

    const bookmarkId = crypto.randomUUID();
    const bookmarkData = {
      id: bookmarkId,
      url: rawUrl,
      title: rawTitle || rawUrl,
      collection: selectedCollection || null,
      collectionId: selectedCollection || null,
      isVault: Boolean(isVault),
      tags: tagsInput.value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
      notes: notesInput.value.trim(),
      createdAt: new Date().toISOString(),
    };

    let pushedToCloud = false;

    // Check if cloud sync is available
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const data = await chrome.storage.local.get(['tessera_server_url', 'tessera_master_key']);
      const serverUrl = data['tessera_server_url'];
      const masterKeyBase64 = data['tessera_master_key'];

      if (serverUrl && masterKeyBase64) {
        try {
          const masterKey = base64ToUint8Array(masterKeyBase64);
          const recordKey = await deriveRecordKey(masterKey, bookmarkId, 'bookmark');
          const sealed = await sealRecord(bookmarkData, recordKey);

          const delta: SyncDelta = {
            id: crypto.randomUUID(),
            deviceId: 'browser-extension',
            timestamp: Date.now(),
            version: 1,
            operation: 'upsert',
            entityType: 'bookmark',
            entityId: bookmarkId,
            encryptedData: sealed,
            nonce: sealed.slice(0, 32),
          };

          const cleanUrl = serverUrl.replace(/\/+$/, '');
          const res = await fetch(`${cleanUrl}/api/sync/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deltas: [delta] }),
          });

          if (res.ok) {
            pushedToCloud = true;
          }
        } catch {}
      }

      // Always save to quick queue as backup
      const existing = (await chrome.storage.local.get('tessera_quick_queue'))?.['tessera_quick_queue'] || [];
      await chrome.storage.local.set({
        tessera_quick_queue: [...existing, bookmarkData],
      });

      if (chrome.action) {
        chrome.action.setBadgeText({ text: isVault ? '🔒' : '✓' });
        chrome.action.setBadgeBackgroundColor({ color: isVault ? '#f59e0b' : '#38bdf8' });
        setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2500);
      }
    }

    statusEl.className = `status ${isVault ? 'status-vault' : 'status-library'}`;
    statusEl.textContent = pushedToCloud
      ? (isVault ? '🔒 Synced to Cloud Vault & Saved' : '✓ Synced to Cloud Library & Saved')
      : (isVault ? '🔒 Saved to Local Vault & Queued' : '✓ Saved to Local Library & Queued');
    statusEl.style.display = 'block';

    btnSaveLibrary.disabled = true;
    btnSaveVault.disabled = true;

    setTimeout(() => {
      window.close();
    }, 1200);
  };

  btnSaveLibrary.addEventListener('click', () => handleSave(false));
  btnSaveVault.addEventListener('click', () => handleSave(true));

  // Initialize
  await refreshCollectionsAndStatus();
});
