/**
 * Extension popup script
 */

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

  // 1. Load cached custom collections
  if (typeof chrome !== 'undefined' && chrome.storage) {
    try {
      const stored = (await chrome.storage.local.get('tessera_collections'))?.['tessera_collections'] || [];
      if (Array.isArray(stored)) {
        for (const colName of stored) {
          if (!Array.from(collectionSelect.options).some((o) => o.value === colName)) {
            const opt = document.createElement('option');
            opt.value = colName;
            opt.textContent = colName;
            // Insert before "__new__"
            collectionSelect.insertBefore(opt, collectionSelect.lastElementChild);
          }
        }
      }
    } catch {}
  }

  // 2. Auto-populate current tab URL and Title
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        urlInput.value = tab.url;
        titleInput.value = tab.title || tab.url;
      }
    } catch {}
  }

  // 3. Handle Collection Selection dropdown
  collectionSelect.addEventListener('change', () => {
    if (collectionSelect.value === '__new__') {
      customColWrap.style.display = 'block';
      customColInput.focus();
    } else {
      customColWrap.style.display = 'none';
    }
  });

  // 4. Save bookmark logic
  const handleSave = async (isVault: boolean) => {
    const rawUrl = urlInput.value.trim();
    const rawTitle = titleInput.value.trim();

    if (!rawUrl) {
      urlInput.focus();
      return;
    }

    // Determine collection name
    let selectedCollection = collectionSelect.value;
    if (selectedCollection === '__new__') {
      selectedCollection = customColInput.value.trim();
      if (selectedCollection && typeof chrome !== 'undefined' && chrome.storage) {
        // Save new collection to storage
        const existing = (await chrome.storage.local.get('tessera_collections'))?.['tessera_collections'] || [];
        if (!existing.includes(selectedCollection)) {
          await chrome.storage.local.set({
            tessera_collections: [...existing, selectedCollection],
          });
        }
      }
    }

    const bookmarkData = {
      id: crypto.randomUUID(),
      url: rawUrl,
      title: rawTitle || rawUrl,
      collection: selectedCollection || null,
      collectionId: selectedCollection || null,
      isVault: Boolean(isVault),
      tags: tagsInput.value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
      notes: notesInput.value.trim(),
      createdAt: new Date().toISOString(),
    };

    if (typeof chrome !== 'undefined' && chrome.storage) {
      const existing = (await chrome.storage.local.get('tessera_quick_queue'))?.['tessera_quick_queue'] || [];
      await chrome.storage.local.set({
        tessera_quick_queue: [...existing, bookmarkData],
      });

      // Show confirmation badge
      if (chrome.action) {
        chrome.action.setBadgeText({ text: isVault ? '🔒' : '✓' });
        chrome.action.setBadgeBackgroundColor({ color: isVault ? '#f59e0b' : '#38bdf8' });
        setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2500);
      }
    }

    // Visual feedback in popup
    statusEl.className = `status ${isVault ? 'status-vault' : 'status-library'}`;
    statusEl.textContent = isVault ? '🔒 Saved to Private Vault & Queued' : '✓ Saved to Library & Queued';
    statusEl.style.display = 'block';

    btnSaveLibrary.disabled = true;
    btnSaveVault.disabled = true;

    setTimeout(() => {
      window.close();
    }, 1100);
  };

  btnSaveLibrary.addEventListener('click', () => handleSave(false));
  btnSaveVault.addEventListener('click', () => handleSave(true));
});
