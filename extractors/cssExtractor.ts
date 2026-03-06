import type { CheerioAPI } from 'cheerio';
import axios from 'axios';
import { resolveUrl, Candidate } from './htmlExtractor';

export async function extractFromCss($: CheerioAPI, baseUrl: string): Promise<Candidate[]> {
  const candidates: Candidate[] = [];
  const seen = new Set<string>();

  const cssUrls: string[] = [];
  
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      const resolved = resolveUrl(baseUrl, href);
      if (resolved) cssUrls.push(resolved);
    }
  });

  const inlineStyles: string[] = [];
  $('style').each((_, el) => {
    const content = $(el).html();
    if (content) inlineStyles.push(content);
  });

  const cssContents: string[] = [...inlineStyles];
  
  for (const cssUrl of cssUrls.slice(0, 10)) {
    try {
      const response = await axios.get(cssUrl, {
        timeout: 10000,
        validateStatus: () => true,
      });
      if (response.status === 200) {
        cssContents.push(response.data);
      }
    } catch (e) {}
  }

  const logoPatterns = [
    /background-image\s*:\s*url\(['"]?([^'")\s]+)['"]?\)/gi,
    /background\s*:\s*[^;]*url\(['"]?([^'")\s]+)['"]?\)/gi,
    /content\s*:\s*url\(['"]?([^'")\s]+)['"]?\)/gi,
    /-webkit-mask-image\s*:\s*url\(['"]?([^'")\s]+)['"]?\)/gi,
    /mask-image\s*:\s*url\(['"]?([^'")\s]+)['"]?\)/gi,
  ];

  for (const cssContent of cssContents) {
    for (const pattern of logoPatterns) {
      let match;
      while ((match = pattern.exec(cssContent)) !== null) {
        const url = match[1];
        if (!url || url.startsWith('data:') || url === 'none') continue;
        
        const resolved = resolveUrl(baseUrl, url);
        if (resolved && !seen.has(resolved)) {
          const selectorStart = Math.max(0, match.index - 200);
          const selectorEnd = match.index;
          const selectorContext = cssContent.slice(selectorStart, selectorEnd);
          
          const isLogoRelated = /logo|brand|header|nav|site-branding/i.test(selectorContext);
          
          if (isLogoRelated) {
            seen.add(resolved);
            candidates.push({
              url: resolved,
              source: 'css',
              type: 'image',
            });
          }
        }
      }
    }
  }

  return candidates;
}
