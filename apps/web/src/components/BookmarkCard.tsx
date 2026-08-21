import React, { useState } from 'react';
import {
  ExternalLink,
  Star,
  Pin,
  Archive,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Lock,
  Pencil,
} from 'lucide-react';
import type { Bookmark, Collection } from '@tessera/schemas';

interface BookmarkCardProps {
  bookmark: Bookmark;
  collections: Collection[];
  onToggleFavorite: (id: string) => void;
  onTogglePin: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onSelectTag: (tag: string) => void;
  onEdit?: (bookmark: Bookmark) => void;
  isCompact?: boolean;
}

export const BookmarkCard: React.FC<BookmarkCardProps> = ({
  bookmark,
  collections,
  onToggleFavorite,
  onTogglePin,
  onToggleArchive,
  onDelete,
  onSelectTag,
  onEdit,
  isCompact = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const collection = (collections || []).find((c) => c && c.id === bookmark.collectionId);

  const getHostname = (urlStr: string): string => {
    try {
      return new URL(urlStr).hostname.replace(/^www\./, '');
    } catch {
      return urlStr;
    }
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(bookmark.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const domain = getHostname(bookmark.url);
  const favicon = bookmark.faviconUrl || `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

  // Compact Row Layout
  if (isCompact) {
    return (
      <div
        className="animate-fade"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
          background: isHovered ? 'var(--surface-hover)' : 'var(--surface)',
          border: `1px solid ${isHovered ? 'var(--border-hover)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-sm)',
          gap: '14px',
          transition: 'all 0.12s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
          <img
            src={favicon}
            alt=""
            style={{ width: '16px', height: '16px', borderRadius: '3px', flexShrink: 0 }}
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
            {bookmark.isVault && <Lock size={12} style={{ color: 'var(--amber)', flexShrink: 0 }} />}
            {bookmark.isPinned && <Pin size={12} fill="var(--amber)" style={{ color: 'var(--amber)', flexShrink: 0 }} />}
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                textDecoration: 'none',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            >
              {bookmark.title}
            </a>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
              {domain}
            </span>
          </div>
        </div>

        {/* Tags & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {(bookmark.tags || []).slice(0, 2).map((tag) => (
            <button
              key={tag}
              onClick={() => onSelectTag(tag)}
              style={{
                fontSize: '10.5px',
                fontFamily: 'var(--font-mono)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--accent-dim)',
                color: 'var(--accent-text)',
              }}
            >
              #{tag}
            </button>
          ))}

          {/* Quick Actions (Hover) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', opacity: isHovered ? 1 : 0.4, transition: 'opacity 0.15s ease' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
              title="Copy URL"
              style={{ padding: '4px', color: copied ? 'var(--green)' : 'var(--text-muted)' }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(bookmark);
                }}
                title="Edit Bookmark"
                style={{ padding: '4px', color: 'var(--text-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <Pencil size={13} />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(bookmark.id);
              }}
              title={bookmark.isPinned ? 'Unpin' : 'Pin'}
              style={{
                padding: '4px',
                color: bookmark.isPinned ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              <Pin size={13} fill={bookmark.isPinned ? 'var(--text-primary)' : 'none'} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(bookmark.id);
              }}
              title={bookmark.isFavorite ? 'Remove Favorite' : 'Favorite'}
              style={{
                padding: '4px',
                color: bookmark.isFavorite ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              <Star size={13} fill={bookmark.isFavorite ? 'var(--text-primary)' : 'none'} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleArchive(bookmark.id);
              }}
              title={bookmark.isArchived ? 'Unarchive' : 'Archive'}
              style={{
                padding: '4px',
                color: bookmark.isArchived ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              <Archive size={13} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(bookmark.id);
              }}
              title="Delete"
              style={{ padding: '4px', color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Grid Card Layout
  return (
    <div
      className="animate-fade"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: 'var(--surface)',
        border: `1px solid ${isHovered ? 'var(--border-hover)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '9px',
        position: 'relative',
        boxShadow: isHovered ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Header: domain, badge, action bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <img
            src={favicon}
            alt=""
            style={{ width: '15px', height: '15px', borderRadius: '3px' }}
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {domain}
          </span>
          {bookmark.isVault && (
            <span
              style={{
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                padding: '1px 5px',
                borderRadius: '3px',
                background: 'var(--amber-dim)',
                color: 'var(--amber)',
                fontWeight: 600,
              }}
            >
              VAULT
            </span>
          )}
        </div>

        {/* Action icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1px', opacity: isHovered ? 1 : 0.6, transition: 'opacity 0.15s ease' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopy(e);
            }}
            title="Copy URL"
            style={{
              padding: '3px',
              borderRadius: 'var(--radius-sm)',
              color: copied ? 'var(--green)' : 'var(--text-muted)',
            }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(bookmark);
              }}
              title="Edit Bookmark"
              style={{
                padding: '3px',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <Pencil size={12} />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(bookmark.id);
            }}
            title={bookmark.isPinned ? 'Unpin' : 'Pin'}
            style={{
              padding: '3px',
              borderRadius: 'var(--radius-sm)',
              color: bookmark.isPinned ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            <Pin size={12} fill={bookmark.isPinned ? 'var(--text-primary)' : 'none'} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(bookmark.id);
            }}
            title={bookmark.isFavorite ? 'Remove Favorite' : 'Favorite'}
            style={{
              padding: '3px',
              borderRadius: 'var(--radius-sm)',
              color: bookmark.isFavorite ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            <Star size={12} fill={bookmark.isFavorite ? 'var(--text-primary)' : 'none'} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleArchive(bookmark.id);
            }}
            title={bookmark.isArchived ? 'Unarchive' : 'Archive'}
            style={{
              padding: '3px',
              borderRadius: 'var(--radius-sm)',
              color: bookmark.isArchived ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            <Archive size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(bookmark.id);
            }}
            title="Delete"
            style={{
              padding: '3px',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Title & External Link */}
      <div>
        <a
          href={bookmark.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            textDecoration: 'none',
            lineHeight: 1.35,
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: '5px',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
        >
          <span>{bookmark.title}</span>
          <ExternalLink size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        </a>

        {bookmark.description && (
          <p
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              lineHeight: 1.45,
              marginTop: '4px',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {bookmark.description}
          </p>
        )}
      </div>

      {/* Notes Drawer */}
      {bookmark.notes && (
        <div style={{ marginTop: '1px' }}>
          <button
            onClick={() => setShowNotes(!showNotes)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '10.5px',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span>Notes</span>
            {showNotes ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>

          {showNotes && (
            <div
              style={{
                marginTop: '5px',
                padding: '7px 9px',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '11px',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.4,
                borderLeft: '2px solid var(--accent)',
              }}
            >
              {bookmark.notes}
            </div>
          )}
        </div>
      )}

      {/* Bottom: Tags & Collection */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '6px',
          marginTop: 'auto',
          paddingTop: '2px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {(bookmark.tags || []).map((tag) => (
            <button
              key={tag}
              onClick={() => onSelectTag(tag)}
              style={{
                fontSize: '10.5px',
                fontFamily: 'var(--font-mono)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--accent-dim)',
                color: 'var(--accent-text)',
                fontWeight: 500,
              }}
            >
              #{tag}
            </button>
          ))}
        </div>

        {collection && (
          <div
            style={{
              fontSize: '10.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: 'var(--text-muted)',
            }}
          >
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: collection.color || 'var(--accent)',
              }}
            />
            <span>{collection.name}</span>
          </div>
        )}
      </div>
    </div>
  );
};
