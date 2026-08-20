export interface PageMetadata {
  url: string;
  title: string;
  description: string;
  faviconUrl: string;
  previewImageUrl: string;
}

/**
 * Normalizes input URL by trimming and prepending https:// if missing.
 */
export const normalizeUrl = (raw: string): string => {
  let trimmed = raw.trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed;
};

/**
 * Strips tracking query parameters from URL.
 */
export const cleanTrackingParams = (rawUrl: string): string => {
  try {
    const normalized = normalizeUrl(rawUrl);
    const parsed = new URL(normalized);
    const trackingKeys = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
      'gclid',
      'msclkid',
      'mc_cid',
      'mc_eid',
      'ref',
      'ref_src',
      'source',
    ];

    for (const key of trackingKeys) {
      parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return normalizeUrl(rawUrl);
  }
};

/**
 * Validates whether a target URL is safe to fetch (blocks SSRF / private networks).
 */
export const isSafePublicUrl = (targetUrl: string): boolean => {
  try {
    const url = new URL(normalizeUrl(targetUrl));
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }

    const host = url.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('172.16.') ||
      host.startsWith('172.17.') ||
      host.startsWith('172.18.') ||
      host.startsWith('172.19.') ||
      host.startsWith('172.20.') ||
      host.startsWith('172.21.') ||
      host.startsWith('172.22.') ||
      host.startsWith('172.23.') ||
      host.startsWith('172.24.') ||
      host.startsWith('172.25.') ||
      host.startsWith('172.26.') ||
      host.startsWith('172.27.') ||
      host.startsWith('172.28.') ||
      host.startsWith('172.29.') ||
      host.startsWith('172.30.') ||
      host.startsWith('172.31.') ||
      host.startsWith('169.254.')
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
};

/**
 * Decodes basic HTML entities in extracted text.
 */
const decodeHtmlEntities = (text: string): string => {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Robust regex helper to extract attribute content regardless of attribute order.
 */
const extractMetaTag = (html: string, nameOrProp: string): string => {
  const escaped = nameOrProp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Matches <meta ... property="xyz" ... content="abc" ...> or <meta ... content="abc" ... property="xyz" ...>
  const regex1 = new RegExp(`<meta\\s+[^>]*(?:name|property)=["']${escaped}["'][^>]*content=["']([^"']*)["']`, 'i');
  const match1 = html.match(regex1);
  if (match1 && match1[1]) return decodeHtmlEntities(match1[1]);

  const regex2 = new RegExp(`<meta\\s+[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${escaped}["']`, 'i');
  const match2 = html.match(regex2);
  if (match2 && match2[1]) return decodeHtmlEntities(match2[1]);

  return '';
};

/**
 * Parses OpenGraph, Twitter, and HTML meta tags from HTML text.
 */
export const extractOpenGraphMetadata = (html: string, pageUrl: string): PageMetadata => {
  let hostname = '';
  let origin = '';
  try {
    const parsed = new URL(pageUrl);
    hostname = parsed.hostname.replace(/^www\./, '');
    origin = parsed.origin;
  } catch {
    hostname = pageUrl;
  }

  // 1. Extract Title
  let title =
    extractMetaTag(html, 'og:title') ||
    extractMetaTag(html, 'twitter:title') ||
    extractMetaTag(html, 'title');

  if (!title) {
    const titleTagMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleTagMatch && titleTagMatch[1]) {
      title = decodeHtmlEntities(titleTagMatch[1]);
    }
  }

  if (!title) {
    title = hostname || pageUrl;
  }

  // 2. Extract Description
  const description =
    extractMetaTag(html, 'og:description') ||
    extractMetaTag(html, 'description') ||
    extractMetaTag(html, 'twitter:description');

  // 3. Extract Preview Image
  let previewImageUrl =
    extractMetaTag(html, 'og:image') ||
    extractMetaTag(html, 'twitter:image') ||
    extractMetaTag(html, 'image');

  // 4. Extract Favicon
  let faviconUrl = '';
  const iconMatch1 = html.match(/<link\s+[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']*)["']/i);
  const iconMatch2 = html.match(/<link\s+[^>]*href=["']([^"']*)["'][^>]*rel=["'](?:shortcut )?icon["']/i);
  const iconHref = iconMatch1?.[1] || iconMatch2?.[1] || '';

  if (iconHref) {
    faviconUrl = iconHref;
  }

  // Resolve Relative URLs
  try {
    const base = new URL(pageUrl);
    if (previewImageUrl && !previewImageUrl.startsWith('http://') && !previewImageUrl.startsWith('https://')) {
      previewImageUrl = new URL(previewImageUrl, base).toString();
    }
    if (faviconUrl && !faviconUrl.startsWith('http://') && !faviconUrl.startsWith('https://')) {
      faviconUrl = new URL(faviconUrl, base).toString();
    }
  } catch {}

  // Fallback high-res favicon if none found in HTML
  if (!faviconUrl && origin) {
    faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  }

  return {
    url: pageUrl,
    title,
    description,
    faviconUrl,
    previewImageUrl,
  };
};

/**
 * Fetches page metadata preserving client privacy.
 */
export const fetchPrivacyReaderMetadata = async (
  rawUrl: string,
): Promise<{ data: PageMetadata | null; error: string | null }> => {
  const cleanedUrl = cleanTrackingParams(rawUrl);

  if (!isSafePublicUrl(cleanedUrl)) {
    return { data: null, error: 'Invalid or restricted URL' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const response = await fetch(cleanedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      // Return hostname fallback if upstream 403/404
      const parsed = new URL(cleanedUrl);
      return {
        data: {
          url: cleanedUrl,
          title: parsed.hostname.replace(/^www\./, ''),
          description: '',
          faviconUrl: `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=64`,
          previewImageUrl: '',
        },
        error: null,
      };
    }

    const html = await response.text();
    const metadata = extractOpenGraphMetadata(html, cleanedUrl);
    return { data: metadata, error: null };
  } catch {
    // Network / timeout fallback: generate clean domain-level metadata
    try {
      const parsed = new URL(cleanedUrl);
      return {
        data: {
          url: cleanedUrl,
          title: parsed.hostname.replace(/^www\./, ''),
          description: '',
          faviconUrl: `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=64`,
          previewImageUrl: '',
        },
        error: null,
      };
    } catch {
      return { data: null, error: 'Failed to parse or reach URL' };
    }
  }
};

export interface IUrlMetadataResolver {
  resolve(rawUrl: string): Promise<{ data: PageMetadata | null; error: string | null }>;
}

/**
 * Deep module encapsulating URL sanitization, SSRF protection,
 * and OpenGraph scraping behind a single resolve() seam.
 */
export class UrlMetadataResolver implements IUrlMetadataResolver {
  public async resolve(rawUrl: string): Promise<{ data: PageMetadata | null; error: string | null }> {
    return fetchPrivacyReaderMetadata(rawUrl);
  }
}

export const urlMetadataResolver = new UrlMetadataResolver();
