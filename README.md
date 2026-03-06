# developers_logo_parser

Сервис для парсинга логотипов компаний с их сайтов.

## Запуск как HTTP-сервис (для интеграции с админкой)

```bash
npm install
npx playwright install chromium
npm run serve
```

Сервер стартует на `http://localhost:3000` (порт меняется через переменную окружения `PORT`).

## API

### POST /api/parse

Принимает список URL, возвращает найденные логотипы.

```bash
curl -X POST http://localhost:3000/api/parse \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://pik.ru/", "https://google.com/"]}'
```

Ответ:
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

### GET /api/health

Проверка доступности сервиса.

```bash
curl http://localhost:3000/api/health
```

## CLI (локальный запуск)

```bash
npm start https://pik.ru/ https://google.com/
```

## Конфигурация (переменные окружения)

| Переменная       | По умолчанию | Описание                              |
|------------------|-------------|---------------------------------------|
| `PORT`           | `3000`      | Порт HTTP-сервера                     |
| `DEBUG`          | `false`     | Сохранять HTML страниц в `debug/`     |
| `LOGOS_BASE_URL` | `/logos`    | Базовый URL для отдачи логотипов      |

## Структура файлов

- `logos/` — сохранённые логотипы (PNG/SVG/WebP/etc)
- `logos.json` — метаданные всех спарсенных логотипов
- `debug/` — HTML страниц (только при `DEBUG=true`)
