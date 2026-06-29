# specto-bot

![CI](https://github.com/aldashevm-rgb/specto-bot/actions/workflows/ci.yml/badge.svg)

WhatsApp-бот продаж для **SPECTO**: общается с лидами голосом менеджера «Алина»
(Claude), сохраняет переписку и лиды в Supabase, сам ведёт догоняющие
сообщения, квалифицирует лидов ИИ и помогает менеджерам не упускать горячих.

## Возможности

- **Диалог через Claude** (`handlers/aiChat.js`) — системный промпт продавца,
  модель `claude-sonnet-4-6` (переопределяется `CLAUDE_MODEL`).
- **WhatsApp Cloud API** с проверкой HMAC-подписи Meta (`X-Hub-Signature-256`).
- **Догоняющие сообщения** (`handlers/followup.js`) — цепочка по таймингу,
  состояние в Supabase (переживает рестарт), сбрасывается при ответе клиента.
- **ИИ-квалификация лидов** (`handlers/qualify.js`) — оценивает переписку,
  пишет `leads.ai_qual_*`. Поллер включается `QUAL_ENABLED=1`.
- **Агент-сторож** (`handlers/watchdog.js`) — чинит пропуски, переоценивает
  устаревшие/сомнительные оценки, алертит про «застрявших» горячих лидов,
  мониторит здоровье. Включается `WATCHDOG_ENABLED=1`.
- **Авто-назначение** горячих ничьих лидов наименее загруженному менеджеру
  (`handlers/assign.js`, `AUTOASSIGN_ENABLED=1`).
- **Ежедневная сводка** (`handlers/digest.js`, `DIGEST_ENABLED=1`).
- **Дашборд горячих лидов** — `GET /hot` (HTML или `?format=json`).

## Эндпоинты

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/webhook` | верификация вебхука WhatsApp |
| POST | `/webhook` | входящие сообщения (проверка подписи) |
| GET | `/health` | живость сервиса и БД |
| GET | `/orders` | собранные лиды (защита `ORDERS_API_KEY`) |
| GET | `/hot` | дашборд горячих лидов |

## Запуск

Требуется Node.js 18+.

```bash
npm install
cp .env.example .env   # заполнить значения
npm start              # http://localhost:3000
```

## Тесты

```bash
npm test               # node --test
```

CI прогоняет проверку синтаксиса и тесты на каждый push и pull request
(`.github/workflows/ci.yml`). Ветка `main` защищена: смержить можно только
через PR с зелёным CI.

## Переменные окружения

Полный список с пояснениями — в [`.env.example`](./.env.example). Ключевые:

| Переменная | Назначение |
|---|---|
| `ANTHROPIC_API_KEY` | ключ Claude для ответов и квалификации |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | доступ к Supabase (RLS, service-role) |
| `WHATSAPP_TOKEN`, `PHONE_NUMBER_ID` | отправка сообщений WhatsApp Cloud API |
| `VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` | верификация и подпись вебхука |
| `QUAL_ENABLED`, `WATCHDOG_ENABLED`, `DIGEST_ENABLED`, `AUTOASSIGN_ENABLED` | флаги фоновых процессов |

## Структура

```
index.js              HTTP-сервер (Express), вебхуки, поллеры, эндпоинты
db.js                 Доступ к Supabase (REST), ретраи
whatsapp.js           Отправка сообщений
handlers/
  router.js           Маршрутизация входящих, стоп-слова, создание лида
  aiChat.js           Запрос к Claude
  followup.js         Догоняющие сообщения (состояние в БД)
  qualify.js          ИИ-квалификация лидов
  assign.js           Авто-назначение менеджеров
  watchdog.js         Мониторинг и авто-ремонт квалификации
  digest.js           Ежедневная сводка
  dashboard.js        HTML дашборда горячих лидов
  onboarding.js, playbook.js, playbookMetrics.js   Онбординг ниши и плейбуки
test/                 Тесты (node --test)
```
