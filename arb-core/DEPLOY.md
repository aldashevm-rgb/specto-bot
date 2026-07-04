# Деплой вотчера (работает 24/7 без твоего компьютера)

Вотчер `npm run watch` — долгоживущий процесс: сканирует, шлёт в Telegram новые
ставки и результаты сыгравших. Чтобы он работал круглосуточно, размести его на
сервере. Ниже три пути — от самого простого к «полный контроль».

> ⚠️ **Квота Odds API.** Free-тариф ~500 запросов/мес. Для круглосуточной работы
> ставь интервал ≥ 120 мин (`ARB_WATCH_MS=7200000` ≈ 360/мес). Меньше — нужен
> платный тариф.

Понадобятся ключи (те же, что в `.env`): `ODDS_API_KEY`, `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_CHAT_ID`, по желанию `API_FOOTBALL_KEY`, `ANTHROPIC_API_KEY`.

---

## Вариант 1. VPS + Docker (рекомендую — просто и надёжно)

Подойдёт любой дешёвый VPS (Hetzner ~€4/мес, DigitalOcean, Timeweb и т.п.),
Ubuntu. По SSH выполни:

```bash
# 1) поставить Docker (один раз)
curl -fsSL https://get.docker.com | sh

# 2) забрать код
git clone https://github.com/aldashevm-rgb/specto-bot.git
cd specto-bot/arb-core

# 3) создать .env с ключами
cp .env.example .env
nano .env        # впиши ODDS_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

# 4) запустить (соберётся образ и стартует в фоне, авто-рестарт при ребуте)
docker compose up -d

# логи / статус
docker compose logs -f
```

Интервал и вид спорта меняются в `docker-compose.yml` (`ARB_WATCH_MS`,
`ARB_WATCH_SPORT`). После правок — `docker compose up -d` снова.
Остановить: `docker compose down`.

---

## Вариант 2. VPS без Docker (systemd)

На сервере с Node.js 18+:

```bash
git clone https://github.com/aldashevm-rgb/specto-bot.git /opt/specto-bot
cd /opt/specto-bot/arb-core
cp .env.example .env && nano .env         # ключи

sudo useradd -r -s /usr/sbin/nologin arb  # сервисный пользователь (по желанию)
sudo chown -R arb /opt/specto-bot

sudo cp deploy/arb-watch.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now arb-watch     # запустить и включить автозапуск
journalctl -u arb-watch -f                # логи
```

Правки интервала — в `/etc/systemd/system/arb-watch.service`
(`Environment=ARB_WATCH_MS=...`), затем `sudo systemctl restart arb-watch`.

---

## Вариант 3. PaaS (без своего сервера)

Хостинги вроде **Railway**, **Render** (Background Worker) или **Fly.io** умеют
запускать процесс из репозитория:

1. Подключи GitHub-репозиторий, укажи корень `arb-core` и старт-команду
   `node src/watch.js` (или собери по `Dockerfile`).
2. В настройках проекта задай переменные окружения: `ODDS_API_KEY`,
   `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ARB_WATCH_SPORT`, `ARB_WATCH_MS`.
3. Для сохранения лога прогнозов между рестартами примонтируй volume к `/data`
   и задай `ARB_LOG_FILE=/data/predictions.jsonl` (у Fly.io — Volumes; у Render —
   Disk). Без volume вотчер работает, но история для грейдинга не копится.

---

## Проверка

После старта в Telegram должно прийти первое сообщение при появлении ставки.
Хочешь убедиться сразу — временно поставь маленький интервал и широкое окно:
`ARB_WATCH_MS=60000`, `ARB_MAX_HOURS=0` (потом верни обратно, чтобы не жечь квоту).

Переменные вотчера: `ARB_WATCH_SPORT`, `ARB_WATCH_MS`, `ARB_WATCH_SHARP=1`,
`ARB_MAX_HOURS`, `ARB_MIN_EDGE`, `ARB_BANKROLL` — полный список в `.env.example`.
