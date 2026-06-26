# SPECTO bot

AI-менеджер по продажам для Telegram и WhatsApp. Бот выступает в роли
менеджера **«Алина»**: ведёт диалог с потенциальным клиентом, презентует
услугу SPECTO под его задачу и закрывает на звонок/встречу. Ответы
генерирует Claude (Anthropic API). Новые лиды сохраняются, а «холодные»
контакты автоматически дожимаются серией follow-up сообщений.

## Возможности

- **Два канала**: Telegram (`/telegram`) и WhatsApp Cloud API (`/webhook`).
- **Диалог через Claude** с системным промптом продавца (`handlers/aiChat.js`).
- **Стоп-слова**: при «не нужно / передумал» бот вежливо прощается.
- **Follow-up**: автосообщения через 30 мин, 3 часа, 1, 3 и 7 дней
  (`handlers/followup.js`), сбрасываются при ответе клиента.
- **Сбор лидов** в Supabase (таблица `specto_bot_orders`), отдаётся по `GET /orders`.
- **История диалогов** в Supabase (`specto_bot_messages`) — переживает рестарты.
  Без ключей Supabase бот откатывается на `orders.json` + память.
- **Дедуп webhook'ов** (`handlers/dedup.js`): повторные доставки от
  Telegram/WhatsApp игнорируются, чтобы не отвечать дважды.

## Структура

```
index.js              HTTP-сервер (Express), маршруты вебхуков
supabaseClient.js     Клиент Supabase (null, если ключи не заданы)
db.js                 Лиды: Supabase specto_bot_orders (откат — orders.json)
whatsapp.js           Отправка сообщений в Telegram и WhatsApp
handlers/
  router.js           Маршрутизация входящих, стоп-слова
  aiChat.js           Запрос к Claude (Anthropic Messages API)
  history.js          История диалогов: Supabase specto_bot_messages (откат — память)
  followup.js         Таймеры дожимающих сообщений
  dedup.js            Защита от повторной обработки webhook
```

## Хранилище (Supabase)

Лиды и история диалогов хранятся в проекте Supabase в таблицах
`specto_bot_orders` и `specto_bot_messages` (RLS включён — доступ только под
`service_role`). Бот использует `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`.

Если эти переменные не заданы, бот работает в **локальном режиме**: лиды — в
`orders.json`, история — в памяти (теряется при рестарте). Удобно для отладки.

## Локальный запуск

Требуется Node.js 18+ (используется встроенный `fetch`).

```bash
npm install
cp .env.example .env   # заполнить значения
npm start
```

Сервис поднимется на `http://localhost:3000`. Проверка:

```bash
curl http://localhost:3000/orders   # → []
```

## Переменные окружения

Полный список — в [`.env.example`](./.env.example). Ключевые:

| Переменная | Назначение |
|---|---|
| `ANTHROPIC_API_KEY` | Ключ Claude для генерации ответов |
| `TELEGRAM_TOKEN` | Токен бота от @BotFather |
| `WHATSAPP_TOKEN` | Токен WhatsApp Cloud API |
| `PHONE_NUMBER_ID` | ID номера WhatsApp Cloud API |
| `VERIFY_TOKEN` | Строка верификации webhook WhatsApp |
| `SUPABASE_URL` | URL проекта Supabase (опц., иначе локальный режим) |
| `SUPABASE_SERVICE_KEY` | service_role ключ Supabase (опц.) |
| `PORT` | Порт сервера (по умолчанию 3000) |
| `RAILWAY_PUBLIC_DOMAIN` | Домен для авто-установки Telegram webhook |

## Деплой на Railway

1. Создайте проект и подключите репозиторий на [railway.app](https://railway.app).
2. В **Variables** задайте переменные из `.env.example`
   (`RAILWAY_PUBLIC_DOMAIN` Railway проставит сам).
3. Деплой стартует по `npm start`. При запуске бот **сам установит**
   Telegram webhook на `https://<RAILWAY_PUBLIC_DOMAIN>/telegram`.

## Настройка webhook'ов

### Telegram
Устанавливается автоматически при старте, если заданы `TELEGRAM_TOKEN` и
`RAILWAY_PUBLIC_DOMAIN`. Вручную:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_TOKEN>/setWebhook?url=https://<домен>/telegram"
```

### WhatsApp
В Meta for Developers → WhatsApp → Configuration → Webhook:
- **Callback URL**: `https://<домен>/webhook`
- **Verify token**: значение `VERIFY_TOKEN`
- Подпишитесь на поле `messages`.

## Заметки

- Лиды и история диалогов персистентны (Supabase) и переживают рестарты.
- **Follow-up таймеры** остаются в памяти (`setTimeout`) и при рестарте
  контейнера сбрасываются — для гарантированной доставки отложенных сообщений
  нужен внешний планировщик (cron/очередь). Это вне текущего объёма.
