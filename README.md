# developers_logo_parser

HTTP-сервис для автоматического поиска и скачивания логотипов компаний по URL их сайтов. Использует headless-браузер (Playwright) для рендеринга SPA, извлекает лучший кандидат через HTML/CSS/DOM-парсинг и систему скоринга, сохраняет результат локально.

---

## Требования

- Node.js 18+
- npm

---

## Установка

```bash
git clone <repo-url> developers_logo_parser
cd developers_logo_parser
npm install
npx playwright install chromium   # скачать headless-браузер (~150 МБ, один раз)
```

---

## Запуск

### Как HTTP-сервис (для интеграции с бэкендом/админкой)

```bash
npm run serve
# → [INFO] Logo parser server running on http://localhost:3000
```

С кастомным портом:

```bash
PORT=3001 npm run serve
```

### Как CLI (разовый запуск вручную)

```bash
npm start https://pik.ru/ https://google.com/
```

---

## API

### `POST /api/parse`

Парсит логотипы для списка сайтов. Запросы выполняются параллельно (concurrency: 3).

**Request:**

```http
POST /api/parse
Content-Type: application/json

{
  "urls": [
    "https://pik.ru/",
    "https://lsr.ru/",
    "https://google.com/"
  ]
}
```

URL можно передавать без `https://` и без `/` на конце — сервис нормализует автоматически:
```json
{ "urls": ["pik.ru", "lsr.ru"] }
```

**Response:**

```json
{
  "results": [
    {
      "domain": "pik.ru",
      "status": "success",
      "logoUrl": "/logos/pik.ru.png",
      "format": "png",
      "width": 180,
      "height": 180,
      "scoring": 60
    },
    {
      "domain": "lsr.ru",
      "status": "success",
      "logoUrl": "/logos/lsr.ru.svg",
      "format": "svg",
      "width": null,
      "height": null,
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

| Поле | Тип | Описание |
|------|-----|----------|
| `domain` | string | Домен без www |
| `status` | `"success"` \| `"error"` | Результат |
| `logoUrl` | string \| undefined | Путь к файлу логотипа (при success) |
| `format` | string \| undefined | Формат: `png`, `svg`, `ico`, `webp`, `jpg` |
| `width` | number \| null | Ширина в пикселях (null для SVG и ICO) |
| `height` | number \| null | Высота в пикселях (null для SVG и ICO) |
| `scoring` | number \| undefined | Оценка качества (выше = лучше) |
| `error` | string \| undefined | Причина ошибки (при error) |

**Коды ответа:**

| Код | Причина |
|-----|---------|
| `200` | Всегда при завершении парсинга (даже если часть URL не нашла лого) |
| `400` | `urls` не передан, пустой или содержит не-строки |
| `500` | Внутренняя ошибка сервера |

---

### `GET /api/health`

Проверка доступности сервиса.

```bash
curl http://localhost:3000/api/health
# → {"status":"ok"}
```

---

### Доступ к файлам логотипов

Сохранённые логотипы отдаются как статика по пути `/logos/<domain>.<ext>`:

```
GET /logos/pik.ru.png
GET /logos/lsr.ru.svg
```

Полный URL формируется из `LOGOS_BASE_URL` + имя файла. По умолчанию `logoUrl` в ответе выглядит как `/logos/pik.ru.png` — его нужно склеить с хостом сервиса на стороне клиента:

```js
const logoFullUrl = `http://localhost:3000${result.logoUrl}`;
```

---

## Пример интеграции с фронтендом

```js
const response = await fetch('http://localhost:3000/api/parse', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    urls: developers.map(d => d.domain),
  }),
});

const { results } = await response.json();

for (const r of results) {
  if (r.status === 'success') {
    console.log(`${r.domain}: http://localhost:3000${r.logoUrl}`);
  }
}
```

---

## Конфигурация

Все настройки через переменные окружения или `config.ts`:

| Переменная | По умолчанию | Описание |
|------------|-------------|----------|
| `PORT` | `3000` | Порт HTTP-сервера |
| `DEBUG` | `false` | Сохранять HTML страниц в `debug/` для отладки |
| `LOGOS_BASE_URL` | `/logos` | Базовый путь в `logoUrl` в ответе API |

Остальные параметры в `config.ts`:

| Параметр | Значение | Описание |
|----------|---------|----------|
| `concurrency` | `3` | Параллельных запросов одновременно |
| `timeout` | `60000` | Таймаут навигации браузера (мс) |
| `imageTimeout` | `15000` | Таймаут скачивания изображения (мс) |
| `waitAfterLoad` | `3000` | Ожидание после networkidle для SPA (мс) |
| `minSize` | `64` | Минимальный размер стороны логотипа (px) |
| `targetWidth` | `256` | Ширина после ресайза |

---

## Как работает парсинг

Для каждого URL сервис последовательно пробует 5 стратегий (берёт первую успешную):

1. **Крупные иконки** — `apple-touch-icon`, `og:image`, `icon[sizes="512x512"]`
2. **Favicon из HTML** — `<link rel="icon">` и аналоги
3. **Прямой `/favicon.ico`**
4. **Лучший кандидат из DOM/HTML/CSS** — скоринг по имени файла, расположению в header/nav, формату SVG
5. **Внешние сервисы** — `favicon.im`

Изображение скачивается, обрезается (удаляются прозрачные края), оптимизируется (Sharp/SVGO) и сохраняется в `logos/`.

Результаты кешируются в `logos.json` — повторный запрос для того же домена **перезаписывает** запись.

---

## Структура файлов

```
developers_logo_parser/
├── server.ts          # HTTP-сервер (точка входа для сервиса)
├── cli.ts             # CLI точка входа
├── lib.ts             # Основная логика: parseLogo, parseLogos
├── config.ts          # Конфигурация
├── crawler/
│   ├── browser.ts     # Playwright: рендеринг страниц
│   └── robotsTxt.ts   # Проверка robots.txt
├── extractors/
│   ├── htmlExtractor.ts  # Извлечение кандидатов из HTML
│   └── cssExtractor.ts   # Извлечение из CSS background-image
├── scoring/
│   └── logoScoring.ts    # Скоринг и выбор лучшего кандидата
├── processing/
│   ├── downloadImage.ts  # Скачивание изображений
│   ├── cropImage.ts      # Обрезка прозрачных краёв
│   └── optimize.ts       # Оптимизация (Sharp / SVGO)
├── storage/
│   ├── saveLogo.ts       # Сохранение файла
│   └── generateJson.ts   # Обновление logos.json (с mutex)
├── logos/             # Сохранённые логотипы
├── logos.json         # Метаданные
└── debug/             # HTML страниц (только при DEBUG=true)
```

---

## Использование как библиотеки (из другого TS-проекта)

```ts
import { parseLogo, parseLogos, closeBrowser } from './developers_logo_parser/lib';

// Один URL
const entry = await parseLogo('https://pik.ru/');
console.log(entry?.logoUrl); // '/logos/pik.ru.png'

// Несколько URL параллельно
const results = await parseLogos(['https://pik.ru/', 'https://lsr.ru/']);

// Закрыть браузер по завершении
await closeBrowser();
```
