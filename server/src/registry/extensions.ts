import type { ExtensionManifest } from '@tessera/schemas';

export const officialManifests: ExtensionManifest[] = [
  {
    id: 'pinboard-import',
    name: 'Pinboard Importer',
    version: '1.0.0',
    description: 'Import your existing bookmarks and tags from Pinboard JSON exports.',
    author: 'tessera.community',
    permissions: ['bookmarks.write', 'tags.write'],
    ui: {
      commands: ['import-pinboard-file'],
    },
  },
  {
    id: 'markdown-export',
    name: 'Markdown Exporter',
    version: '1.0.0',
    description: 'Export all bookmarks grouped by collection or tag into clean Markdown.',
    author: 'tessera.community',
    permissions: ['bookmarks.read', 'tags.read', 'collections.read'],
    ui: {
      commands: ['export-to-markdown'],
    },
  },
];

export class ExtensionRegistry {
  private registry = new Map<string, ExtensionManifest>();

  constructor() {
    for (const manifest of officialManifests) {
      this.registry.set(manifest.id, manifest);
    }
  }

  public listExtensions(): ExtensionManifest[] {
    return Array.from(this.registry.values());
  }

  public getExtension(id: string): ExtensionManifest | undefined {
    return this.registry.get(id);
  }

  public registerExtension(manifest: ExtensionManifest): void {
    this.registry.set(manifest.id, manifest);
  }
}

export const extensionRegistry = new ExtensionRegistry();
