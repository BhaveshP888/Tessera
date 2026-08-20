/**
 * Extension popup script
 */

document.addEventListener('DOMContentLoaded', async () => {
  const urlInput = document.getElementById('url') as HTMLInputElement;
  const titleInput = document.getElementById('title') as HTMLInputElement;
  const tagsInput = document.getElementById('tags') as HTMLInputElement;
  const notesInput = document.getElementById('notes') as HTMLTextAreaElement;
  const form = document.getElementById('save-form') as HTMLFormElement;
  const statusEl = document.getElementById('status') as HTMLDivElement;

  // Auto-populate current tab
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      urlInput.value = tab.url;
      titleInput.value = tab.title || tab.url;
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const bookmarkData = {
      id: crypto.randomUUID(),
      url: urlInput.value.trim(),
      title: titleInput.value.trim(),
      tags: tagsInput.value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
      notes: notesInput.value.trim(),
      createdAt: new Date().toISOString(),
    };

    if (typeof chrome !== 'undefined' && chrome.storage) {
      const existing = (await chrome.storage.local.get('tessera_quick_queue'))?.['tessera_quick_queue'] || [];
      await chrome.storage.local.set({
        tessera_quick_queue: [...existing, bookmarkData],
      });
    }

    statusEl.style.display = 'block';
    setTimeout(() => {
      window.close();
    }, 1200);
  });
});
