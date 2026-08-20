import React from 'react';
import { BookmarkCard } from './BookmarkCard.js';
import type { Bookmark, Collection } from '@tessera/schemas';
import { Bookmark as BookmarkIcon, Plus } from 'lucide-react';

interface BookmarkListProps {
  bookmarks: Bookmark[];
  collections: Collection[];
  onToggleFavorite: (id: string) => void;
  onTogglePin: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onSelectTag: (tag: string) => void;
  onEditBookmark?: (bookmark: Bookmark) => void;
  searchQuery?: string;
  viewLayout?: 'grid' | 'list';
  onOpenAddModal?: () => void;
}

export const BookmarkList: React.FC<BookmarkListProps> = ({
  bookmarks = [],
  collections = [],
  onToggleFavorite,
  onTogglePin,
  onToggleArchive,
  onDelete,
  onSelectTag,
  onEditBookmark,
  searchQuery,
  viewLayout = 'grid',
  onOpenAddModal,
}) => {
  const items = Array.isArray(bookmarks) ? bookmarks : [];

  if (items.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 20px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            marginBottom: '16px',
          }}
        >
          <BookmarkIcon size={22} />
        </div>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
          {searchQuery ? `No results for "${searchQuery}"` : 'No bookmarks in this view'}
        </h3>
        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', maxWidth: '320px', lineHeight: 1.45, marginBottom: '18px' }}>
          {searchQuery
            ? 'Try adjusting your search terms or clearing the active tag filter.'
            : 'Save articles, docs, and links with zero-knowledge end-to-end encryption.'}
        </p>
        {onOpenAddModal && !searchQuery && (
          <button
            onClick={onOpenAddModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: '12.5px',
              fontWeight: 500,
            }}
          >
            <Plus size={14} />
            <span>Add Bookmark</span>
          </button>
        )}
      </div>
    );
  }

  // Compact List Mode
  if (viewLayout === 'list') {
    return (
      <div style={{ padding: '16px 28px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {items.map((bookmark) => (
          <BookmarkCard
            key={bookmark.id}
            bookmark={bookmark}
            collections={collections}
            onToggleFavorite={onToggleFavorite}
            onTogglePin={onTogglePin}
            onToggleArchive={onToggleArchive}
            onDelete={onDelete}
            onSelectTag={onSelectTag}
            onEdit={onEditBookmark}
            isCompact={true}
          />
        ))}
      </div>
    );
  }

  // Modern Responsive Grid Mode
  return (
    <div
      style={{
        padding: '20px 28px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '14px',
      }}
    >
      {items.map((bookmark) => (
        <BookmarkCard
          key={bookmark.id}
          bookmark={bookmark}
          collections={collections}
          onToggleFavorite={onToggleFavorite}
          onTogglePin={onTogglePin}
          onToggleArchive={onToggleArchive}
          onDelete={onDelete}
          onSelectTag={onSelectTag}
          onEdit={onEditBookmark}
          isCompact={false}
        />
      ))}
    </div>
  );
};
