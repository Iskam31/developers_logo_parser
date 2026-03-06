import { fetchPage, closeBrowser } from './crawler/browser';
import { checkRobotsTxt } from './crawler/robotsTxt';
import { extractFromHtml, extractFavicon, extractLargeIcons, Candidate } from './extractors/htmlExtractor';
import { extractFromCss } from './extractors/cssExtractor';
import { selectBestCandidate, ScoredCandidate } from './scoring/logoScoring';
import { downloadImage, DownloadResult } from './processing/downloadImage';
import { cropImage, getImageDimensions } from './processing/cropImage';
import { optimize } from './processing/optimize';
import { saveLogo } from './storage/saveLogo';
import { updateLogoEntry, LogoEntry } from './storage/generateJson';
import { DomCandidate } from './crawler/browser';
import config from './config';
import pLimit from 'p-limit';

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

async function parseLogo(url: string): Promise<LogoEntry | null> {
  console.log(`\n[INFO] Processing: ${url}`);
  
  const domain = getDomain(url);
  if (!domain) {
    console.log(`[ERROR] Invalid URL: ${url}`);
    return null;
  }

  // Check robots.txt
  const allowed = await checkRobotsTxt(url);
  if (!allowed) {
    console.log(`[WARN] Blocked by robots.txt: ${url}`);
    return null;
  }

  // Fetch page
  let pageResult;
  try {
    pageResult = await fetchPage(url);
  } catch (error) {
    console.log(`[ERROR] Failed to fetch page: ${(error as Error).message}`);
    return null;
  }

  // Extract candidates
  const htmlCandidates: Candidate[] = extractFromHtml(pageResult.html, url);
  const cssCandidates: Candidate[] = await extractFromCss(pageResult.html, url);
  
  // Add DOM candidates
  const domCandidates: Candidate[] = pageResult.domCandidates.map((dc: DomCandidate) => ({
    url: dc.url,
    source: 'dom',
    type: 'image',
    className: dc.className,
    id: dc.id,
    parent: dc.parent,
    parentClass: dc.parentClass,
  }));

  // Merge all candidates
  const allCandidates: Candidate[] = [...htmlCandidates, ...cssCandidates, ...domCandidates];

  // Priority 1: Try large icons (apple-touch-icon, og:image - typically 180x180+)
  console.log(`[INFO] Looking for large icons (apple-touch-icon, og:image)...`);
  let best: ScoredCandidate | null = null;
  let downloadedBest: DownloadResult | null = null;
  
  const largeIcons = extractLargeIcons(pageResult.html, url);
  if (largeIcons.length > 0) {
    console.log(`[INFO] Found ${largeIcons.length} large icon(s)`);
    // Try each large icon until we find one with good size
    for (const icon of largeIcons) {
      if (!icon.url) continue;
      try {
        const downloaded = await downloadImage(icon.url);
        const dims = await getImageDimensions(downloaded.buffer, downloaded.ext);
        const minDim = Math.min(dims.width || 999, dims.height || 999);
        
        console.log(`[INFO] Checking ${icon.url} (${dims.width}x${dims.height})`);
        
        if (minDim >= config.minSize) {
          downloadedBest = downloaded;
          best = {
            ...icon,
            score: 60,
            reasons: ['large icon (apple-touch-icon/og:image)'],
            width: dims.width?.toString(),
            height: dims.height?.toString(),
          } as ScoredCandidate;
          console.log(`[INFO] Using large icon: ${icon.url}`);
          break;
        } else {
          console.log(`[INFO] Too small (${minDim}px < ${config.minSize}px), trying next...`);
        }
      } catch (e) {
        console.log(`[WARN] Failed to download ${icon.url}: ${(e as Error).message}`);
      }
    }
  }

  // Priority 2: Try favicon if no large icon found or too small
  if (!best || !downloadedBest) {
    console.log(`[INFO] Trying favicon...`);
    const favicon = extractFavicon(pageResult.html, url);
    
    if (favicon && favicon.url) {
      try {
        const downloaded = await downloadImage(favicon.url);
        const dims = await getImageDimensions(downloaded.buffer, downloaded.ext);
        const minDim = Math.min(dims.width || 999, dims.height || 999);
        
        console.log(`[INFO] Favicon: ${favicon.url} (${dims.width}x${dims.height})`);
        
        if (minDim >= config.minSize) {
          downloadedBest = downloaded;
          best = {
            ...favicon,
            score: 50,
            reasons: ['favicon - browser tab icon'],
            width: dims.width?.toString(),
            height: dims.height?.toString(),
          } as ScoredCandidate;
        } else {
          console.log(`[WARN] Favicon too small (${minDim}px < ${config.minSize}px)`);
        }
      } catch (e) {
        console.log(`[WARN] Failed to download favicon: ${(e as Error).message}`);
      }
    }
  }

  // Priority 3: Try /favicon.ico directly
  if (!best || !downloadedBest) {
    console.log(`[INFO] Trying /favicon.ico directly...`);
    try {
      const faviconUrl = new URL('/favicon.ico', url).href;
      const downloaded = await downloadImage(faviconUrl);
      const dims = await getImageDimensions(downloaded.buffer, downloaded.ext);
      const minDim = Math.min(dims.width || 999, dims.height || 999);
      
      if (minDim >= config.minSize) {
        downloadedBest = downloaded;
        best = {
          url: faviconUrl,
          source: 'favicon',
          type: 'image',
          score: 45,
          reasons: ['favicon.ico - browser tab icon'],
          width: dims.width?.toString(),
          height: dims.height?.toString(),
        } as ScoredCandidate;
      }
    } catch (e) {
      console.log(`[WARN] /favicon.ico not available or too small`);
    }
  }

  // Priority 4: Try main logo candidates from DOM/HTML/CSS
  if (!best || !downloadedBest) {
    console.log(`[INFO] Trying main logo candidates...`);
    const scoredBest = selectBestCandidate(allCandidates);
    if (scoredBest && scoredBest.url) {
      try {
        const downloaded = await downloadImage(scoredBest.url);
        const dims = await getImageDimensions(downloaded.buffer, downloaded.ext);
        
        downloadedBest = downloaded;
        best = {
          ...scoredBest,
          width: dims.width?.toString(),
          height: dims.height?.toString(),
        };
      } catch (e) {
        console.log(`[WARN] Failed to download: ${(e as Error).message}`);
      }
    }
  }

  // Priority 5: Try external logo services (better quality logos)
  if (!best || !downloadedBest) {
    console.log(`[INFO] Trying external logo services...`);
    const domainWithoutWww = domain.replace(/^www\./, '');
    
    const logoServices = [
      `https://favicon.im/${domainWithoutWww}`,
      `https://favicon.im/www.${domainWithoutWww}`,
      `https://favicon.ico/${domainWithoutWww}`,
    ];
    
    for (const serviceUrl of logoServices) {
      try {
        console.log(`[INFO] Trying: ${serviceUrl}`);
        const downloaded = await downloadImage(serviceUrl);
        const dims = await getImageDimensions(downloaded.buffer, downloaded.ext);
        const minDim = Math.min(dims.width || 0, dims.height || 0);
        
        // Check if square and large enough
        if (minDim >= config.minSize) {
          const ratio = (dims.width || 1) / (dims.height || 1);
          const isSquare = ratio >= config.minSquareRatio && ratio <= 1 / config.minSquareRatio;
          
          console.log(`[INFO] ${serviceUrl}: ${dims.width}x${dims.height}, square: ${isSquare}`);
          
          if (isSquare || minDim >= 128) {
            downloadedBest = downloaded;
            best = {
              url: serviceUrl,
              source: 'external-service',
              type: 'image',
              score: isSquare ? 35 : 25,
              reasons: [isSquare ? 'square logo from external service' : 'large logo from external service'],
              width: dims.width?.toString(),
              height: dims.height?.toString(),
              isSquare,
            } as ScoredCandidate;
            console.log(`[SUCCESS] Found logo from external service: ${serviceUrl}`);
            break;
          }
        }
      } catch (e) {
        console.log(`[WARN] Service not available: ${serviceUrl}`);
      }
    }
  }
  
  if (!best || !downloadedBest) {
    console.log(`[WARN] No logo candidates found for ${domain}`);
    return null;
  }

  console.log(`[INFO] Best candidate: ${best.url} (score: ${best.score})`);
  console.log(`[INFO] Reasons: ${best.reasons.join(', ')}`);

  // Skip if inline SVG
  if (best.type === 'svg-inline' && best.outerHtml) {
    console.log(`[INFO] Processing inline SVG`);
    const buffer = Buffer.from(best.outerHtml, 'utf-8');
    const optimized = await optimize(buffer, 'svg');
    const saved = await saveLogo(optimized, domain, 'svg');
    
    const entry: LogoEntry = {
      domain,
      logoUrl: saved.url,
      originalUrl: url,
      format: 'svg',
      width: null,
      height: null,
      scoring: best.score,
      downloadedAt: new Date().toISOString(),
    };
    
    await updateLogoEntry(entry);
    console.log(`[SUCCESS] Logo saved: ${saved.url}`);
    return entry;
  }

  // Use already downloaded image
  const downloaded = downloadedBest;
  if (!downloaded) {
    console.log(`[ERROR] No downloaded image available`);
    return null;
  }

  // Crop and resize
  const cropped = await cropImage(downloaded.buffer, downloaded.ext);

  // Optimize
  const optimized = await optimize(cropped.buffer, downloaded.ext);

  // Save
  const saved = await saveLogo(optimized, domain, downloaded.ext);

  // Update JSON
  const entry: LogoEntry = {
    domain,
    logoUrl: saved.url,
    originalUrl: best.url || url,
    format: downloaded.ext,
    width: cropped.width,
    height: cropped.height,
    scoring: best.score,
    downloadedAt: new Date().toISOString(),
  };

  await updateLogoEntry(entry);
  
  console.log(`[SUCCESS] Logo saved: ${saved.url}`);
  return entry;
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: npx ts-node index.ts <url>');
    console.log('Example: npx ts-node index.ts https://www.pik.ru/');
    process.exit(1);
  }

  const urls = args.map(arg => {
    let url = arg.trim();
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    if (!url.endsWith('/')) {
      url += '/';
    }
    return url;
  });

  console.log(`[INFO] Parsing ${urls.length} site(s) with concurrency ${config.concurrency}`);

  const limit = pLimit(config.concurrency);
  const results: { domain: string; status: 'success' | 'error'; error?: string; size?: string }[] = [];

  const tasks = urls.map(url => 
    limit(async () => {
      try {
        const result = await parseLogo(url);
        if (result) {
          return {
            domain: result.domain,
            status: 'success' as const,
            size: result.width && result.height ? `${result.width}x${result.height}` : '-',
          };
        } else {
          return {
            domain: getDomain(url),
            status: 'error' as const,
            error: 'No logo found',
          };
        }
      } catch (error) {
        return {
          domain: getDomain(url),
          status: 'error' as const,
          error: (error as Error).message,
        };
      }
    })
  );

  const taskResults = await Promise.all(tasks);
  results.push(...taskResults);

  await closeBrowser();
  console.log('\n');
  console.log('═'.repeat(80));
  console.log('═'.repeat(30) + ' REPORT ' + '═'.repeat(32));
  console.log('═'.repeat(80));
  console.log(`\nTotal: ${results.length} | Success: ${results.filter(r => r.status === 'success').length} | Error: ${results.filter(r => r.status === 'error').length}`);
  console.log('\n' + '│ ' + 'Domain'.padEnd(30) + '│ ' + 'Status'.padEnd(10) + '│ ' + 'Size');
  console.log('├' + '─'.repeat(32) + '┼' + '─'.repeat(12) + '┼' + '─'.repeat(20));

  for (const r of results) {
    const status = r.status === 'success' ? '✅' : '❌';
    console.log(`│ ${r.domain.padEnd(30)}│ ${status} ${r.status.padEnd(9)}│ ${r.size || r.error || '-'}`);
  }

  console.log('═'.repeat(80));
  console.log('[INFO] Done');
}

main();
