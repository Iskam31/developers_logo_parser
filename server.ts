import express, { Request, Response } from 'express';
import cors from 'cors';
import * as path from 'path';
import { parseLogos, closeBrowser } from './lib';

const app = express();
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
}));
app.use(express.json());

// Serve saved logos as static files
app.use('/logos', express.static(path.join(process.cwd(), 'logos')));

/**
 * POST /api/parse
 * Body: { urls: string[] }
 * Response: { results: Array<{ domain, status, logoUrl?, error? }> }
 */
app.post('/api/parse', async (req: Request, res: Response) => {
  const { urls } = req.body as { urls?: unknown };

  if (!Array.isArray(urls) || urls.length === 0) {
    res.status(400).json({ error: 'urls must be a non-empty array of strings' });
    return;
  }

  const invalidUrl = urls.find(u => typeof u !== 'string');
  if (invalidUrl !== undefined) {
    res.status(400).json({ error: 'all urls must be strings' });
    return;
  }

  const normalizedUrls = (urls as string[]).map(url => {
    let u = url.trim();
    if (!u.startsWith('http')) u = 'https://' + u;
    if (!u.endsWith('/')) u += '/';
    return u;
  });

  console.log(`[INFO] API: parsing ${normalizedUrls.length} URL(s)`);

  try {
    const results = await parseLogos(normalizedUrls);

    res.json({
      results: results.map(r => ({
        domain: r.domain,
        status: r.status,
        logoUrl: r.entry?.logoUrl,
        format: r.entry?.format,
        width: r.entry?.width,
        height: r.entry?.height,
        scoring: r.entry?.scoring,
        error: r.error,
      })),
    });
  } catch (error) {
    console.error('[ERROR] Parse failed:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/health
 */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`[INFO] Logo parser server running on http://localhost:${PORT}`);
  console.log(`[INFO] POST /api/parse — parse logos`);
  console.log(`[INFO] GET  /api/health — health check`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[INFO] Shutting down...');
  await closeBrowser();
  server.close(() => process.exit(0));
});

process.on('SIGINT', async () => {
  console.log('[INFO] Shutting down...');
  await closeBrowser();
  server.close(() => process.exit(0));
});
