import React, { useState } from 'react';
import { X, Puzzle, Play, CheckCircle, AlertTriangle, ShieldCheck, Download } from 'lucide-react';
import type { ExtensionManifest, Bookmark, Tag } from '@tessera/schemas';

interface ExtensionManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  installedExtensions: ExtensionManifest[];
  bookmarks: Bookmark[];
  tags: Tag[];
  onAddBookmark: (bookmark: any) => void;
  onAddTag: (name: string) => void;
  onLogAudit: (
    type: any,
    status: any,
    details?: Record<string, unknown>,
    errorMessage?: string,
  ) => void;
}

export const ExtensionManagerModal: React.FC<ExtensionManagerModalProps> = ({
  isOpen,
  onClose,
  installedExtensions,
  bookmarks,
  tags,
  onAddBookmark,
  onAddTag,
  onLogAudit,
}) => {
  const [activeTab, setActiveTab] = useState<'installed' | 'run'>('installed');
  const [runningExtId, setRunningExtId] = useState<string | null>(null);
  const [executionOutput, setExecutionOutput] = useState<string | null>(null);
  const [importInput, setImportInput] = useState('');

  if (!isOpen) return null;

  const handleRunExtension = async (ext: ExtensionManifest) => {
    setRunningExtId(ext.id);
    setExecutionOutput(null);

    try {
      if (ext.id === 'pinboard-import') {
        if (!importInput.trim()) {
          setExecutionOutput('Please paste Pinboard JSON into the input box below.');
          setRunningExtId(null);
          return;
        }

        const data = JSON.parse(importInput);
        if (!Array.isArray(data)) {
          throw new Error('Pinboard export must be a JSON array of bookmark objects.');
        }

        let importedCount = 0;
        for (const item of data) {
          if (!item.href && !item.url) continue;

          const itemTags = (item.tags || item.tag || '')
            .split(' ')
            .map((t: string) => t.trim().toLowerCase())
            .filter(Boolean);

          for (const t of itemTags) {
            onAddTag(t);
          }

          onAddBookmark({
            url: item.href || item.url,
            title: item.description || item.title || item.href,
            description: item.extended || item.summary || '',
            tags: itemTags,
            isFavorite: item.shared === 'no',
            isPinned: false,
          });
          importedCount++;
        }

        onLogAudit('extension_rpc_executed', 'success', { extensionId: ext.id, importedCount });
        setExecutionOutput(`Successfully imported ${importedCount} bookmark(s) via ${ext.name}!`);
        setImportInput('');
      } else if (ext.id === 'markdown-export') {
        const lines: string[] = [
          `# Tessera Bookmark Library Export`,
          `*Exported on ${new Date().toLocaleString()}*`,
          '',
        ];

        for (const b of (bookmarks || [])) {
          const tagStr = (b.tags || []).map((t) => `#${t}`).join(' ');
          lines.push(`- [${b.title}](${b.url}) ${tagStr}`);
          if (b.description) lines.push(`  > ${b.description}`);
          if (b.notes) lines.push(`  \`\`\`notes\n  ${b.notes}\n  \`\`\``);
        }

        const mdContent = lines.join('\n');
        const blob = new Blob([mdContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tessera-export-${new Date().toISOString().slice(0, 10)}.md`;
        a.click();
        URL.revokeObjectURL(url);

        onLogAudit('export_data', 'success', { format: 'markdown', count: (bookmarks || []).length });
        setExecutionOutput(`Successfully exported ${(bookmarks || []).length} bookmarks to Markdown!`);
      }
    } catch (err) {
      const msg = (err as Error).message;
      setExecutionOutput(`Execution Error: ${msg}`);
      onLogAudit('extension_rpc_denied', 'error', { extensionId: ext.id }, msg);
    } finally {
      setRunningExtId(null);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 9, 18, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="animate-modal"
        style={{
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-hover)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '620px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Puzzle size={16} style={{ color: 'var(--accent)' }} />
            <div>
              <h3 style={{ fontSize: '14.5px', fontWeight: 600 }}>Extension Manager</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Sandboxed plugins with explicit capability gating
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', padding: '4px' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          {/* Extension Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {installedExtensions.map((ext) => (
              <div
                key={ext.id}
                style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {ext.name}
                      </span>
                      <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        v{ext.version}
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {ext.description}
                    </p>
                  </div>

                  <button
                    onClick={() => handleRunExtension(ext)}
                    disabled={runningExtId === ext.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface-hover)',
                      border: '1px solid var(--border)',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      flexShrink: 0,
                    }}
                  >
                    <Play size={12} />
                    <span>Run</span>
                  </button>
                </div>

                {/* Permissions / Capabilities pills */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10.5px', color: 'var(--text-muted)' }}>
                    <ShieldCheck size={12} style={{ color: 'var(--green)' }} />
                    <span>Permissions:</span>
                  </div>
                  {(ext.permissions || (ext as any).capabilities || []).map((perm: string) => (
                    <span
                      key={perm}
                      style={{
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        background: 'var(--surface-active)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {perm}
                    </span>
                  ))}
                </div>

                {/* Pinboard JSON Input if running */}
                {ext.id === 'pinboard-import' && (
                  <div style={{ marginTop: '4px' }}>
                    <textarea
                      rows={3}
                      value={importInput}
                      onChange={(e) => setImportInput(e.target.value)}
                      placeholder='Paste Pinboard JSON export here (e.g. [{"href":"https://...", "description":"..."}])...'
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        outline: 'none',
                        resize: 'none',
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Output feedback */}
          {executionOutput && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface)',
                border: '1px solid var(--accent)',
                color: 'var(--accent-text)',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {executionOutput}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
