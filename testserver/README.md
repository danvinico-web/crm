# MVCRM Test Server

Локальный **мок API MyView CRM** (`https://mvcrm.online`) для тестирования
интеграции LeadHub без обращения к реальной CRM.

- Нулевые зависимости — только встроенный `http` Node.js (Node ≥ 18).
- Точно повторяет контракт: те же success/error-ответы, что и в документации.
- Данные в памяти — рестарт сбрасывает состояние (повторяемые тесты).

## Запуск

```bash
cd testserver
node server.js
# или с авто-перезапуском при правках:
npm run dev
```

По умолчанию слушает `http://127.0.0.1:3001`. При старте печатает список
валидных токенов и готовые строки для `.env.local`.

## Подключение LeadHub к моку

В `crm/.env.local` замени боевой хост на локальный:

```dotenv
MVCRM_BASE_URL=http://127.0.0.1:3001
MVCRM_API_TOKEN=test-token-1
```

Пересей базу (`npm run seed`) — сид создаст офис «MyView CRM» с
`sandbox=false`, и отправка лидов пойдёт на мок вместо `mvcrm.online`.

## Эндпоинты

Авторизация — как у реального MVCRM: токен в query `?api_token=...`
**или** в заголовке `Authorization: Bearer <token>`. Заголовок
`Accept: application/json` не обязателен (сервер всегда отвечает JSON).

### `POST /customers/integration?api_token={token}` — регистрация клиента

Обязательные поля: **first_name, email, phone, source, country**.
Опциональные: `last_name, password, city, details, comment`.

Успех:
```json
{ "success": true, "customer_id": 12345, "message": "Customer created successfully!" }
```

Варианты ошибок (все с HTTP 200, `success:false` — как у реального MVCRM):

| Ситуация | Ответ |
|---|---|
| Токен не найден | `{ "success": false, "message": "Affiliate with this token {token} not found!" }` |
| Ошибки валидации | `{ "success": false, "message": "...", "errors": { "phone": [...], "email": [...] } }` |
| Email уже занят | входит в `errors.email`: `"The email has already been taken."` |
| Страна не найдена | `{ "success": false, "message": "Country {name} is not found!" }` |
| Сбой сохранения (симуляция) | `{ "success": false, "message": "Cannot save customer!" }` |

### `GET /customers/integration?api_token={token}` — список клиентов

Опциональный период: `&from=YYYY-MM-DD&to=YYYY-MM-DD` (включительно).

```json
{
  "affiliate": { "id": 1, "first_name": "Alice", "last_name": "Affiliate" },
  "customers": [
    { "id": 12345, "name": "John Doe", "email": "john@example.com", "status": "new", "date": "2026-07-11 10:20:00" }
  ]
}
```

Токен не найден → `{ "message": "Affiliate with this token not found!" }`.

### Служебные

- `GET /health` → `{ "ok": true, "service": "mvcrm-testserver" }`
- `GET /` → информация о сервере и список активных токенов.

## Тестовые данные по умолчанию

Моки — это **чистый JSON** в [`data/seed-data.json`](data/seed-data.json) (никакой
реальной БД). Файл грузится в память при старте; правь его, чтобы менять данные.
`daysAgo` у клиента — возраст регистрации в днях относительно «сегодня», поэтому
данные всегда «свежие» для тестов фильтра по датам. Можно указать и явную `date`.

80 клиентов across 4 аффилиатов, покрыт весь словарь статусов MVCRM
(`new`, `call back`/`callback`, `no answer`, `wrong info`/`wrong number`,
`not interested`, `in progress`, `ftd`/`deposit`, `rejected`) и ~17 стран:

| Токен | Аффилиат | Клиентов | Профиль |
|---|---|---|---|
| `test-token-1` | Alice Affiliate | 24 | Здоровая EU-воронка |
| `test-token-2` | Bob Partner | 20 | Глобальный микс гео |
| `test-token-3` | Carol Media | 18 | Депозиты / high-intent |
| `test-token-4` | Dave Traffic | 18 | Проблемный трафик + edge-cases |

Свой файл моков можно подставить через env `SEED_FILE=/path/to/data.json`.

## Конфигурация (env-переменные)

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `PORT` | `3001` | Порт |
| `HOST` | `127.0.0.1` | Хост |
| `MVCRM_TOKENS` | — | Свои токены через запятую (заменяют дефолтные) |
| `ALLOW_ANY_TOKEN` | `false` | Принимать любой непустой токен (аффилиат создаётся на лету) |
| `STRICT_COUNTRY` | `true` | Проверять страну по справочнику; `false` — принимать любую |
| `LOG_REQUESTS` | `true` | Логировать запросы в консоль |

Пример:
```bash
PORT=4000 ALLOW_ANY_TOKEN=true STRICT_COUNTRY=false node server.js
```

## Симуляция сбоя сохранения

Чтобы протестировать ветку `{ success:false, message:"Cannot save customer!" }`:

- отправь заголовок `x-simulate: save-fail`, **или**
- используй email с `+fail@`, например `qa+fail@example.com`.

## Быстрая проверка через curl

```bash
# Успешная регистрация
curl -s "http://127.0.0.1:3001/customers/integration?api_token=test-token-1" \
  -H "Accept: application/json" -H "Content-Type: application/json" \
  -d '{"first_name":"John","email":"john@example.com","phone":"+15551234567","source":"facebook","country":"United States"}'

# Ошибка валидации (нет phone и country)
curl -s "http://127.0.0.1:3001/customers/integration?api_token=test-token-1" \
  -H "Content-Type: application/json" \
  -d '{"first_name":"John","email":"john@example.com","source":"fb"}'

# Список клиентов за период
curl -s "http://127.0.0.1:3001/customers/integration?api_token=test-token-1&from=2026-07-01&to=2026-07-31"

# Неверный токен
curl -s "http://127.0.0.1:3001/customers/integration?api_token=nope" -d '{}' -H "Content-Type: application/json"
```
