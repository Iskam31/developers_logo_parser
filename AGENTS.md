# AGENTS.md - Developer Guide for Logo Parser

This file provides guidelines for agents working on this codebase.

---

## Project Overview

A TypeScript-based logo parser that extracts company logos from websites. It uses Playwright for headless browser rendering, extracts icons from HTML/CSS, and saves logos to local storage with JSON metadata.

---

## Build & Run Commands

### Development
```bash
# Install dependencies
npm install

# Install Playwright browsers (required before first run)
npx playwright install chromium

# Run parser with a single URL
npm start https://pik.ru/

# Run parser with multiple URLs
npm start https://pik.ru/ https://google.com/ https://alfabank.ru/

# Run with TypeScript directly
npx ts-node index.ts <url>
```

### Type Checking
```bash
# Type check without emitting files
npx tsc --noEmit

# Build to JavaScript (outputs to dist/)
npx tsc
```

### Linting
```bash
# No ESLint configured - follow code style guidelines below
```

---

## Code Style Guidelines

### TypeScript

- **Always use TypeScript** - No JavaScript files should be added
- **Enable strict mode** - `strict: true` is configured in tsconfig.json
- **Avoid `any`** - Use proper types or `unknown` with type guards
- **Export interfaces** - Define interfaces in separate files or at top of implementing files

### File Organization

```
project/
├── index.ts              # Entry point
├── config.ts            # Configuration
├── crawler/             # Browser and robots.txt
│   ├── browser.ts
│   └── robotsTxt.ts
├── extractors/          # HTML/CSS extraction
│   ├── htmlExtractor.ts
│   └── cssExtractor.ts
├── scoring/             # Logo scoring algorithm
│   └── logoScoring.ts
├── processing/          # Image processing
│   ├── downloadImage.ts
│   ├── cropImage.ts
│   └── optimize.ts
└── storage/             # File I/O
    ├── saveLogo.ts
    └── generateJson.ts
```

### Imports

- Use **absolute imports** from project root
- Order imports: external libraries → internal modules → types
- Use explicit `.ts` extensions in imports not required

```typescript
// Good
import { chromium, Browser } from 'playwright';
import config from './config';
import { Candidate } from './extractors/htmlExtractor';

// Avoid
import './style.css';
const local = require('./local');
```

### Naming Conventions

- **Files**: kebab-case (`htmlExtractor.ts`, `logoScoring.ts`)
- **Interfaces/Types**: PascalCase (`interface Candidate`, `type DownloadResult`)
- **Functions/Variables**: camelCase (`parseLogo`, `downloadImage`)
- **Constants**: camelCase with descriptive names (`config.targetWidth`)

### Type Annotations

- Always type function parameters and return values
- Use interfaces for object shapes
- Use explicit types over type inference for complex returns

```typescript
// Good
async function downloadImage(url: string): Promise<DownloadResult> {
  const response = await axios.get(url);
  return { buffer: response.data, ext: 'png' };
}

// Avoid
async function downloadImage(url) {
  const response = await axios.get(url);
  return { buffer: response.data, ext: 'png' };
}
```

### Error Handling

- Use try/catch with specific error messages
- Log errors with context
- Throw descriptive errors, not generic ones

```typescript
// Good
try {
  const downloaded = await downloadImage(url);
} catch (error) {
  console.log(`[ERROR] Failed to download: ${(error as Error).message}`);
  return null;
}

// Avoid
try {
  const downloaded = await downloadImage(url);
} catch (e) {
  return null;
}
```

### Logging

- Use console.log with prefixes: `[INFO]`, `[WARN]`, `[ERROR]`, `[SUCCESS]`
- Include context in log messages
- Log before and after async operations

```typescript
console.log(`[INFO] Processing: ${url}`);
console.log(`[SUCCESS] Logo saved: ${saved.url}`);
console.log(`[ERROR] Failed to fetch page: ${error.message}`);
```

### Configuration

- All configuration in `config.ts`
- Use TypeScript interfaces for config types
- Export default config object

```typescript
// config.ts
export interface Config {
  targetWidth: number;
  minSize: number;
}

const config: Config = {
  targetWidth: 256,
  minSize: 64,
};

export default config;
```

### Async/Await

- Always use async/await over raw promises
- Handle async errors with try/catch
- Use Promise.all for parallel operations with p-limit

```typescript
// Good
const limit = pLimit(config.concurrency);
const tasks = urls.map(url => limit(() => parseLogo(url)));
await Promise.all(tasks);

// Avoid
urls.forEach(url => parseLogo(url)); // Not awaited
```

### Browser/Playwright

- Reuse browser instance (singleton pattern in `crawler/browser.ts`)
- Always close pages after use
- Handle browser context properly
- Use timeouts for network operations

```typescript
let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}
```

### Image Processing

- Use Sharp for raster images (PNG, JPEG, WebP)
- Use SVGO for SVG optimization
- Validate image dimensions after download

### Testing

- No formal test framework configured
- Test manually by running:
  ```bash
  npx ts-node index.ts https://pik.ru/
  ```

---

## Common Tasks

### Add New Logo Source
1. Add extraction logic in `extractors/`
2. Add scoring criteria in `scoring/logoScoring.ts`
3. Test with: `npx ts-node index.ts <test-url>`

### Add New External Service
1. Modify `index.ts` in the external services section
2. Add service URL patterns to the logo services array
3. Test with blocked sites like `sberbank.ru`

### Modify Scoring Algorithm
1. Edit `scoring/logoScoring.ts`
2. Adjust weights in `config.ts`
3. Re-run tests to verify results

---

## Dependencies

- **playwright**: Headless browser for rendering SPAs
- **cheerio**: HTML parsing
- **sharp**: Image processing
- **svgo**: SVG optimization
- **axios**: HTTP requests
- **p-limit**: Concurrency control

---

## Notes

- Debug HTML files are saved to `debug/` folder
- Logos are saved to `logos/` folder
- Metadata stored in `logos.json`
- Minimum logo size: 64px (configurable in `config.ts`)
- Concurrency: 3 parallel requests (configurable)
