import React, { useState } from 'react';
import { useLibraryStore } from './store/useLibraryStore.js';
import { Header } from './components/Header.js';
import { Sidebar } from './components/Sidebar.js';
import { BookmarkList } from './components/BookmarkList.js';
import { AddBookmarkModal } from './components/AddBookmarkModal.js';
import { KeyManagementModal } from './components/KeyManagementModal.js';
import { AuditLogModal } from './components/AuditLogModal.js';
import { ExtensionManagerModal } from './components/ExtensionManagerModal.js';
import { VaultPinModal } from './components/VaultPinModal.js';
import { VaultSettingsModal } from './components/VaultSettingsModal.js';
import { CommandPalette } from './components/CommandPalette.js';
import { Lock, Shield, KeyRound, ArrowRight } from 'lucide-react';
import type { Bookmark } from '@tessera/schemas';

export const App: React.FC = () => {
  const store = useLibraryStore();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);
  const [isVaultPinModalOpen, setIsVaultPinModalOpen] = useState(false);
  const [isVaultSettingsModalOpen, setIsVaultSettingsModalOpen] = useState(false);

  const isViewingVault = store.activeSection === 'vault';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg)' }}>
      <Header
        searchQuery={store.searchQuery}
        onSearchChange={store.setSearchQuery}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenKeyModal={() => setIsKeyModalOpen(true)}
        onOpenAuditModal={() => setIsAuditModalOpen(true)}
        onOpenExtensionModal={() => setIsExtensionModalOpen(true)}
        onOpenVaultModal={() => setIsVaultPinModalOpen(true)}
        onOpenVaultSettings={() => setIsVaultSettingsModalOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        isVaultConfigured={store.vaultConfig.isConfigured}
        isVaultUnlocked={store.isVaultUnlocked}
        onSync={store.performSync}
        isSyncing={store.isSyncing}
        pendingDeltasCount={store.pendingDeltasCount}
        viewLayout={viewLayout}
        onToggleLayout={setViewLayout}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar
          isCollapsed={!isSidebarOpen}
          viewFilter={store.viewFilter}
          onSelectView={store.setViewFilter}
          collections={store.collections}
          selectedCollectionId={store.selectedCollectionId}
          onSelectCollection={store.setSelectedCollectionId}
          onAddCollection={store.addCollection}
          onDeleteCollection={store.deleteCollection}
          tags={store.tags}
          selectedTag={store.selectedTag}
          onSelectTag={store.setSelectedTag}
          onAddTag={store.addTag}
          onDeleteTag={store.deleteTag}
          allBookmarksCount={store.allBookmarksCount}
          vaultBookmarksCount={store.vaultBookmarksCount}
          activeSection={store.activeSection}
          onSelectSection={store.setActiveSection}
          isVaultConfigured={store.vaultConfig.isConfigured}
          isVaultUnlocked={store.isVaultUnlocked}
          onOpenVaultPinModal={() => setIsVaultPinModalOpen(true)}
          onOpenVaultSettingsModal={() => setIsVaultSettingsModalOpen(true)}
          onLockVault={store.lockVault}
          deviceId={store.deviceId}
        />

        <main style={{ flex: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 57px)' }}>
          {/* Vault locked hero state */}
          {isViewingVault && !store.isVaultUnlocked ? (
            <div
              className="animate-fade"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '90px 20px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border-hover)',
                  color: 'var(--amber)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '18px',
                  boxShadow: 'var(--shadow-md)',
                }}
              >
                <Lock size={26} />
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px', letterSpacing: '-0.3px' }}>
                {store.vaultConfig.isConfigured ? 'Private Vault is Locked' : 'Private Vault Not Configured'}
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '380px', lineHeight: 1.45, marginBottom: '22px' }}>
                {store.vaultConfig.isConfigured
                  ? 'Enter your 7-digit PIN to decrypt isolated vault bookmarks and notes.'
                  : 'Configure a 7-digit PIN with wipe-after-N protection to store sensitive items.'}
              </p>
              <div>
                {store.vaultConfig.isConfigured ? (
                  <button
                    onClick={() => setIsVaultPinModalOpen(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 20px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--amber)',
                      color: '#030712',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    <KeyRound size={15} />
                    <span>Enter 7-Digit PIN</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsVaultSettingsModalOpen(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 20px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--accent)',
                      color: '#030712',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    <Shield size={15} />
                    <span>Configure Vault</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* View summary header */}
              <div
                style={{
                  padding: '16px 28px 4px 28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
                      {isViewingVault
                        ? 'Private Vault'
                        : store.selectedTag
                          ? `#${store.selectedTag}`
                          : store.selectedCollectionId
                            ? store.collections.find((c) => c.id === store.selectedCollectionId)?.name || 'Collection'
                            : store.viewFilter === 'favorites'
                              ? 'Favorites'
                              : store.viewFilter === 'pinned'
                                ? 'Pinned'
                                : store.viewFilter === 'archived'
                                  ? 'Archive'
                                  : 'All Bookmarks'}
                    </h2>
                    {isViewingVault && (
                      <span
                        style={{
                          fontSize: '9.5px',
                          fontFamily: 'var(--font-mono)',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          background: 'var(--green-dim)',
                          color: 'var(--green)',
                          fontWeight: 600,
                        }}
                      >
                        DECRYPTED
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    {store.bookmarks.length} {store.bookmarks.length === 1 ? 'item' : 'items'}
                    {store.searchQuery && ` matching "${store.searchQuery}"`}
                  </span>
                </div>

                {isViewingVault && (
                  <button
                    onClick={store.lockVault}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-secondary)',
                      fontSize: '12px',
                    }}
                  >
                    <Lock size={12} />
                    <span>Lock Vault</span>
                  </button>
                )}
              </div>

              <BookmarkList
                bookmarks={store.bookmarks}
                collections={store.collections}
                onToggleFavorite={store.toggleFavorite}
                onTogglePin={store.togglePin}
                onToggleArchive={store.toggleArchive}
                onDelete={store.deleteBookmark}
                onSelectTag={store.setSelectedTag}
                onEditBookmark={(bookmark) => {
                  setEditingBookmark(bookmark);
                  setIsAddModalOpen(true);
                }}
                searchQuery={store.searchQuery}
                viewLayout={viewLayout}
                onOpenAddModal={() => {
                  setEditingBookmark(null);
                  setIsAddModalOpen(true);
                }}
              />
            </>
          )}
        </main>
      </div>

      {/* Modals & Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        bookmarks={store.bookmarks}
        onOpenAddBookmark={() => {
          setEditingBookmark(null);
          setIsAddModalOpen(true);
        }}
        onOpenVault={() => setIsVaultPinModalOpen(true)}
        onLockVault={store.lockVault}
        isVaultUnlocked={store.isVaultUnlocked}
        onSync={store.performSync}
        onOpenKeyModal={() => setIsKeyModalOpen(true)}
        onOpenAuditModal={() => setIsAuditModalOpen(true)}
        onOpenExtensionModal={() => setIsExtensionModalOpen(true)}
        onSelectBookmark={(url) => window.open(url, '_blank')}
      />

      <AddBookmarkModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingBookmark(null);
        }}
        onAdd={store.addBookmark}
        onUpdate={store.updateBookmark}
        bookmarkToEdit={editingBookmark}
        collections={store.collections}
        tags={store.tags}
        serverUrl={store.syncServerUrl}
        isVaultUnlocked={store.isVaultUnlocked}
        defaultIsVault={isViewingVault}
      />

      <KeyManagementModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        masterKeyBase64={store.masterKeyBase64}
        onImportKey={store.importMasterKey}
        onExportFullBackup={store.exportFullBackup}
        onRestoreFullBackup={store.restoreFullBackup}
        onSync={() => store.performSync(true)}
        onForcePush={() => store.performSync(true)}
      />

      <AuditLogModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        auditLogs={store.auditLogs}
      />

      <ExtensionManagerModal
        isOpen={isExtensionModalOpen}
        onClose={() => setIsExtensionModalOpen(false)}
        installedExtensions={store.installedExtensions}
        bookmarks={store.bookmarks}
        tags={store.tags}
        onAddBookmark={store.addBookmark}
        onAddTag={store.addTag}
        onLogAudit={store.logAudit}
      />

      <VaultPinModal
        isOpen={isVaultPinModalOpen}
        onClose={() => setIsVaultPinModalOpen(false)}
        onUnlock={store.unlockVault}
        failedAttempts={store.vaultConfig.failedAttempts}
        wipeAfterAttempts={store.vaultConfig.wipeAfterAttempts}
      />

      <VaultSettingsModal
        isOpen={isVaultSettingsModalOpen}
        onClose={() => setIsVaultSettingsModalOpen(false)}
        vaultConfig={store.vaultConfig}
        isVaultUnlocked={store.isVaultUnlocked}
        onSetupVault={store.setupVault}
        onRestoreVaultFromSync={store.restoreVaultFromSync}
        onEnableSync={store.enableVaultSync}
        onDisableSync={store.disableVaultSync}
        onWipeVault={store.wipeVaultData}
      />
    </div>
  );
};
