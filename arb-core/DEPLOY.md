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

## Вариант 3. PaaS через браузер — Railway (без своего сервера и командной строки)

1. Зайди на **railway.app** → **Login with GitHub**.
2. **New Project → Deploy from GitHub repo** → выбери `aldashevm-rgb/specto-bot`
   (при первом разе Railway попросит разрешить доступ к репозиторию).
3. Открой сервис → **Settings**:
   - **Root Directory** = `arb-core` (Railway сам увидит `Dockerfile` и соберёт вотчер).
   - Порт настраивать не нужно — это фоновый процесс, а не сайт.
4. Вкладка **Variables** → добавь:
   ```
   ODDS_API_KEY=...
   TELEGRAM_BOT_TOKEN=...
   TELEGRAM_CHAT_ID=...
   ARB_WATCH_SPORT=upcoming
   ARB_WATCH_MS=7200000        # 120 мин
   ARB_MAX_HOURS=72
   ARB_LOG_FILE=/data/predictions.jsonl
   ```
   (по желанию `API_FOOTBALL_KEY`, `ANTHROPIC_API_KEY`, `ARB_WATCH_SHARP=1`).
5. **New → Volume**, точка монтирования **`/data`** — чтобы лог прогнозов и
   статистика грейдинга переживали перезапуски.
6. **Deploy**. Вкладка **Logs** — увидишь строки вотчера; при появлении ставки
   придёт сообщение в Telegram.

Стоимость: вотчер крошечный (просыпается раз в 120 мин), потребление
минимальное — влезает в пробный кредит / дешёвый Hobby-план Railway.

> **Render / Fly.io** — аналогично: тип сервиса «Background Worker», Root
> Directory `arb-core`, те же переменные, диск/volume на `/data`.

---

## Проверка

После старта в Telegram должно прийти первое сообщение при появлении ставки.
Хочешь убедиться сразу — временно поставь маленький интервал и широкое окно:
`ARB_WATCH_MS=60000`, `ARB_MAX_HOURS=0` (потом верни обратно, чтобы не жечь квоту).

Переменные вотчера: `ARB_WATCH_SPORT`, `ARB_WATCH_MS`, `ARB_WATCH_SHARP=1`,
`ARB_MAX_HOURS`, `ARB_MIN_EDGE`, `ARB_BANKROLL` — полный список в `.env.example`.
