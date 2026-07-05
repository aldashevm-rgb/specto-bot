# Образ вотчера arb-core. Зависимостей нет — образ крошечный.
FROM node:20-slim

WORKDIR /app
COPY package.json ./
# npm-зависимостей нет; строка на будущее и для кэша слоёв.
RUN npm install --omit=dev || true
COPY . .

# Ключи и параметры — через переменные окружения (см. DEPLOY.md).
# По умолчанию лог прогнозов пишется в папку приложения (эфемерно). Для
# сохранения между рестартами: примонтируй Railway Volume (или docker volume)
# и задай ARB_LOG_FILE=<точка_монтирования>/predictions.jsonl.
# ВНИМАНИЕ: Railway не поддерживает инструкцию VOLUME — тома задаются в UI Railway.
CMD ["node", "src/watch.js"]
