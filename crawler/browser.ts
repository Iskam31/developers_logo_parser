import { chromium, Browser, Page } from 'playwright';
import config from '../config';
import * as fs from 'fs/promises';
import * as path from 'path';

let browser: Browser | null = null;

export interface DomCandidate {
  url: string;
  tag: string;
  className: string;
  id: string;
  parent: string;
  parentClass: string;
}

export interface PageResult {
  html: string;
  domCandidates: DomCandidate[];
  url: string;
}

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({ 
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ]
    });
  }
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

export async function fetchPage(url: string): Promise<PageResult> {
  const browserInstance = await getBrowser();
  const context = await browserInstance.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: 'ru-RU',
  });
  const page = await context.newPage();
  
  // Anti-detection
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['ru-RU', 'ru', 'en'] });
  });
  
  await page.setExtraHTTPHeaders({
    'User-Agent': config.userAgent,
    'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
  });

  try {
    await page.goto(url, {
      waitUntil: 'load',
      timeout: config.timeout,
    });

    // Wait for network to be idle (more reliable for SPAs)
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    
    // Wait a bit more for React to render
    await page.waitForTimeout(3000);

    const html: string = await page.content();
    
    // Debug: save HTML
    const domain = new URL(url).hostname.replace(/^www\./, '');
    const debugDir = path.join(process.cwd(), 'debug');
    await fs.mkdir(debugDir, { recursive: true });
    await fs.writeFile(path.join(debugDir, `${domain}.html`), html);

    // Get all images from the page
    const domCandidates: DomCandidate[] = await page.evaluate(() => {
      const candidates: DomCandidate[] = [];
      const seen = new Set<string>();
      
      // Get all images
      document.querySelectorAll('img').forEach((el: Element) => {
        const imgEl = el as HTMLImageElement;
        const src = imgEl.src || imgEl.getAttribute('srcset')?.split(' ')[0];
        if (src && !seen.has(src)) {
          seen.add(src);
          candidates.push({
            url: src,
            tag: el.tagName.toLowerCase(),
            className: el.className || '',
            id: el.id || '',
            parent: el.parentElement?.tagName.toLowerCase() || '',
            parentClass: el.parentElement?.className || '',
          });
        }
      });

      // Get all images inside header, nav, footer
      const containers = ['header', 'nav', 'footer', 'aside'];
      containers.forEach(container => {
        document.querySelectorAll(`${container} img`).forEach((el: Element) => {
          const imgEl = el as HTMLImageElement;
          const src = imgEl.src || imgEl.getAttribute('srcset')?.split(' ')[0];
          if (src && !seen.has(src)) {
            seen.add(src);
            candidates.push({
              url: src,
              tag: el.tagName.toLowerCase(),
              className: el.className || '',
              id: el.id || '',
              parent: container,
              parentClass: '',
            });
          }
        });
      });
      
      return candidates;
    });

    await page.close();
    
    return {
      html,
      domCandidates,
      url,
    };
  } catch (error) {
    await page.close();
    throw error;
  }
}
