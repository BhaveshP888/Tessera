import { defineExtension } from '@tessera/sdk';
import type { CreateBookmarkInput } from '@tessera/schemas';

export interface PinboardItem {
  href: string;
  description: string;
  extended?: string;
  meta?: string;
  hash?: string;
  time?: string;
  shared?: string;
  toread?: string;
  tags?: string;
}

export const manifest = defineExtension({
  id: 'pinboard-import',
  name: 'Pinboard Importer',
  version: '1.0.0',
  description: 'Import bookmarks and tags from Pinboard JSON exports into Tessera.',
  author: 'tessera.community',
  permissions: ['bookmarks.write', 'tags.write'],
  ui: {
    commands: ['import-from-json'],
  },
});

/**
 * Parses a Pinboard export JSON string into Tessera CreateBookmarkInput items.
 */
export const parsePinboardExport = (jsonString: string): CreateBookmarkInput[] => {
  const parsed = JSON.parse(jsonString) as PinboardItem[];
  if (!Array.isArray(parsed)) {
    throw new Error('Invalid Pinboard export format: Expected array of bookmarks.');
  }

  return parsed.map((item) => ({
    url: item.href,
    title: item.description || item.href,
    description: item.extended || '',
    notes: '',
    tags: item.tags ? item.tags.split(' ').map((t) => t.trim().toLowerCase()).filter(Boolean) : [],
    isFavorite: false,
    isPinned: false,
    isArchived: item.toread === 'no',
  }));
};
