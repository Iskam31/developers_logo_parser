import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';

export interface Candidate {
  url: string | null;
  source: string;
  type: string;
  alt?: string;
  className?: string;
  id?: string;
  viewBox?: string;
  width?: string;
  height?: string;
  outerHtml?: string;
}

export function resolveUrl(base: string, relative: string): string | null {
  try {
    return new URL(relative, base).href;
  } catch (e) {
    return null;
  }
}

export function loadHtml(html: string): CheerioAPI {
  return cheerio.load(html);
}

export function extractFromHtml($: CheerioAPI, baseUrl: string): Candidate[] {
  const candidates: Candidate[] = [];
  const seen = new Set<string>();

  const metaSelectors = [
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
    'meta[property="og:logo"]',
  ];

  metaSelectors.forEach(selector => {
    $(selector).each((_, el) => {
      const content = $(el).attr('content');
      if (content) {
        const resolved = resolveUrl(baseUrl, content);
        if (resolved && !seen.has(resolved)) {
          seen.add(resolved);
          candidates.push({ url: resolved, source: 'meta', type: 'image' });
        }
      }
    });
  });

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '');

      const findLogo = (obj: unknown): string | null => {
        if (!obj) return null;
        if (typeof obj === 'string') return obj;
        if (Array.isArray(obj)) {
          for (const item of obj) {
            const found = findLogo(item);
            if (found) return found;
          }
        }
        const o = obj as Record<string, unknown>;
        if (o.logo) {
          if (typeof o.logo === 'string') return o.logo;
          if (typeof o.logo === 'object' && o.logo !== null) {
            const logoObj = o.logo as Record<string, unknown>;
            if (typeof logoObj.url === 'string') return logoObj.url;
            if (Array.isArray(logoObj)) return findLogo(logoObj);
          }
        }
        return null;
      };

      const logoUrl = findLogo(json);
      if (logoUrl) {
        const resolved = resolveUrl(baseUrl, logoUrl);
        if (resolved && !seen.has(resolved)) {
          seen.add(resolved);
          candidates.push({ url: resolved, source: 'schema', type: 'image' });
        }
      }
    } catch (e) {}
  });

  const imgSelectors = [
    'img[class*="logo"]',
    'img[id*="logo"]',
    'img[alt*="logo"]',
    'img[class*="brand"]',
    'img[id*="brand"]',
    'img[alt*="brand"]',
    'img[class*="header"]',
    'img[alt*="company"]',
  ];

  imgSelectors.forEach(selector => {
    $(selector).each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('srcset')?.split(' ')[0];
      if (src) {
        const resolved = resolveUrl(baseUrl, src);
        if (resolved && !seen.has(resolved)) {
          seen.add(resolved);
          candidates.push({
            url: resolved,
            source: 'html-img',
            type: 'image',
            alt: $(el).attr('alt') || '',
            className: $(el).attr('class') || '',
            id: $(el).attr('id') || '',
          });
        }
      }
    });
  });

  const svgSelectors = [
    'svg[class*="logo"]',
    'svg[id*="logo"]',
    'svg[class*="brand"]',
    'svg[id*="brand"]',
  ];

  svgSelectors.forEach(selector => {
    $(selector).each((_, el) => {
      candidates.push({
        url: null,
        source: 'html-svg',
        type: 'svg-inline',
        viewBox: $(el).attr('viewBox') || '',
        width: $(el).attr('width') || '',
        height: $(el).attr('height') || '',
        className: $(el).attr('class') || '',
        id: $(el).attr('id') || '',
        outerHtml: $.html(el),
      });
    });
  });

  $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"], link[rel="mask-icon"]').each((_, el) => {
    const href = $(el).attr('href');
    const sizes = $(el).attr('sizes') || '';
    if (href) {
      const resolved = resolveUrl(baseUrl, href);
      if (resolved && !seen.has(resolved)) {
        seen.add(resolved);
        candidates.push({ url: resolved, source: 'favicon', type: 'image', className: sizes });
      }
    }
  });

  return candidates;
}

export function extractFavicon($: CheerioAPI, baseUrl: string): Candidate | null {
  const selectors = [
    'link[rel="icon"]',
    'link[rel="shortcut icon"]',
    'link[rel="apple-touch-icon"]',
    'link[rel="apple-touch-icon-precomposed"]',
    'link[rel="mask-icon"]',
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
  ];

  for (const selector of selectors) {
    let content: string | undefined;
    if (selector.startsWith('meta')) {
      content = $(selector).attr('content');
    } else {
      content = $(selector).attr('href');
    }
    if (content) {
      const resolved = resolveUrl(baseUrl, content);
      if (resolved) {
        return { url: resolved, source: 'favicon', type: 'image' };
      }
    }
  }

  return null;
}

export function extractLargeIcons($: CheerioAPI, baseUrl: string): Candidate[] {
  const candidates: Candidate[] = [];
  const seen = new Set<string>();

  const selectors = [
    'link[rel="apple-touch-icon"]',
    'link[rel="apple-touch-icon-precomposed"]',
    'link[rel="mask-icon"][sizes="512x512"]',
    'link[rel="mask-icon"][sizes="192x192"]',
    'link[rel="icon"][sizes="192x192"]',
    'link[rel="icon"][sizes="512x512"]',
    'meta[property="og:image"]',
  ];

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const href = $(el).attr('href') || $(el).attr('content');
      const sizes = $(el).attr('sizes') || '';
      if (href) {
        const resolved = resolveUrl(baseUrl, href);
        if (resolved && !seen.has(resolved)) {
          seen.add(resolved);
          candidates.push({ url: resolved, source: 'large-icon', type: 'image', className: sizes });
        }
      }
    });
  }

  return candidates;
}
