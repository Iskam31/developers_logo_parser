# developers_logo_parser

A service for parsing company logos from their websites.

## Running as HTTP service

```bash
npm install
npx playwright install chromium
npm run serve
```

Server starts on `http://localhost:3000` (change port via `PORT=XXXX`).

### API

#### POST /api/parse

Accepts a list of URLs, returns found logos.

```bash
curl -X POST http://localhost:3000/api/parse \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://pik.ru/", "https://google.com/"]}'
```

Response:
```json
{
  "results": [
    {
      "domain": "pik.ru",
      "status": "success",
      "logoUrl": "/logos/pik.ru.png",
      "format": "png",
      "width": 256,
      "height": 80,
      "scoring": 60
    },
    {
      "domain": "google.com",
      "status": "error",
      "error": "No logo found"
    }
  ]
}
```

#### GET /api/health

Health check endpoint.

### Configuration (environment variables)

| Variable         | Default  | Description                           |
|------------------|----------|---------------------------------------|
| `PORT`           | `3000`   | HTTP server port                      |
| `DEBUG`          | `false`  | Save fetched HTML to `debug/`         |
| `LOGOS_BASE_URL` | `/logos`  | Base URL for serving logos             |

## CLI (local usage)

```bash
npm start https://pik.ru/ https://google.com/
```

## File structure

- `logos/` -- saved logos (PNG/SVG/etc)
- `logos.json` -- metadata
- `debug/` -- page HTML (only when `DEBUG=true`)
