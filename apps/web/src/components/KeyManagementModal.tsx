import React, { useState, useRef } from 'react';
import { X, Key, Shield, Copy, Check, Download, Upload, FileUp, AlertCircle, RefreshCw } from 'lucide-react';

interface KeyManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterKeyBase64: string;
  onImportKey: (base64Key: string) => { success: boolean; error?: string } | boolean;
  onExportFullBackup?: () => any;
  onRestoreFullBackup?: (backup: any) => Promise<{ success: boolean; count?: number; error?: string }>;
  onSync?: () => void;
  onForcePush?: () => Promise<{ pushedCount: number; success: boolean }>;
}

export const KeyManagementModal: React.FC<KeyManagementModalProps> = ({
  isOpen,
  onClose,
  masterKeyBase64,
  onImportKey,
  onExportFullBackup,
  onRestoreFullBackup,
  onSync,
  onForcePush,
}) => {
  const [copied, setCopied] = useState(false);
  const [importKeyInput, setImportKeyInput] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleCopyKey = () => {
    navigator.clipboard.writeText(masterKeyBase64);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadBackup = () => {
    let payloadStr = '';
    if (onExportFullBackup) {
      const full = onExportFullBackup();
      payloadStr = JSON.stringify(full, null, 2);
    } else {
      payloadStr = JSON.stringify(
        {
          type: 'tessera_master_key_backup',
          version: 1,
          exportedAt: new Date().toISOString(),
          key: masterKeyBase64,
        },
        null,
        2
      );
    }

    const blob = new Blob([payloadStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tessera-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setImportStatus('Full backup file downloaded successfully.');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        const parsed = JSON.parse(text);

        if (onRestoreFullBackup && (parsed.bookmarks || parsed.type === 'tessera_full_backup')) {
          const res = await onRestoreFullBackup(parsed);
          if (res.success) {
            setImportStatus(`Successfully restored ${res.count ?? 'all'} bookmarks and Master Key!`);
          } else {
            setImportStatus(res.error || 'Failed to restore backup file');
          }
        } else {
          const keyToImport = parsed.key || parsed.masterKey || text;
          const res = onImportKey(keyToImport);
          const isSuccess = typeof res === 'boolean' ? res : Boolean(res?.success);
          if (isSuccess) {
            setImportStatus('Master key restored and synced successfully!');
          } else {
            setImportStatus(typeof res === 'object' && res.error ? res.error : 'Invalid key format.');
          }
        }
      } catch {
        setImportStatus('Failed to parse backup JSON file.');
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importKeyInput.trim()) return;

    try {
      const rawInput = importKeyInput.trim();
      if (rawInput.startsWith('{') && onRestoreFullBackup) {
        const parsed = JSON.parse(rawInput);
        const res = await onRestoreFullBackup(parsed);
        if (res.success) {
          setImportStatus(`Successfully restored ${res.count ?? 'all'} bookmarks and Master Key!`);
          setImportKeyInput('');
          return;
        }
      }

      const res = onImportKey(rawInput);
      const isSuccess = typeof res === 'boolean' ? res : Boolean(res?.success);
      if (isSuccess) {
        setImportStatus('Master key restored and cloud sync triggered!');
        setImportKeyInput('');
      } else {
        const errMsg = typeof res === 'object' && res.error ? res.error : 'Invalid key format. Provide a 32-byte Base64 key.';
        setImportStatus(errMsg);
      }
    } catch {
      setImportStatus('Invalid input. Provide a 32-byte Base64 key or backup JSON.');
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
          maxWidth: '540px',
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
            <Key size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '14.5px', fontWeight: 600 }}>Master Key & Multi-Device Sync</span>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', padding: '4px' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Info banner */}
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              lineHeight: 1.45,
            }}
          >
            <Shield size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              Your library is encrypted with <strong>XChaCha20-Poly1305</strong>. To access your bookmarks on other browsers, pair this Master Key or import your backup file.
            </div>
          </div>

          {/* Current Master Key Display */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Your 256-Bit Master Key (Base64)
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  flex: 1,
                  wordBreak: 'break-all',
                }}
              >
                {masterKeyBase64}
              </span>
              <button
                onClick={handleCopyKey}
                title="Copy Master Key"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-hover)',
                  border: '1px solid var(--border)',
                  color: copied ? 'var(--green)' : 'var(--text-secondary)',
                  fontSize: '11.5px',
                  flexShrink: 0,
                }}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Export & Import Backup File Buttons */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Direct Backup & File Migration
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleDownloadBackup}
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                <Download size={13} />
                <span>Download Full Backup (.json)</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                <FileUp size={13} />
                <span>Restore Backup File (.json)</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {/* Cloud Push & Sync Trigger */}
          {onForcePush && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Cloud Relay Sync
              </label>
              <button
                onClick={async () => {
                  setIsProcessing(true);
                  setImportStatus('Pushing all encrypted bookmarks to cloud relay...');
                  try {
                    const res = await onForcePush();
                    if (res.success) {
                      setImportStatus(`Pushed ${res.pushedCount} encrypted items to cloud relay successfully!`);
                    } else {
                      setImportStatus('Failed to push to cloud relay.');
                    }
                  } catch {
                    setImportStatus('Cloud push error.');
                  } finally {
                    setIsProcessing(false);
                  }
                }}
                disabled={isProcessing}
                style={{
                  width: '100%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-hover)',
                  border: '1px solid var(--border-hover)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                <RefreshCw size={13} style={{ animation: isProcessing ? 'spin 1s linear infinite' : 'none' }} />
                <span>Push All Bookmarks to Cloud Relay (Force Sync)</span>
              </button>
            </div>
          )}

          {/* Pair with Another Browser / Device */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <Shield size={14} style={{ color: 'var(--accent)' }} />
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Pair Another Device / Browser
              </label>
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: '10px' }}>
              Enter the Master Key from your other browser to pair them:
            </p>
            <form onSubmit={handleImportSubmit} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={importKeyInput}
                onChange={(e) => setImportKeyInput(e.target.value)}
                placeholder="Paste Master Key here..."
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-hover)',
                  border: '1px solid var(--accent)',
                  color: 'var(--accent)',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                <Upload size={13} />
                <span>Pair Key</span>
              </button>
            </form>
            {Boolean(importStatus) && (
              <p
                style={{
                  fontSize: '11.5px',
                  color: typeof importStatus === 'string' && (importStatus.toLowerCase().includes('success') || importStatus.toLowerCase().includes('downloaded')) ? 'var(--green)' : 'var(--rose)',
                  marginTop: '8px',
                }}
              >
                {importStatus}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
